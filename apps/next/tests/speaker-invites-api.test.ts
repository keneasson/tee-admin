import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Speaker invitations — the API's gates (spec §2, §6; criteria 1, 3, 6).
 * The service is mocked here; its behaviour is covered in
 * speaker-invites-service.test.ts. Placeholder people only.
 */

const h = vi.hoisted(() => ({
  getTrust: vi.fn(),
  requireAssurance: vi.fn(),
  personForSessionEmail: vi.fn(),
  verifyEcclesiaToken: vi.fn(),
  service: {
    createInvite: vi.fn(),
    listInvites: vi.fn(),
    getInvite: vi.fn(),
    acceptInvite: vi.fn(),
    changeDate: vi.fn(),
    cancelByInvitee: vi.fn(),
    requestSwap: vi.fn(),
  },
}))

vi.mock('@/utils/auth-trust', async () => {
  const actual: any = await vi.importActual('@/utils/auth-trust')
  return { ...actual, getTrust: h.getTrust, requireAssurance: h.requireAssurance }
})
vi.mock('@/utils/auth', () => ({ auth: vi.fn() }))
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: h.personForSessionEmail }))
vi.mock('@/utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: h.verifyEcclesiaToken }))
vi.mock('@/utils/speaker-invites/service', () => h.service)
vi.mock('@/utils/speaker-invites/views', () => ({
  inviterInviteView: async (i: any) => i,
  inviteeInviteView: async (i: any) => ({ inviteId: i.inviteId }),
  redactSlots: (s: any) => s,
  swapView: (s: any) => s,
}))

import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { refuseActor, resolveInviteActor } from '@/utils/speaker-invites/actor'
import { POST as createRoute } from '@/app/api/speaker-invites/route'
import { GET as inviteGet, POST as invitePost } from '@/app/api/invite/[inviteId]/route'

const X = 'Ecclesia X'
const Y = 'Ecclesia Y'

const people: Record<string, any> = {
  'rb-x@example.test': { personId: 'p-rbx', ecclesia: X, isRecordingBrother: true, role: 'member' },
  'rb-y@example.test': { personId: 'p-rby', ecclesia: Y, isRecordingBrother: true, role: 'member' },
  'rep-x@example.test': { personId: 'p-repx', ecclesia: X, role: 'rep' },
  'admin-x@example.test': { personId: 'p-adminx', ecclesia: X, role: 'admin' },
  'recorder-x@example.test': { personId: 'p-recx', ecclesia: X, role: 'recorder' },
  'owner@example.test': { personId: 'p-owner', ecclesia: Y, role: 'owner' },
  'speaker@example.test': { personId: 'p-speaker', ecclesia: Y, role: 'member' },
  'partner@example.test': { personId: 'p-partner', ecclesia: Y, role: 'member' },
}

beforeEach(() => {
  vi.clearAllMocks()
  h.personForSessionEmail.mockImplementation(async (email: string) => people[email] ?? null)
  h.service.createInvite.mockResolvedValue({ ok: true, invite: { inviteId: 'inv-1' } })
})

describe('canSendSpeakerInvite (criterion 1)', () => {
  it('owner for any ecclesia; RB or Rep of X for X only; never admin or recorder', () => {
    expect(canSendSpeakerInvite(people['owner@example.test'], 'owner', X)).toBe(true)
    expect(canSendSpeakerInvite(people['rb-x@example.test'], 'member', X)).toBe(true)
    expect(canSendSpeakerInvite(people['rep-x@example.test'], 'rep', X)).toBe(true)
    expect(canSendSpeakerInvite(people['rb-y@example.test'], 'member', X)).toBe(false)
    expect(canSendSpeakerInvite(people['admin-x@example.test'], 'admin', X)).toBe(false)
    expect(canSendSpeakerInvite(people['recorder-x@example.test'], 'recorder', X)).toBe(false)
    expect(canSendSpeakerInvite(null, 'rep', X)).toBe(false)
  })
})

describe('POST /api/speaker-invites — server-side ecclesia check (criterion 1)', () => {
  const signIn = (email: string) => {
    const role = people[email].role
    h.requireAssurance.mockResolvedValue({
      ok: true,
      ctx: { trust: 'authenticated', email, authTime: Date.now(), session: { user: { email, role } } },
    })
  }
  const post = (body: any) =>
    createRoute(new Request('http://x/api/speaker-invites', { method: 'POST', body: JSON.stringify(body) }))
  const body = { ecclesia: X, type: 'memorial', invitee: { personId: 'p-speaker' }, dates: [{ date: '2026-11-15' }] }

  it.each([
    ['an RB of Y', 'rb-y@example.test'],
    ['an admin of X', 'admin-x@example.test'],
    ['a recorder of X', 'recorder-x@example.test'],
  ])('%s gets 403 for X and nothing is created', async (_label, email) => {
    signIn(email)
    const res = await post(body)
    expect(res.status).toBe(403)
    expect(h.service.createInvite).not.toHaveBeenCalled()
  })

  it.each([
    ['the RB of X', 'rb-x@example.test'],
    ['a Rep of X', 'rep-x@example.test'],
    ['the owner', 'owner@example.test'],
  ])('%s can create for X', async (_label, email) => {
    signIn(email)
    const res = await post(body)
    expect(res.status).toBe(201)
    expect(h.service.createInvite).toHaveBeenCalledWith(expect.objectContaining({ ecclesia: X }))
  })

  it('without a named ecclesia, the inviter’s own is used', async () => {
    signIn('rb-y@example.test')
    await post({ ...body, ecclesia: undefined })
    expect(h.service.createInvite).toHaveBeenCalledWith(expect.objectContaining({ ecclesia: Y }))
  })

  it('an unauthenticated caller gets the assurance refusal', async () => {
    const { NextResponse } = await import('next/server')
    h.requireAssurance.mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 401 }) })
    expect((await post(body)).status).toBe(401)
  })
})

describe('resolveInviteActor + refuseActor (criterion 6, API side)', () => {
  const invitee = { personId: 'p-speaker', email: 'speaker@example.test' }

  it('already signed in as the invitee: authenticated, no extra step, may request a swap', async () => {
    h.getTrust.mockResolvedValue({ trust: 'authenticated', email: 'speaker@example.test', session: { user: {} } })
    const actor = await resolveInviteActor(invitee, { ecclesiaToken: 'tok' })
    expect(actor).toEqual({ trust: 'authenticated', personId: 'p-speaker', isInvitee: true, mismatch: false })
    expect(refuseActor(actor, 'recognized')).toBeNull()
    expect(refuseActor(actor, 'authenticated')).toBeNull()
  })

  it('a token alone: recognized as the invitee — may accept/change/cancel, NOT request a swap until step-up', async () => {
    h.getTrust.mockResolvedValue({ trust: 'recognized', email: 'speaker@example.test', session: null })
    const actor = await resolveInviteActor(invitee, { ecclesiaToken: 'tok' })
    expect(actor).toMatchObject({ trust: 'recognized', isInvitee: true, mismatch: false })
    expect(refuseActor(actor, 'recognized')).toBeNull()
    expect(refuseActor(actor, 'authenticated')).toMatchObject({ status: 403, body: { stepUpRequired: true, code: 'STEP_UP_REQUIRED' } })
  })

  it('signed in as someone else with the invitee’s token: mismatch, and the API refuses to act', async () => {
    h.getTrust.mockResolvedValue({ trust: 'authenticated', email: 'partner@example.test', session: { user: {} } })
    h.verifyEcclesiaToken.mockResolvedValue({ valid: true, email: 'speaker@example.test' })
    const actor = await resolveInviteActor(invitee, { ecclesiaToken: 'tok' })
    expect(actor).toMatchObject({ isInvitee: false, mismatch: true, personId: 'p-partner' })
    expect(refuseActor(actor, 'recognized')).toMatchObject({ status: 403, body: { code: 'SESSION_MISMATCH', mismatch: true } })
  })

  it('signed in as someone else with no token for the invitee: not the invitee, no mismatch', async () => {
    h.getTrust.mockResolvedValue({ trust: 'authenticated', email: 'partner@example.test', session: { user: {} } })
    const actor = await resolveInviteActor(invitee, {})
    expect(actor).toMatchObject({ isInvitee: false, mismatch: false })
    expect(refuseActor(actor, 'recognized')).toMatchObject({ status: 403, body: { code: 'NOT_INVITEE' } })
  })

  it('no session, no valid token: sign in', async () => {
    h.getTrust.mockResolvedValue({ trust: 'anonymous', email: null, session: null })
    const actor = await resolveInviteActor(invitee, { ecclesiaToken: 'bad' })
    expect(refuseActor(actor, 'recognized')).toMatchObject({ status: 401, body: { code: 'SIGN_IN_REQUIRED' } })
  })
})

describe('/api/invite/{inviteId} — GET never mutates; POST is gated per action', () => {
  const INVITE = { inviteId: 'inv-1', inviteePersonId: 'p-speaker', inviteeEmail: 'speaker@example.test' }
  const recognized = () => h.getTrust.mockResolvedValue({ trust: 'recognized', email: 'speaker@example.test', session: null })
  const params = { params: Promise.resolve({ inviteId: 'inv-1' }) }
  const post = (body: any) =>
    invitePost(new Request('http://x/api/invite/inv-1', { method: 'POST', body: JSON.stringify(body) }), params)

  beforeEach(() => {
    h.service.getInvite.mockResolvedValue(INVITE)
    h.service.acceptInvite.mockResolvedValue({ ok: true, invite: INVITE })
  })

  it('GET with a token shows the invite and changes nothing (criterion 3)', async () => {
    recognized()
    const res = await inviteGet(new Request('http://x/api/invite/inv-1?token=tok'), params)
    expect(res.status).toBe(200)
    for (const fn of [h.service.acceptInvite, h.service.changeDate, h.service.cancelByInvitee, h.service.requestSwap]) {
      expect(fn).not.toHaveBeenCalled()
    }
  })

  it('an unknown invite is a clear 404, not an error', async () => {
    h.service.getInvite.mockResolvedValue(null)
    const res = await inviteGet(new Request('http://x/api/invite/nope?token=tok'), params)
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' })
  })

  it('a token alone may accept', async () => {
    recognized()
    const res = await post({ action: 'accept', date: '2026-11-15', token: 'tok' })
    expect(res.status).toBe(200)
    expect(h.service.acceptInvite).toHaveBeenCalledWith('inv-1', '2026-11-15', { personId: 'p-speaker', trust: 'recognized' })
  })

  it('a token alone cannot request a swap: 403 stepUpRequired, nothing sent', async () => {
    recognized()
    const res = await post({ action: 'swap-request', date: '2026-11-22', token: 'tok' })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ stepUpRequired: true })
    expect(h.service.requestSwap).not.toHaveBeenCalled()
  })

  it('SLOT_TAKEN comes back as 409 with the remaining open dates', async () => {
    recognized()
    h.service.acceptInvite.mockResolvedValue({
      ok: false, code: 'SLOT_TAKEN', message: 'That date was just taken.',
      openDates: [{ date: '2026-11-22', time: '11:00', tz: 'America/Toronto', state: 'OPEN' }],
    })
    const res = await post({ action: 'accept', date: '2026-11-15', token: 'tok' })
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'SLOT_TAKEN', openDates: [{ date: '2026-11-22' }] })
  })
})

describe('invitee views redact other speakers to first name at recognized', () => {
  it('first name at recognized, full when authenticated; personIds never leave', async () => {
    const { nameForTier, redactSlots: realRedactSlots } = await vi.importActual<any>('@/utils/speaker-invites/views')
    const slots = [{ date: '2026-11-22', time: '11:00', tz: 'America/Toronto', state: 'FILLED' as const, speakerName: 'Bro. Blair Speaker', speakerPersonId: 'p-b' }]
    expect(realRedactSlots(slots, 'recognized')).toEqual([{ date: '2026-11-22', time: '11:00', tz: 'America/Toronto', state: 'FILLED', speakerName: 'Blair' }])
    expect(realRedactSlots(slots, 'authenticated')[0]).toMatchObject({ speakerName: 'Bro. Blair Speaker' })
    expect(realRedactSlots(slots, 'authenticated')[0]).not.toHaveProperty('speakerPersonId')
    expect(nameForTier('Pat Presider', 'recognized')).toBe('Pat')
  })
})
