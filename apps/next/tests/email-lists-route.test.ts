import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * GET /api/admin/email/search — the Email Lists overview (#276).
 * Owner/admin only; reads person cards, the mailing-list registry (R5) and an
 * SES snapshot; never writes.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  ready: vi.fn(),
  cards: vi.fn(),
  contacts: vi.fn(),
  suppressed: vi.fn(),
  lists: vi.fn(),
  subscribers: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/people-index', () => ({
  peopleIndexReady: h.ready,
  listPeopleCards: h.cards,
}))
vi.mock('@/utils/email/ses-snapshot', () => ({
  listAllSesContacts: h.contacts,
  listSuppressedAddresses: h.suppressed,
}))
vi.mock('@my/app/provider/dynamodb/repositories/mailing-list-repository', () => ({
  mailingListRepository: { listAllLists: h.lists, listSubscribers: h.subscribers },
}))
vi.mock('../utils/mailing-lists/owners', async (orig) => ({
  ...(await orig<typeof import('../utils/mailing-lists/owners')>()),
  ownerNamesFor: vi.fn(async () => new Map([['ecclesia#toronto-east-ecclesia', 'Toronto East Ecclesia']])),
}))
// The route reads subscriptions only through the subscription-source seam
// (the real one, which wraps the mocked SES snapshot above).

import { GET } from '../app/api/admin/email/search/route'

beforeEach(() => {
  vi.clearAllMocks()
  h.ready.mockResolvedValue(true)
  h.cards.mockResolvedValue([
    { personId: 'a', displayName: 'A One', firstName: 'A', lastName: 'One', primaryEmail: 'shared@example.org', emails: [{ email: 'shared@example.org', emailType: 'primary' }] },
    { personId: 'b', displayName: 'B Two', firstName: 'B', lastName: 'Two', primaryEmail: 'shared@example.org', emails: [{ email: 'shared@example.org', emailType: 'primary' }] },
  ])
  // SES still holds a legacy topic opt-in: the page must NOT read it as a subscription.
  h.contacts.mockResolvedValue([{ email: 'shared@example.org', topics: { newsletter: 'OPT_IN', memorial: 'OPT_IN' } }])
  h.suppressed.mockResolvedValue([])
  h.lists.mockResolvedValue([
    { listId: 'L-NEWS', ownerType: 'ecclesia', ownerId: 'toronto-east-ecclesia', name: 'Newsletter', status: 'active', defaultOptIn: false },
    { listId: 'L-MEM', ownerType: 'ecclesia', ownerId: 'toronto-east-ecclesia', name: 'Memorial Recap', status: 'active', defaultOptIn: false },
  ])
  h.subscribers.mockImplementation(async (listId: string) =>
    listId === 'L-NEWS' ? [{ email: 'Shared@example.org', status: 'opt_in' }] : []
  )
})

describe('GET /api/admin/email/search', () => {
  it('is owner only: anonymous 401, every other role 403', async () => {
    h.auth.mockResolvedValueOnce(null)
    expect((await GET()).status).toBe(401)
    for (const role of ['admin', 'rep', 'member', 'guest']) {
      h.auth.mockResolvedValueOnce({ user: { email: 'm@example.org', role } })
      expect((await GET()).status).toBe(403)
    }
    expect(h.cards).not.toHaveBeenCalled()
    expect(h.contacts).not.toHaveBeenCalled()
  })

  it('refuses (503) until the people index is built, rather than falling back to a Scan', async () => {
    h.auth.mockResolvedValue({ user: { email: 'o@example.org', role: 'owner' } })
    h.ready.mockResolvedValue(false)
    expect((await GET()).status).toBe(503)
    expect(h.cards).not.toHaveBeenCalled()
  })

  it('returns one card per person, the shared address on both', async () => {
    h.auth.mockResolvedValue({ user: { email: 'o@example.org', role: 'owner' } })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.people.map((p: any) => p.personId)).toEqual(['a', 'b'])
    expect(body.people.map((p: any) => p.emails[0].sharedWith)).toEqual([['b'], ['a']])
    expect(body.findings.sharedAddresses).toEqual([{ email: 'shared@example.org', personIds: ['a', 'b'] }])
    expect(body.subscriptionSource).toBe('registry')
    expect(body.topics.map((t: any) => t.displayName)).toEqual(['Toronto East Memorial Recap', 'Toronto East Newsletter'])
    // From the registry only: the SES 'memorial' opt-in is ignored.
    expect(body.people[0].emails[0].ses.topics).toEqual({ 'L-MEM': false, 'L-NEWS': true })
  })
})
