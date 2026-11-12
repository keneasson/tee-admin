import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * GET /api/invite/{inviteId}/ics — the hosted calendar file (spec §8.2).
 * Read-only, recognized + identity == invitee, stable UID, SEQUENCE from the
 * invite's history, METHOD:CANCEL once cancelled. Placeholders only.
 */

const h = vi.hoisted(() => ({
  getTrust: vi.fn(),
  getInvite: vi.fn(),
  people: new Map<string, any>(),
}))

vi.mock('@/utils/auth-trust', async () => {
  const actual: any = await vi.importActual('@/utils/auth-trust')
  return { ...actual, getTrust: h.getTrust }
})
vi.mock('@/utils/auth', () => ({ auth: vi.fn() }))
vi.mock('@/utils/session-person', () => ({
  personForSessionEmail: async (email: string) => [...h.people.values()].find((p) => p.primaryEmail === email) ?? null,
}))
vi.mock('@/utils/email/ecclesia-token', () => ({ verifyEcclesiaToken: vi.fn(async () => ({ valid: false })) }))
vi.mock('@/utils/speaker-invites/service', () => ({ getInvite: h.getInvite }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getById: async (id: string) => h.people.get(id) ?? null },
}))
vi.mock('@/utils/dynamodb/locations', () => ({
  getEcclesiaByName: async (name: string) => ({ name, venue: 'Example Hall', address: '1 Example Street' }),
}))
vi.mock('@/utils/email/exhorter-heads-up', () => ({ resolveHallAddress: (e: any) => e?.address }))

import { GET } from '@/app/api/invite/[inviteId]/ics/route'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

const INVITE = {
  inviteId: 'inv-1',
  ecclesia: HOME_ECCLESIA.canonicalName,
  type: 'memorial',
  status: 'accepted',
  inviterPersonId: 'p-rb',
  inviteePersonId: 'p-a',
  inviteeEmail: 'alex@example.test',
  offeredDates: [],
  acceptedDate: '2026-11-15',
  acceptedTime: '11:00',
  acceptedTz: 'America/Toronto',
  history: [{ action: 'created' }, { action: 'accepted' }],
}

const get = () => GET(new Request('http://x/api/invite/inv-1/ics?token=tok'), { params: Promise.resolve({ inviteId: 'inv-1' }) })

beforeEach(() => {
  vi.clearAllMocks()
  h.people.clear()
  h.people.set('p-rb', { personId: 'p-rb', firstName: 'Rob', lastName: 'Recorder', primaryEmail: 'rb@example.test' })
  h.people.set('p-a', { personId: 'p-a', firstName: 'Alex', lastName: 'Speaker', primaryEmail: 'alex@example.test' })
  h.people.set('p-b', { personId: 'p-b', firstName: 'Blair', lastName: 'Speaker', primaryEmail: 'blair@example.test' })
  h.getInvite.mockResolvedValue({ ...INVITE })
  h.getTrust.mockResolvedValue({ trust: 'recognized', email: 'alex@example.test', session: null })
})

describe('GET /api/invite/{inviteId}/ics', () => {
  it('serves text/calendar with a stable UID, SEQUENCE from history, and the hall', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8')
    const ics = await res.text()
    expect(ics).toContain('METHOD:PUBLISH')
    expect(ics).toContain('UID:speaker-invite-inv-1@tee-admin.com')
    expect(ics).toContain('SEQUENCE:2')
    expect(ics).toContain('DTSTART:20261115T160000Z')
    expect(ics).toContain('DTEND:20261115T173000Z')
    expect(ics).toContain('LOCATION:Example Hall\\, 1 Example Street')
  })

  it('a cancelled invite serves METHOD:CANCEL with the same UID', async () => {
    h.getInvite.mockResolvedValue({ ...INVITE, status: 'cancelled', history: [...INVITE.history, { action: 'cancelled' }] })
    const ics = await (await get()).text()
    expect(ics).toContain('METHOD:CANCEL')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('UID:speaker-invite-inv-1@tee-admin.com')
    expect(ics).toContain('SEQUENCE:3')
  })

  it('refuses anyone but the invitee', async () => {
    h.getTrust.mockResolvedValue({ trust: 'anonymous', email: null, session: null })
    expect((await get()).status).toBe(401)
    h.getTrust.mockResolvedValue({ trust: 'authenticated', email: 'blair@example.test', session: { user: {} } })
    const res = await get()
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'NOT_INVITEE' })
  })

  it('404 when there is no appointment yet', async () => {
    h.getInvite.mockResolvedValue({ ...INVITE, status: 'sent', acceptedDate: undefined })
    expect((await get()).status).toBe(404)
  })
})
