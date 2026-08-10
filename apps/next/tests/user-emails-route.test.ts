import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * POST /api/user/emails — adding a secondary email, PersonRecord-only.
 *
 * Email is consolidated onto the PersonRecord EMAIL# store (the single system):
 * the address is written ONLY to the PersonRecord as a SECONDARY item (no legacy
 * USER# write). Guards: attaching an address that already belongs to a DIFFERENT
 * person is a collision (409); re-adding an address this person already has is a
 * duplicate (409).
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  u_getEmails: vi.fn(),
  p_getByEmail: vi.fn(),
  p_getAllPersonsByEmail: vi.fn(),
  p_getEmails: vi.fn(),
  p_addEmail: vi.fn(),
  t_getByPersonAndType: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/provider/dynamodb/repositories/user-repository', () => ({
  userRepository: { getEmails: h.u_getEmails },
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getByEmail: h.p_getByEmail,
    getAllPersonsByEmail: h.p_getAllPersonsByEmail,
    getEmails: h.p_getEmails,
    addEmail: h.p_addEmail,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/token-repository', () => ({
  tokenRepository: { getByPersonAndType: h.t_getByPersonAndType },
}))
vi.mock('../utils/email/public-topics', () => ({ getPublicOptInCount: vi.fn() }))

import { POST } from '../app/api/user/emails/route'

const req = (body: any) => ({ json: async () => body }) as any
// A FRESHLY-authenticated session: adding an email is gated by requireFreshAuth
// (requireAssurance('authenticated') + isRecentlyAuthenticated), so the caller
// must have a recent `authTime`. This is the normal post-step-up state.
const ME = {
  user: { email: 'gord@yahoo.com', assuranceLevel: 'authenticated', authTime: Date.now() },
}
const GORD = { personId: 'gord-1', primaryEmail: 'gord@yahoo.com' }

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(ME)
  h.u_getEmails.mockResolvedValue({ items: [] })
  h.p_getByEmail.mockResolvedValue(GORD)
  h.p_getAllPersonsByEmail.mockResolvedValue([]) // address free
  h.p_getEmails.mockResolvedValue([])
  h.p_addEmail.mockResolvedValue({ emailId: 'new-email-id', email: 'gord@gmail.com', emailType: 'secondary' })
  h.t_getByPersonAndType.mockResolvedValue([])
})

describe('POST /api/user/emails', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(req({ email: 'x@y.com' }))
    expect(res.status).toBe(401)
  })

  it('403 stepUpRequired when the session is not freshly authenticated', async () => {
    // A recognized-tier or stale session (no fresh authTime) must step up first.
    h.auth.mockResolvedValue({ user: { email: 'gord@yahoo.com', assuranceLevel: 'recognized' } })
    const res = await POST(req({ email: 'x@y.com' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.stepUpRequired).toBe(true)
    expect(h.p_addEmail).not.toHaveBeenCalled()
  })

  it('400 on an invalid email', async () => {
    const res = await POST(req({ email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })

  it('writes the address to the PersonRecord ONLY, as a SECONDARY email', async () => {
    const res = await POST(req({ email: 'Gord@Gmail.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.emailId).toBe('new-email-id')
    // PersonRecord EMAIL# item written, lowercased, as secondary
    expect(h.p_addEmail).toHaveBeenCalledTimes(1)
    const [pid, rec] = h.p_addEmail.mock.calls[0]
    expect(pid).toBe('gord-1')
    expect(rec.email).toBe('gord@gmail.com')
    expect(rec.emailType).toBe('secondary')
    expect(rec.verified).toBe(false)
  })

  it('409 when the address already belongs to a DIFFERENT person', async () => {
    h.p_getAllPersonsByEmail.mockResolvedValue([{ personId: 'someone-else' }])
    const res = await POST(req({ email: 'shared@example.com' }))
    expect(res.status).toBe(409)
    expect(h.p_addEmail).not.toHaveBeenCalled()
  })

  it('409 when this person already has the address (duplicate)', async () => {
    h.p_getEmails.mockResolvedValue([{ emailId: 'x', email: 'gord@gmail.com', emailType: 'secondary' }])
    const res = await POST(req({ email: 'gord@gmail.com' }))
    expect(res.status).toBe(409)
    expect(h.p_addEmail).not.toHaveBeenCalled()
  })
})
