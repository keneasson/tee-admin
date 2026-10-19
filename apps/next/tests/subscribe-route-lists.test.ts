import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * /api/subscribe (R5): every offered list, grouped by owner, read from the
 * registry; saving writes the registry ONLY (no SES topic, ever) plus SES
 * UnsubscribeAll for "stop all email".
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  getContact: vi.fn(),
  setUnsubscribeAll: vi.fn(),
  sesSend: vi.fn(),
  listAllLists: vi.fn(),
  getOffered: vi.fn(),
  getRows: vi.fn(),
  getByEmail: vi.fn(),
  setListSubscription: vi.fn(),
  resolveSubscriber: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@aws-sdk/client-sesv2', () => ({
  UpdateContactCommand: vi.fn().mockImplementation((input) => ({ kind: 'update', input })),
  CreateContactCommand: vi.fn().mockImplementation((input) => ({ kind: 'create', input })),
  SubscriptionStatus: { OPT_IN: 'OPT_IN', OPT_OUT: 'OPT_OUT' },
}))
vi.mock('@/utils/email/sesClient', () => ({ getSesClient: () => ({ send: h.sesSend }) }))
vi.mock('@/utils/email/contact', () => ({ getContact: h.getContact, setUnsubscribeAll: h.setUnsubscribeAll }))
vi.mock('@/utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: vi.fn(async () => ({ valid: false })) }))
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
  resolveSubscriber: h.resolveSubscriber,
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
  h.resolveSubscriber.mockResolvedValue({ personId: 'p1', emailId: 'e1', email: 'reader@example.org' })
  h.setListSubscription.mockResolvedValue('subscribed')
})

describe('/api/subscribe — registry only', () => {
  it('GET groups every offered list by owner with derived names; state from the registry, never a topic', async () => {
    h.getRows.mockImplementation(async (listId: string) =>
      listId === 'L-NEW' ? [{ status: 'opt_in' }] : []
    )
    const body = await (await GET(getReq())).json()
    expect(body.listGroups).toEqual([
      {
        ownerType: 'ecclesia',
        ownerId: 'toronto-east-ecclesia',
        ownerName: 'Toronto East',
        lists: [
          // SES still says OPT_IN for 'newsletter': ignored, the registry has no row.
          { listId: 'L-NEWS', name: 'Toronto East Newsletter', description: 'Thursday', subscribed: false },
          { listId: 'L-NEW', name: 'Toronto East Youth', description: '', subscribed: true },
        ],
      },
    ])
    expect(body).not.toHaveProperty('subscriptions')
    expect(body.unsubscribedAll).toBe(false)
    expect(h.getOffered).toHaveBeenCalledWith({ ecclesiaId: 'toronto-east-ecclesia' }, 'canada_east')
  })

  it('POST writes the registry for CHANGED lists only and never an SES topic', async () => {
    const res = await POST(postReq({ lists: { 'L-NEWS': false, 'L-NEW': true, bogus: true } }))
    expect(res.status).toBe(200)
    // L-NEWS is already off (no row): unchanged, not written.
    expect(h.setListSubscription.mock.calls.map((c) => c[0])).toEqual([
      { listId: 'L-NEW', email: 'reader@example.org', subscribed: true, defaultOptIn: false },
    ])
    expect(h.sesSend).not.toHaveBeenCalled()
    expect(h.setUnsubscribeAll).not.toHaveBeenCalled()
  })

  it('POST unsubscribeAll writes SES UnsubscribeAll (the "stop all email" that stays in SES)', async () => {
    const res = await POST(postReq({ lists: {}, unsubscribeAll: true }))
    expect(res.status).toBe(200)
    expect(h.setUnsubscribeAll).toHaveBeenCalledWith('reader@example.org', true)
    expect(h.sesSend).not.toHaveBeenCalled()
  })

  it('POST with lists for an address no person holds changes nothing (409)', async () => {
    h.resolveSubscriber.mockResolvedValue(null)
    const res = await POST(postReq({ lists: { 'L-NEW': true }, unsubscribeAll: true }))
    expect(res.status).toBe(409)
    expect(h.setListSubscription).not.toHaveBeenCalled()
    expect(h.setUnsubscribeAll).not.toHaveBeenCalled()
  })

  it('a token-only (recognized) caller still cannot save', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(postReq({ token: 'nope', lists: { 'L-NEW': true } }))
    expect(res.status).toBe(401)
    expect(h.setListSubscription).not.toHaveBeenCalled()
  })
})
