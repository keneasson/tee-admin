import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * GET /api/admin/email/search — the Email Lists overview (#276).
 * Owner/admin only; reads person cards + an SES snapshot; never writes.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  ready: vi.fn(),
  cards: vi.fn(),
  contacts: vi.fn(),
  suppressed: vi.fn(),
  topics: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/people-index', () => ({
  peopleIndexReady: h.ready,
  listPeopleCards: h.cards,
}))
vi.mock('@/utils/email/ses-snapshot', () => ({
  listAllSesContacts: h.contacts,
  listSuppressedAddresses: h.suppressed,
  listSesTopics: h.topics,
}))

import { GET } from '../app/api/admin/email/search/route'

beforeEach(() => {
  vi.clearAllMocks()
  h.ready.mockResolvedValue(true)
  h.cards.mockResolvedValue([
    { personId: 'a', displayName: 'A One', firstName: 'A', lastName: 'One', primaryEmail: 'shared@x.org', emails: [{ email: 'shared@x.org', emailType: 'primary' }] },
    { personId: 'b', displayName: 'B Two', firstName: 'B', lastName: 'Two', primaryEmail: 'shared@x.org', emails: [{ email: 'shared@x.org', emailType: 'primary' }] },
  ])
  h.contacts.mockResolvedValue([{ email: 'shared@x.org', topics: { newsletter: 'OPT_IN' } }])
  h.suppressed.mockResolvedValue([])
  h.topics.mockResolvedValue([{ name: 'newsletter', displayName: 'Newsletter' }])
})

describe('GET /api/admin/email/search', () => {
  it('rejects anyone below admin', async () => {
    for (const session of [null, { user: { email: 'm@x.org', role: 'member' } }]) {
      h.auth.mockResolvedValueOnce(session)
      expect((await GET()).status).toBe(401)
    }
    expect(h.cards).not.toHaveBeenCalled()
    expect(h.contacts).not.toHaveBeenCalled()
  })

  it('refuses (503) until the people index is built, rather than falling back to a Scan', async () => {
    h.auth.mockResolvedValue({ user: { email: 'o@x.org', role: 'owner' } })
    h.ready.mockResolvedValue(false)
    expect((await GET()).status).toBe(503)
    expect(h.cards).not.toHaveBeenCalled()
  })

  it('returns one card per person, the shared address on both', async () => {
    h.auth.mockResolvedValue({ user: { email: 'o@x.org', role: 'admin' } })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.people.map((p: any) => p.personId)).toEqual(['a', 'b'])
    expect(body.people.map((p: any) => p.emails[0].sharedWith)).toEqual([['b'], ['a']])
    expect(body.findings.sharedAddresses).toEqual([{ email: 'shared@x.org', personIds: ['a', 'b'] }])
  })
})
