import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * /api/subscribe: an email link is about the address the email was sent to,
 * even when the reader is signed in with another of their addresses. Owner,
 * 2026-10-21: the Bible Class email went to his main address, but the page
 * showed his signed-in "+123" address.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  verify: vi.fn(),
  me: vi.fn(),
  holders: vi.fn(),
  getRows: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: h.me }))
vi.mock('@/utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: h.verify }))
vi.mock('@/utils/email/contact', () => ({ getContact: vi.fn(async () => null), setUnsubscribeAll: vi.fn() }))
vi.mock('@my/app/config/tenants', () => ({
  getTenantFromHeaders: () => null,
  resolveTenantFromEnv: () => ({ id: 'tee', publicName: 'Toronto East', senderDomain: 'tee-admin.com' }),
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: vi.fn(async () => null),
    getByEmailForAuth: vi.fn(async () => ({ firstName: 'Reader' })),
    getAllPersonsByEmail: h.holders,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/mailing-list-repository', () => ({
  mailingListRepository: {
    listAllLists: vi.fn(async () => [
      { listId: 'L-BC', ownerType: 'ecclesia', ownerId: 'tee', name: 'Bible Class', description: 'Wednesday', category: 'newsletters', status: 'active', sesTopic: 'bible-class' },
    ]),
    getOfferedListsForPerson: vi.fn(async () => []),
    getListSubscriptionsForEmail: h.getRows,
  },
}))
vi.mock('@/utils/dynamodb/locations', () => ({ listEcclesiasCached: vi.fn(async () => []) }))
vi.mock('@/utils/mailing-lists/owners', async (orig) => ({
  ...(await orig<typeof import('../utils/mailing-lists/owners')>()),
  ownerNamesFor: vi.fn(async () => new Map([['ecclesia#tee', 'Toronto East Ecclesia']])),
}))
vi.mock('@/utils/mailing-lists/subscriptions', () => ({
  defaultSubscriptionDeps: vi.fn(async () => ({})),
  setListSubscription: vi.fn(),
  resolveSubscriber: vi.fn(),
}))

import { GET } from '../app/api/subscribe/route'

const get = (token?: string) =>
  GET(new Request(`http://x/api/subscribe${token ? `?token=${token}` : ''}`) as any).then((r) => r.json())

describe('/api/subscribe: which address the page is about', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.verify.mockResolvedValue({ valid: true, email: 'Main@Example.org' })
    h.me.mockResolvedValue({ personId: 'ken' })
    // The Bible Class row is on the address the email went to.
    h.getRows.mockImplementation(async (_l: string, email: string) =>
      email === 'main@example.org' ? [{ status: 'opt_in' }] : []
    )
  })

  it("shows the address the email went to, signed in as its holder through another address", async () => {
    h.auth.mockResolvedValue({ user: { email: 'main+123@example.org', personId: 'ken' } })
    h.holders.mockResolvedValue([{ personId: 'ken' }])
    const d = await get('tok')
    expect(d.email).toBe('main@example.org')
    expect(d.authenticated).toBe(true)
    expect(d.listGroups[0].lists[0].subscribed).toBe(true)
  })

  it("keeps someone else's address masked and read-only, even when signed in", async () => {
    h.auth.mockResolvedValue({ user: { email: 'other@example.org', personId: 'other' } })
    h.me.mockResolvedValue({ personId: 'other' })
    h.holders.mockResolvedValue([{ personId: 'ken' }])
    const d = await get('tok')
    expect(d.email).toBeNull()
    expect(d.authenticated).toBe(false)
    expect(d.emailMasked).not.toContain('other')
  })

  it('with no link, a signed-in reader manages their sign-in address', async () => {
    h.auth.mockResolvedValue({ user: { email: 'main+123@example.org', personId: 'ken' } })
    h.verify.mockResolvedValue({ valid: false })
    const d = await get()
    expect(d.email).toBe('main+123@example.org')
    expect(d.authenticated).toBe(true)
  })
})
