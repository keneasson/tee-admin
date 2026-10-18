import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * /api/subscribe with the mailing-list registry (R5).
 *  - flag OFF: response and writes are the existing topic flow (no listGroups;
 *    a `lists` save is refused).
 *  - flag ON: every offered list, grouped by owner; saving writes the registry
 *    AND the SES topic of a bridged list.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  flag: vi.fn(),
  getContact: vi.fn(),
  sesSend: vi.fn(),
  listAllLists: vi.fn(),
  getOffered: vi.fn(),
  getRows: vi.fn(),
  getByEmail: vi.fn(),
  setListSubscription: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@aws-sdk/client-sesv2', () => ({
  UpdateContactCommand: vi.fn().mockImplementation((input) => ({ kind: 'update', input })),
  CreateContactCommand: vi.fn().mockImplementation((input) => ({ kind: 'create', input })),
  SubscriptionStatus: { OPT_IN: 'OPT_IN', OPT_OUT: 'OPT_OUT' },
}))
vi.mock('@/utils/email/sesClient', () => ({ getSesClient: () => ({ send: h.sesSend }) }))
vi.mock('@/utils/email/contact', () => ({ getContact: h.getContact }))
vi.mock('@/utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: vi.fn(async () => ({ valid: false })) }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({ checkFeatureFlagFromDB: h.flag }))
vi.mock('@my/app/config/tenants', () => ({
  getTenantFromHeaders: () => null,
  resolveTenantFromEnv: () => ({ id: 'tee', publicName: 'Toronto East', senderDomain: 'tee-admin.com' }),
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: h.getByEmail,
    getByEmailForAuth: vi.fn(async () => ({ firstName: 'Reader' })),
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/mailing-list-repository', () => ({
  mailingListRepository: {
    listAllLists: h.listAllLists,
    getOfferedListsForPerson: h.getOffered,
    getListSubscriptionsForEmail: h.getRows,
  },
}))
vi.mock('@/utils/dynamodb/locations', () => ({
  listEcclesiasCached: vi.fn(async () => [
    { name: 'Toronto East Ecclesia', country: 'CA', province: 'ON', city: 'Toronto' },
  ]),
}))
vi.mock('@/utils/mailing-lists/owners', async (orig) => ({
  ...(await orig<typeof import('../utils/mailing-lists/owners')>()),
  ownerNamesFor: vi.fn(async () => new Map([['ecclesia#toronto-east-ecclesia', 'Toronto East Ecclesia']])),
}))
vi.mock('@/utils/mailing-lists/subscriptions', () => ({
  defaultSubscriptionDeps: vi.fn(async () => ({})),
  setListSubscription: h.setListSubscription,
}))

import { GET, POST } from '../app/api/subscribe/route'

const LISTS = [
  {
    listId: 'L-NEWS',
    ownerType: 'ecclesia',
    ownerId: 'toronto-east-ecclesia',
    name: 'Newsletter',
    description: 'Thursday',
    category: 'newsletters',
    status: 'active',
    sesTopic: 'newsletter',
  },
  {
    listId: 'L-NEW',
    ownerType: 'ecclesia',
    ownerId: 'toronto-east-ecclesia',
    name: 'Youth',
    description: '',
    category: 'newsletters',
    status: 'active',
  },
]

const getReq = () => ({ url: 'https://tee-admin.com/api/subscribe', headers: new Headers() }) as any
const postReq = (body: any) => ({ json: async () => body, headers: new Headers() }) as any

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'reader@example.org', role: 'member' } })
  h.getContact.mockResolvedValue({
    TopicPreferences: [{ TopicName: 'newsletter', SubscriptionStatus: 'OPT_IN' }],
    UnsubscribeAll: false,
  })
  h.sesSend.mockResolvedValue({})
  h.listAllLists.mockResolvedValue(LISTS)
  h.getOffered.mockResolvedValue(LISTS)
  h.getRows.mockResolvedValue([])
  h.getByEmail.mockResolvedValue({ personId: 'p1', ecclesia: 'Toronto East Ecclesia' })
  h.setListSubscription.mockResolvedValue('subscribed')
})

describe('flag OFF — unchanged', () => {
  beforeEach(() => h.flag.mockResolvedValue(false))

  it('GET has the topic toggles and no listGroups; the registry is not read', async () => {
    const body = await (await GET(getReq())).json()
    expect(body.subscriptions.find((s: any) => s.topic === 'newsletter').subscribed).toBe(true)
    expect(body).not.toHaveProperty('listGroups')
    expect(h.listAllLists).not.toHaveBeenCalled()
  })

  it('POST with lists is refused (404) and writes nothing', async () => {
    const res = await POST(postReq({ lists: { 'L-NEW': true } }))
    expect(res.status).toBe(404)
    expect(h.sesSend).not.toHaveBeenCalled()
    expect(h.setListSubscription).not.toHaveBeenCalled()
  })

  it('POST with topics still updates SES exactly as before', async () => {
    const res = await POST(postReq({ subscriptions: { bibleClass: true } }))
    expect(res.status).toBe(200)
    const cmd = h.sesSend.mock.calls[0][0]
    expect(cmd.kind).toBe('update')
    expect(cmd.input.TopicPreferences).toEqual(
      expect.arrayContaining([
        { TopicName: 'newsletter', SubscriptionStatus: 'OPT_IN' },
        { TopicName: 'bibleClass', SubscriptionStatus: 'OPT_IN' },
      ])
    )
  })
})

describe('flag ON — lists', () => {
  beforeEach(() => h.flag.mockResolvedValue(true))

  it('GET groups every offered list by owner with derived names', async () => {
    const body = await (await GET(getReq())).json()
    expect(body.listGroups).toEqual([
      {
        ownerType: 'ecclesia',
        ownerId: 'toronto-east-ecclesia',
        ownerName: 'Toronto East',
        lists: [
          { listId: 'L-NEWS', name: 'Toronto East Newsletter', description: 'Thursday', subscribed: true },
          { listId: 'L-NEW', name: 'Toronto East Youth', description: '', subscribed: false },
        ],
      },
    ])
    expect(h.getOffered).toHaveBeenCalledWith({ ecclesiaId: 'toronto-east-ecclesia' }, 'canada_east')
  })

  it('POST writes the registry for each list and the SES topic for a bridged one', async () => {
    const res = await POST(postReq({ lists: { 'L-NEWS': false, 'L-NEW': true, bogus: true } }))
    expect(res.status).toBe(200)
    expect(h.setListSubscription.mock.calls.map((c) => c[0])).toEqual([
      { listId: 'L-NEWS', email: 'reader@example.org', subscribed: false },
      { listId: 'L-NEW', email: 'reader@example.org', subscribed: true },
    ])
    const prefs = h.sesSend.mock.calls[0][0].input.TopicPreferences
    expect(prefs).toEqual([{ TopicName: 'newsletter', SubscriptionStatus: 'OPT_OUT' }])
  })

  it('a token-only (recognized) caller still cannot save', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(postReq({ token: 'nope', lists: { 'L-NEW': true } }))
    expect(res.status).toBe(401)
    expect(h.setListSubscription).not.toHaveBeenCalled()
  })
})
