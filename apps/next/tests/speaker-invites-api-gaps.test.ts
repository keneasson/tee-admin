import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * API gaps found by the speaker-invite UI: the picker for RB/Rep inviters,
 * the resend route, and the invitee view's new fields (place + calendar links,
 * `reachable`, `viewerRole`). Placeholders only; no AWS.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  requireAssurance: vi.fn(),
  personForSessionEmail: vi.fn(),
  listByEcclesia: vi.fn(),
  searchPeopleByNamePrefix: vi.fn(),
  getById: vi.fn(),
  getInvite: vi.fn(),
  resendInvite: vi.fn(),
  inviteSlots: vi.fn(),
  loadSlotDetails: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@/utils/auth-trust', async () => {
  const actual: any = await vi.importActual('@/utils/auth-trust')
  return { ...actual, requireAssurance: h.requireAssurance }
})
vi.mock('@/utils/session-person', () => ({ personForSessionEmail: h.personForSessionEmail }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { listByEcclesia: h.listByEcclesia, getById: h.getById },
}))
vi.mock('@my/app/provider/dynamodb/people-index', () => ({
  peopleIndexReady: async () => true,
  searchPeopleByNamePrefix: h.searchPeopleByNamePrefix,
}))
vi.mock('@/utils/speaker-invites/service', async () => {
  const actual: any = await vi.importActual('@/utils/speaker-invites/service')
  return { ...actual, getInvite: h.getInvite, resendInvite: h.resendInvite, inviteSlots: h.inviteSlots }
})
vi.mock('@/utils/speaker-invites/slots', () => ({ loadSlotDetails: h.loadSlotDetails }))
vi.mock('@/utils/dynamodb/locations', () => ({
  getEcclesiaByName: async (name: string) => ({ name, venue: 'Example Hall', address: '1 Example Street' }),
}))
vi.mock('@/utils/email/exhorter-heads-up', () => ({
  DEFAULT_TEE_ZOOM: { label: 'Home Zoom', url: 'https://zoom.example.test/j/1' },
  resolveHallAddress: (e: any) => e?.address,
}))

import { GET as candidatesGet } from '@/app/api/roster/resolve-candidates/route'
import { POST as resendPost } from '@/app/api/speaker-invites/[inviteId]/resend/route'
import { inviteeInviteView, swapView } from '@/utils/speaker-invites/views'
import { __setClock } from '@/utils/speaker-invites/service'

const X = 'Ecclesia X'
const people: Record<string, any> = {
  'rb-x@example.test': { personId: 'p-rbx', ecclesia: X, isRecordingBrother: true, role: 'member', primaryEmail: 'rb-x@example.test' },
  'member-x@example.test': { personId: 'p-mx', ecclesia: X, role: 'member', primaryEmail: 'member-x@example.test' },
  'admin-x@example.test': { personId: 'p-ax', ecclesia: X, role: 'admin', primaryEmail: 'admin-x@example.test' },
}

function signIn(email: string) {
  const role = people[email].role
  h.auth.mockResolvedValue({ user: { email, role } })
  h.requireAssurance.mockResolvedValue({
    ok: true,
    ctx: { trust: 'authenticated', email, authTime: Date.now(), session: { user: { email, role } } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  __setClock(() => new Date('2026-11-12T12:00:00.000Z'))
  h.personForSessionEmail.mockImplementation(async (email: string) => people[email] ?? null)
  h.getById.mockResolvedValue(null)
})

describe('/api/roster/resolve-candidates stays admin/owner-only (inviters use /api/speaker-invites/candidates)', () => {
  const get = (q: string) =>
    candidatesGet(new Request(`http://x/api/roster/resolve-candidates?q=${encodeURIComponent(q)}&ecclesia=${X}`) as any)

  it('an RB is refused here', async () => {
    signIn('rb-x@example.test')
    expect((await get('vis')).status).toBe(403)
    expect(h.searchPeopleByNamePrefix).not.toHaveBeenCalled()
  })

  it('a plain member is still refused', async () => {
    signIn('member-x@example.test')
    expect((await get('vis')).status).toBe(403)
    expect(h.searchPeopleByNamePrefix).not.toHaveBeenCalled()
  })

  it('admin behaviour is unchanged (home-directory substring search)', async () => {
    signIn('admin-x@example.test')
    h.listByEcclesia.mockResolvedValue({
      items: [{ personId: 'p-1', displayName: 'Sam Sample', firstName: 'Sam', lastName: 'Sample', ecclesia: 'Home' }],
    })
    const body = await (await get('sam')).json()
    expect(body.candidates).toEqual([{ personId: 'p-1', displayName: 'Sam Sample', ecclesia: 'Home' }])
    expect(h.searchPeopleByNamePrefix).not.toHaveBeenCalled()
  })
})

describe('POST /api/speaker-invites/{id}/resend', () => {
  const post = () => resendPost(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ inviteId: 'inv-1' }) })

  it('is inviter-gated', async () => {
    signIn('admin-x@example.test')
    h.getInvite.mockResolvedValue({ inviteId: 'inv-1', ecclesia: X })
    expect((await post()).status).toBe(403)
    expect(h.resendInvite).not.toHaveBeenCalled()
  })

  it('returns what was re-sent; cancelled is refused with 409', async () => {
    signIn('rb-x@example.test')
    h.getInvite.mockResolvedValue({ inviteId: 'inv-1', ecclesia: X, inviteePersonId: 'p-a', offeredDates: [], history: [] })
    h.resendInvite.mockResolvedValue({ ok: true, sent: 'invitation', invite: { inviteId: 'inv-1', ecclesia: X, offeredDates: [], status: 'sent', history: [] } })
    const ok = await post()
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ sent: 'invitation' })
    h.resendInvite.mockResolvedValue({ ok: false, code: 'INVITE_CANCELLED', message: 'This invitation was cancelled.' })
    expect((await post()).status).toBe(409)
  })
})

describe('InviteeInviteView additions', () => {
  const accepted = {
    inviteId: 'inv-1', ecclesia: 'Other Ecclesia', type: 'bible_class', status: 'accepted',
    inviterPersonId: 'p-rb', inviteePersonId: 'p-a', inviteeEmail: 'alex@example.test',
    offeredDates: [{ date: '2026-11-18', time: '19:30', tz: 'America/Toronto' }],
    otherDatesWindow: { from: '2026-11-13', to: '2026-12-31' },
    acceptedDate: '2026-11-18', acceptedTime: '19:30', acceptedTz: 'America/Toronto',
    history: [], createdAt: 'x', updatedAt: 'x', version: 1,
  } as any

  beforeEach(() => {
    h.getById.mockImplementation(async (id: string) =>
      ({
        'p-rb': { personId: 'p-rb', firstName: 'Rob', lastName: 'Recorder', primaryEmail: 'rb@example.test' },
        'p-a': { personId: 'p-a', firstName: 'Alex', lastName: 'Speaker', primaryEmail: 'alex@example.test' },
        'p-b': { personId: 'p-b', firstName: 'Blair', lastName: 'Speaker', primaryEmail: 'blair@example.test' },
        'p-n': { personId: 'p-n', firstName: 'Noel', lastName: 'Visitor', primaryEmail: '' },
      })[id] ?? null
    )
    h.inviteSlots.mockResolvedValue({
      offered: [{ date: '2026-11-18', time: '19:30', tz: 'America/Toronto', state: 'FILLED', speakerName: 'Alex Speaker', speakerPersonId: 'p-a' }],
      other: [
        { date: '2026-11-25', time: '19:30', tz: 'America/Toronto', state: 'FILLED', speakerName: 'Blair Speaker', speakerPersonId: 'p-b' },
        { date: '2026-12-02', time: '19:30', tz: 'America/Toronto', state: 'FILLED', speakerName: 'Noel Visitor', speakerPersonId: 'p-n' },
        { date: '2026-12-09', time: '19:30', tz: 'America/Toronto', state: 'FILLED', speakerName: 'Unknown Name' },
        { date: '2026-12-16', time: '19:30', tz: 'America/Toronto', state: 'OPEN' },
      ],
    })
    h.loadSlotDetails.mockResolvedValue({
      slots: [{ date: '2026-11-18', row: { ZoomURL: 'https://zoom.example.test/j/9', MeetingID: '9' } }],
    })
  })

  it('accepted: place (hall, address, online), Google link and same-origin .ics with the token', async () => {
    const view = await inviteeInviteView(accepted, 'recognized', { token: 'tok 1' })
    expect(view.place).toEqual({
      hallName: 'Example Hall',
      address: '1 Example Street',
      onlineMeetings: [{ label: 'Online', url: 'https://zoom.example.test/j/9', meetingId: '9' }],
    })
    // 19:30 Toronto = 00:30Z next day, 90 minutes (the one duration constant).
    expect(view.googleCalendarUrl).toContain('dates=20261119T003000Z/20261119T020000Z')
    expect(view.icsUrl).toBe('/api/invite/inv-1/ics?token=tok%201')
  })

  it('FILLED slots say whether their speaker is reachable; personIds never leave', async () => {
    const view = await inviteeInviteView(accepted, 'recognized')
    expect(view.otherDates!.map((s) => [s.date, s.state, s.reachable, s.speakerName])).toEqual([
      ['2026-11-25', 'FILLED', true, 'Blair'],
      ['2026-12-02', 'FILLED', false, 'Noel'],
      ['2026-12-09', 'FILLED', false, 'Unknown'],
      ['2026-12-16', 'OPEN', undefined, undefined],
    ])
    expect(JSON.stringify(view)).not.toContain('speakerPersonId')
  })

  it('a waiting invite carries no appointment fields', async () => {
    const view = await inviteeInviteView({ ...accepted, status: 'sent', acceptedDate: undefined }, 'recognized')
    expect(view.place).toBeUndefined()
    expect(view.googleCalendarUrl).toBeUndefined()
    expect(view.icsUrl).toBeUndefined()
  })
})

describe('SwapView.viewerRole', () => {
  const swap = {
    swapId: 'sw-1', ecclesia: X, type: 'memorial', field: 'Exhort', status: 'open',
    requester: { personId: 'p-a', name: 'Alex Speaker', date: '2026-11-15', time: '11:00', tz: 'America/Toronto', hadBooking: true },
    target: { personId: 'p-b', name: 'Blair Speaker', date: '2026-11-22', time: '11:00', tz: 'America/Toronto', hadBooking: true },
    createdAt: 'x', expiresAt: '2026-11-15T16:00:00.000Z', version: 1,
  } as any

  it('is "requester" for the asker and "target" for the other speaker', () => {
    expect(swapView(swap, 'recognized', 'p-a').viewerRole).toBe('requester')
    expect(swapView(swap, 'recognized', 'p-b').viewerRole).toBe('target')
  })
})
