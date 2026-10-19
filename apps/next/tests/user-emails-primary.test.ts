import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * The profile Email section shows which address is PRIMARY (the sign-in and
 * account email, PROFILE.primaryEmail), which mailing lists send to each
 * address, and "Make primary" really moves the primary.
 *
 * The bug: "set preferred" only reordered rows, the EMAIL# `emailType` label
 * had drifted from PROFILE.primaryEmail, so no address showed as primary.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  u_getEmails: vi.fn(),
  p_getByEmail: vi.fn(),
  p_getAllPersonsByEmail: vi.fn(),
  p_getEmails: vi.fn(),
  p_getEmailById: vi.fn(),
  p_removeEmail: vi.fn(),
  p_changePrimaryEmail: vi.fn(),
  t_getByPersonAndType: vi.fn(),
  m_getPersonSubscriptions: vi.fn(),
  m_listAllLists: vi.fn(),
  flag: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/user-repository', () => ({
  userRepository: { getEmails: h.u_getEmails },
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: h.p_getByEmail,
    getAllPersonsByEmail: h.p_getAllPersonsByEmail,
    getEmails: h.p_getEmails,
    getEmailById: h.p_getEmailById,
    removeEmail: h.p_removeEmail,
    changePrimaryEmail: h.p_changePrimaryEmail,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/token-repository', () => ({
  tokenRepository: { getByPersonAndType: h.t_getByPersonAndType },
}))
vi.mock('@my/app/provider/dynamodb/repositories/mailing-list-repository', () => ({
  mailingListRepository: {
    getPersonSubscriptions: h.m_getPersonSubscriptions,
    listAllLists: h.m_listAllLists,
  },
}))
vi.mock('../utils/mailing-lists/owners', async () => {
  const actual = await vi.importActual<any>('../utils/mailing-lists/owners')
  return {
    ...actual,
    ownerNamesFor: vi.fn(async () => new Map([['ecclesia#toronto-east', 'Toronto East Ecclesia']])),
  }
})
vi.mock('../utils/email/public-topics', () => ({ getPublicOptInCount: vi.fn(async () => 0) }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({ checkFeatureFlagFromDB: h.flag }))
vi.mock('../utils/email/notify-login-email-changed', () => ({ notifyLoginEmailChanged: h.notify }))

import { GET, DELETE } from '../app/api/user/emails/route'
import { POST as PROMOTE } from '../app/api/user/email-change/promote/route'

const FRESH = { user: { email: 'alias@example.org', assuranceLevel: 'authenticated', authTime: Date.now() } }
// PROFILE.primaryEmail is an alias with NO EMAIL# row; the rows are all secondary.
const ME = { personId: 'p-1', primaryEmail: 'alias@example.org', emailVerified: '2026-01-01T00:00:00.000Z' }
const ROWS = [
  { emailId: 'e-real', email: 'real@example.org', emailType: 'secondary', verified: true, order: 0 },
  { emailId: 'e-new', email: 'new@example.org', emailType: 'secondary', verified: false, order: 1 },
]
const LISTS = [
  { listId: 'l-news', ownerType: 'ecclesia', ownerId: 'toronto-east', name: 'Newsletter', status: 'active' },
  { listId: 'l-recap', ownerType: 'ecclesia', ownerId: 'toronto-east', name: 'Memorial Recap', status: 'active' },
]

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(FRESH)
  h.u_getEmails.mockResolvedValue({ items: [] })
  h.p_getByEmail.mockResolvedValue(ME)
  h.p_getAllPersonsByEmail.mockResolvedValue([ME])
  h.p_getEmails.mockResolvedValue(ROWS)
  h.t_getByPersonAndType.mockResolvedValue([])
  h.m_getPersonSubscriptions.mockResolvedValue([
    { listId: 'l-news', email: 'real@example.org', status: 'opt_in' },
    { listId: 'l-recap', email: 'real@example.org', status: 'opt_in' },
    { listId: 'l-recap', email: 'alias@example.org', status: 'opt_out' },
  ])
  h.m_listAllLists.mockResolvedValue(LISTS)
  h.flag.mockResolvedValue(true)
  h.p_changePrimaryEmail.mockResolvedValue({ newEmailId: 'e-real', oldEmail: 'alias@example.org' })
})

describe('GET /api/user/emails — the primary and its lists', () => {
  it('marks PROFILE.primaryEmail as the one primary, even with no EMAIL# row for it', async () => {
    const body = await (await GET()).json()
    const primary = body.emails.filter((e: any) => e.isPrimary)
    expect(primary).toHaveLength(1)
    expect(primary[0]).toMatchObject({ id: 'profile-primary', email: 'alias@example.org', verified: true })
    expect(body.emails[0].email).toBe('alias@example.org') // primary first
  })

  it('never takes the EMAIL# label over PROFILE.primaryEmail', async () => {
    h.p_getEmails.mockResolvedValue([
      { ...ROWS[0], emailType: 'primary' }, // a drifted label
      { emailId: 'e-alias', email: 'alias@example.org', emailType: 'secondary', verified: true, order: 2 },
    ])
    const body = await (await GET()).json()
    expect(body.emails.filter((e: any) => e.isPrimary).map((e: any) => e.email)).toEqual(['alias@example.org'])
  })

  it('shows, per address, the mailing lists that send to it (opt-ins only)', async () => {
    const body = await (await GET()).json()
    const byEmail = Object.fromEntries(body.emails.map((e: any) => [e.email, e.mailingLists]))
    expect(byEmail['real@example.org']).toEqual(['Toronto East Memorial Recap', 'Toronto East Newsletter'])
    expect(byEmail['alias@example.org']).toEqual([])
  })

  it('a failed list read never fails the page', async () => {
    h.m_getPersonSubscriptions.mockRejectedValue(new Error('boom'))
    const res = await GET()
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/user/emails — the primary is protected by PROFILE, not the label', () => {
  it('refuses to delete the row holding PROFILE.primaryEmail even if labelled secondary', async () => {
    h.p_getEmailById.mockResolvedValue({ emailId: 'e-alias', email: 'alias@example.org', emailType: 'secondary' })
    const res = await DELETE({ url: 'http://x/api/user/emails?emailId=e-alias' } as any)
    expect(res.status).toBe(400)
    expect(h.p_removeEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/user/email-change/promote — Make primary', () => {
  const req = (email: string) => ({ json: async () => ({ email }), headers: new Headers() }) as any

  it('moves PROFILE.primaryEmail (and the EMAIL# primary marker) to a verified address', async () => {
    const res = await PROMOTE(req('Real@Example.org'))
    expect(res.status).toBe(200)
    expect(h.p_changePrimaryEmail).toHaveBeenCalledWith('p-1', 'real@example.org')
    expect(h.notify).toHaveBeenCalledWith(expect.objectContaining({ oldEmail: 'alias@example.org', newEmail: 'real@example.org' }))
  })

  it('works when a drifted EMAIL# label already says "primary"', async () => {
    h.p_getEmails.mockResolvedValue([{ ...ROWS[0], emailType: 'primary' }])
    const res = await PROMOTE(req('real@example.org'))
    expect(res.status).toBe(200)
    expect(h.p_changePrimaryEmail).toHaveBeenCalled()
  })

  it('refuses an unverified address', async () => {
    const res = await PROMOTE(req('new@example.org'))
    expect(res.status).toBe(400)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('refuses the address that is already primary', async () => {
    h.p_getEmails.mockResolvedValue([
      { emailId: 'e-alias', email: 'alias@example.org', emailType: 'secondary', verified: true },
    ])
    const res = await PROMOTE(req('alias@example.org'))
    expect(res.status).toBe(400)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('requires a fresh step-up', async () => {
    h.auth.mockResolvedValue({ user: { email: 'alias@example.org', assuranceLevel: 'recognized' } })
    const res = await PROMOTE(req('real@example.org'))
    expect(res.status).toBe(403)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })
})
