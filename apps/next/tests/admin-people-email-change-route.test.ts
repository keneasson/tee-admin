import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * POST /api/admin/people/[personId]/email-change — RB/Rep "assist a member".
 *
 * Covers the auth gate that keeps the operation safe:
 *  - 400 when the actor targets their OWN primary (that's the self-serve flow).
 *  - 403 when the actor can't edit the TARGET's ecclesia.
 *  - happy path: identity transfer + subscription move + notify + cache bust.
 */

const h = vi.hoisted(() => ({
  requireAssurance: vi.fn(),
  checkEcclesiaEditPermission: vi.fn(),
  migrateSubscriptions: vi.fn(),
  notifyLoginEmailChanged: vi.fn(),
  invalidatePeopleCache: vi.fn(),
  p_getById: vi.fn(),
  p_getByEmail: vi.fn(),
  p_getEmails: vi.fn(),
  p_getAllPersonsByEmail: vi.fn(),
  p_changePrimaryEmail: vi.fn(),
  p_correctSecondaryEmail: vi.fn(),
}))

vi.mock('../utils/auth-trust', () => ({ requireAssurance: h.requireAssurance }))
vi.mock('../utils/ecclesia-permissions', () => ({
  checkEcclesiaEditPermission: h.checkEcclesiaEditPermission,
}))
vi.mock('../utils/email/contact', () => ({ migrateSubscriptions: h.migrateSubscriptions }))
vi.mock('../utils/email/notify-login-email-changed', () => ({
  notifyLoginEmailChanged: h.notifyLoginEmailChanged,
}))
vi.mock('../app/api/people/cache', () => ({ invalidatePeopleCache: h.invalidatePeopleCache }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getById: h.p_getById,
    getByEmail: h.p_getByEmail,
    getEmails: h.p_getEmails,
    getAllPersonsByEmail: h.p_getAllPersonsByEmail,
    changePrimaryEmail: h.p_changePrimaryEmail,
    correctSecondaryEmail: h.p_correctSecondaryEmail,
  },
}))

import { POST } from '../app/api/admin/people/[personId]/email-change/route'

const ACTOR = 'rb@teecclesia.example'
const TARGET_PRIMARY = 'member@teecclesia.example'
const PID = 'target-1'

function makeReq(body: any) {
  return {
    json: async () => body,
    headers: new Headers(),
  } as any
}

const params = Promise.resolve({ personId: PID })

beforeEach(() => {
  vi.clearAllMocks()
  h.requireAssurance.mockResolvedValue({
    ok: true,
    ctx: { email: ACTOR, session: { user: { email: ACTOR, role: 'rep' } } },
  })
  h.p_getByEmail.mockResolvedValue({ personId: 'actor-1', role: 'rep', ecclesia: 'Toronto East' })
  h.checkEcclesiaEditPermission.mockResolvedValue(true)
  h.p_getAllPersonsByEmail.mockResolvedValue([])
  h.p_changePrimaryEmail.mockResolvedValue({ newEmailId: 'x', oldEmail: TARGET_PRIMARY })
  h.migrateSubscriptions.mockResolvedValue({ movedTopics: ['newsletter'] })
})

describe('POST /api/admin/people/[personId]/email-change', () => {
  it('403 when the actor cannot edit the target ecclesia', async () => {
    h.p_getById.mockResolvedValue({
      personId: PID,
      primaryEmail: TARGET_PRIMARY,
      ecclesia: 'Some Other Ecclesia',
    })
    h.checkEcclesiaEditPermission.mockResolvedValue(false)

    const res = await POST(makeReq({ newEmail: 'brand-new@x.example' }), { params })
    expect(res.status).toBe(403)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('400 when the actor targets their OWN primary (self-serve flow)', async () => {
    // Actor IS the target: their email equals the target primary.
    h.requireAssurance.mockResolvedValue({
      ok: true,
      ctx: { email: TARGET_PRIMARY, session: { user: { email: TARGET_PRIMARY, role: 'rep' } } },
    })
    h.p_getById.mockResolvedValue({
      personId: PID,
      primaryEmail: TARGET_PRIMARY,
      ecclesia: 'Toronto East',
    })

    const res = await POST(makeReq({ newEmail: 'brand-new@x.example' }), { params })
    expect(res.status).toBe(400)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('404 when the target person does not exist', async () => {
    h.p_getById.mockResolvedValue(null)
    const res = await POST(makeReq({ newEmail: 'brand-new@x.example' }), { params })
    expect(res.status).toBe(404)
  })

  it('409 when the new address belongs to a different person', async () => {
    h.p_getById.mockResolvedValue({
      personId: PID,
      primaryEmail: TARGET_PRIMARY,
      ecclesia: 'Toronto East',
    })
    h.p_getAllPersonsByEmail.mockResolvedValue([{ personId: 'someone-else' }])

    const res = await POST(makeReq({ newEmail: 'taken@x.example' }), { params })
    expect(res.status).toBe(409)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('change mode: transfers identity, moves subscriptions, notifies, busts cache', async () => {
    h.p_getById.mockResolvedValue({
      personId: PID,
      primaryEmail: TARGET_PRIMARY,
      ecclesia: 'Toronto East',
    })

    const res = await POST(makeReq({ newEmail: 'brand-new@x.example' }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, newEmail: 'brand-new@x.example', movedTopics: ['newsletter'] })

    expect(h.p_changePrimaryEmail).toHaveBeenCalledWith(PID, 'brand-new@x.example', { replace: false })
    expect(h.migrateSubscriptions).toHaveBeenCalledWith(TARGET_PRIMARY, 'brand-new@x.example', {
      personId: PID,
    })
    expect(h.notifyLoginEmailChanged).toHaveBeenCalled()
    expect(h.invalidatePeopleCache).toHaveBeenCalled()
  })

  it('promote mode: promotes an existing verified secondary', async () => {
    h.p_getById.mockResolvedValue({
      personId: PID,
      primaryEmail: TARGET_PRIMARY,
      ecclesia: 'Toronto East',
    })
    h.p_getEmails.mockResolvedValue([
      { emailId: 'sec-1', email: 'secondary@x.example', emailType: 'secondary', verified: true },
    ])
    h.p_changePrimaryEmail.mockResolvedValue({ newEmailId: 'sec-1', oldEmail: TARGET_PRIMARY })

    const res = await POST(makeReq({ promoteEmailId: 'sec-1' }), { params })
    expect(res.status).toBe(200)
    expect(h.p_changePrimaryEmail).toHaveBeenCalledWith(PID, 'secondary@x.example', { replace: false })
  })

  it('promote mode: rejects an unverified secondary', async () => {
    h.p_getById.mockResolvedValue({
      personId: PID,
      primaryEmail: TARGET_PRIMARY,
      ecclesia: 'Toronto East',
    })
    h.p_getEmails.mockResolvedValue([
      { emailId: 'sec-1', email: 'secondary@x.example', emailType: 'secondary', verified: false },
    ])

    const res = await POST(makeReq({ promoteEmailId: 'sec-1' }), { params })
    expect(res.status).toBe(400)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })
})

// #190: the member page's pencil — correct an address in one step.
describe('correction mode { correctEmailId, newEmail }', () => {
  const TYPO = 'jaredandrews1921@gmail.com'
  const RIGHT = 'jaredandrews1971@gmail.com'
  beforeEach(() => {
    h.p_getById.mockResolvedValue({ personId: PID, primaryEmail: TYPO, ecclesia: 'Cambridge Ecclesia' })
    h.p_changePrimaryEmail.mockResolvedValue({ newEmailId: 'n', oldEmail: TYPO })
    h.migrateSubscriptions.mockResolvedValue({ movedTopics: [] })
  })

  it('sign-in row (the Jared case): moves login, REMOVES the typo, never emails it', async () => {
    h.p_getEmails.mockResolvedValue([{ emailId: 'e1', email: TYPO, emailType: 'primary', verified: true }])
    const res = await POST(makeReq({ correctEmailId: 'e1', newEmail: ' JaredAndrews1971@gmail.com ' }), { params })
    expect(res.status).toBe(200)
    expect(h.p_changePrimaryEmail).toHaveBeenCalledWith(PID, RIGHT, { replace: true })
    expect(h.notifyLoginEmailChanged).not.toHaveBeenCalled()
    expect(h.migrateSubscriptions).toHaveBeenCalledWith(TYPO, RIGHT, { personId: PID })
    expect(h.invalidatePeopleCache).toHaveBeenCalled()
  })

  it('secondary row: fixed in place, sign-in untouched', async () => {
    h.p_getEmails.mockResolvedValue([
      { emailId: 'e1', email: TYPO, emailType: 'primary', verified: true },
      { emailId: 'e2', email: 'old@x.example', emailType: 'secondary', verified: false },
    ])
    const res = await POST(makeReq({ correctEmailId: 'e2', newEmail: 'fixed@x.example' }), { params })
    expect(res.status).toBe(200)
    expect(h.p_correctSecondaryEmail).toHaveBeenCalledWith(PID, 'e2', 'fixed@x.example')
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
    expect(h.notifyLoginEmailChanged).not.toHaveBeenCalled()
  })

  it('409 when the corrected address belongs to someone else — nothing written', async () => {
    h.p_getEmails.mockResolvedValue([{ emailId: 'e1', email: TYPO, emailType: 'primary', verified: true }])
    h.p_getAllPersonsByEmail.mockResolvedValue([{ personId: 'someone-else' }])
    const res = await POST(makeReq({ correctEmailId: 'e1', newEmail: RIGHT }), { params })
    expect(res.status).toBe(409)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('400 for an invalid address or an unknown row', async () => {
    h.p_getEmails.mockResolvedValue([{ emailId: 'e1', email: TYPO, emailType: 'primary', verified: true }])
    expect((await POST(makeReq({ correctEmailId: 'e1', newEmail: 'nope' }), { params })).status).toBe(400)
    expect((await POST(makeReq({ correctEmailId: 'zz', newEmail: RIGHT }), { params })).status).toBe(400)
    expect(h.p_changePrimaryEmail).not.toHaveBeenCalled()
  })

  it('still 403 for someone without edit rights over that ecclesia', async () => {
    h.checkEcclesiaEditPermission.mockResolvedValue(false)
    const res = await POST(makeReq({ correctEmailId: 'e1', newEmail: RIGHT }), { params })
    expect(res.status).toBe(403)
  })
})
