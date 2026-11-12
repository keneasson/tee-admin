import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * Speaker invitations service (docs/SPEAKER_INVITATIONS.md). DynamoDB is never
 * touched: the speaker repository is an in-memory store that applies a commit
 * ATOMICALLY and enforces every condition the real TransactWrite carries
 * (booking attribute_not_exists / person+invite+lock, invite + swap versions,
 * and the overlay's optimistic version lock). Placeholder people only.
 */

const h = vi.hoisted(() => {
  const state = {
    invites: new Map<string, any>(),
    bookings: new Map<string, any>(),
    swaps: new Map<string, any>(),
    overrides: new Map<string, any>(),
    people: new Map<string, any>(),
    rows: [] as any[],
    commitGate: null as null | Promise<void>,
    commits: 0,
  }
  return { state }
})

vi.mock('@my/app/provider/dynamodb/repositories/speaker-invite-repository', async () => {
  const actual: any = await vi.importActual('@my/app/provider/dynamodb/repositories/speaker-invite-repository')
  const s = h.state
  const bk = (e: string, t: string, d: string) => `${e}|${t}|${d}`
  const clone = (x: any) => (x ? JSON.parse(JSON.stringify(x)) : null)

  const bookingOk = (cur: any, expect: any) => {
    if (expect === 'absent') return !cur
    if (!cur || cur.personId !== expect.personId) return false
    if (expect.inviteId === null && cur.inviteId !== undefined) return false
    if (typeof expect.inviteId === 'string' && cur.inviteId !== expect.inviteId) return false
    if (expect.openSwapId === null && cur.openSwapId !== undefined) return false
    if (typeof expect.openSwapId === 'string' && cur.openSwapId !== expect.openSwapId) return false
    return true
  }
  const overrideOk = (put: any) => {
    const cur = s.overrides.get(`${put.Item.pkey}|${put.Item.skey}`)
    const cond: string = put.ConditionExpression
    if (cond === 'attribute_not_exists(pkey)') return !cur
    if (cond.includes('attribute_not_exists(version)')) return !!cur && cur.version === undefined
    return !!cur && cur.version === put.ExpressionAttributeValues[':overrideReadVersion']
  }

  const fake = {
    getInvite: async (id: string) => clone(s.invites.get(id)),
    listInvitesByEcclesia: async (e: string) => [...s.invites.values()].filter((i) => i.ecclesia === e).map(clone),
    getBooking: async (e: string, t: string, d: string) => clone(s.bookings.get(bk(e, t, d))),
    listBookings: async (e: string, t: string, from: string, to: string) =>
      [...s.bookings.values()].filter((b) => b.ecclesia === e && b.type === t && b.date >= from && b.date <= to).map(clone),
    getSwap: async (id: string) => clone(s.swaps.get(id)),
    createInvite: async (inv: any) => {
      if (s.invites.has(inv.inviteId)) throw new Error('exists')
      s.invites.set(inv.inviteId, clone(inv))
    },
    appendHistory: async (id: string, entries: any[]) => {
      const inv = s.invites.get(id)
      inv.history.push(...entries)
      inv.version += 1
    },
    commit: async (ops: any[]) => {
      if (s.commitGate) await s.commitGate
      s.commits++
      const failed: string[] = []
      for (const op of ops) {
        if (op.kind === 'putInvite') {
          const cur = s.invites.get(op.invite.inviteId)
          const ok = op.expect === 'absent' ? !cur : !!cur && cur.version === op.expect.version
          if (!ok) failed.push('putInvite')
        } else if (op.kind === 'putBooking') {
          if (!bookingOk(s.bookings.get(bk(op.booking.ecclesia, op.booking.type, op.booking.date)), op.expect)) failed.push('putBooking')
        } else if (op.kind === 'deleteBooking') {
          if (!bookingOk(s.bookings.get(bk(op.ecclesia, op.type, op.date)), op.expect)) failed.push('deleteBooking')
        } else if (op.kind === 'putSwap') {
          const cur = s.swaps.get(op.swap.swapId)
          const ok = op.expect === 'absent' ? !cur : !!cur && cur.version === op.expect.version && cur.status === op.expect.status
          if (!ok) failed.push('putSwap')
        } else if (op.kind === 'override') {
          if (!overrideOk(op.put.Put)) failed.push('override')
        }
      }
      if (failed.length) throw new actual.SpeakerWriteConflict(failed)
      for (const op of ops) {
        if (op.kind === 'putInvite') s.invites.set(op.invite.inviteId, clone(op.invite))
        else if (op.kind === 'putBooking') s.bookings.set(bk(op.booking.ecclesia, op.booking.type, op.booking.date), clone(op.booking))
        else if (op.kind === 'deleteBooking') s.bookings.delete(bk(op.ecclesia, op.type, op.date))
        else if (op.kind === 'putSwap') s.swaps.set(op.swap.swapId, clone(op.swap))
        else if (op.kind === 'override') s.overrides.set(`${op.put.Put.Item.pkey}|${op.put.Put.Item.skey}`, clone(op.put.Put.Item))
      }
    },
  }
  return { ...actual, speakerInviteRepository: fake }
})

vi.mock('@my/app/provider/dynamodb/repositories/service-override-repository', async () => {
  const actual: any = await vi.importActual('@my/app/provider/dynamodb/repositories/service-override-repository')
  const builder = Object.create(actual.ServiceOverrideRepository.prototype)
  builder.tableName = 'tee-admin'
  return {
    ...actual,
    serviceOverrideRepository: {
      listByDateRange: async (e: string, from: string, to: string) =>
        [...h.state.overrides.values()].filter((o) => o.ecclesia === e && o.date >= from && o.date <= to),
      buildRoleFieldPut: (existing: any, change: any) => builder.buildRoleFieldPut(existing, change),
    },
  }
})

vi.mock('@my/app/provider/dynamodb/repositories/schedule-repository', () => ({
  ScheduleRepository: class {
    async getSchedulesByEcclesiaAndDateRange(q: any) {
      return {
        items: h.state.rows.filter((r) => r.ecclesia === q.ecclesia && r.date >= q.startDate && r.date <= q.endDate),
      }
    }
  },
}))

vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getById: async (id: string) => h.state.people.get(id) ?? null,
    getByEmail: async (email: string) => [...h.state.people.values()].find((p) => p.primaryEmail === email) ?? null,
    searchByName: async (last: string, first?: string) => ({
      items: [...h.state.people.values()].filter(
        (p) => p.lastName.toLowerCase() === last && (!first || p.firstName.toLowerCase().startsWith(first))
      ),
    }),
    create: vi.fn(async (input: any) => {
      const p = { ...input, personId: `p-new-${h.state.people.size}`, primaryEmail: input.email }
      h.state.people.set(p.personId, p)
      return p
    }),
  },
}))

vi.mock('@/utils/dynamodb/locations', () => ({ getEcclesiaByName: async () => null }))

vi.mock('@/utils/email/speaker-invite-emails', () => ({
  sendInvitationEmail: vi.fn(async () => undefined),
  sendConfirmationEmail: vi.fn(async () => undefined),
  sendSwapRequestEmail: vi.fn(async () => undefined),
  sendSwapOutcomeEmail: vi.fn(async () => undefined),
  sendInviterNotice: vi.fn(async () => undefined),
  sendCancellationEmail: vi.fn(async () => undefined),
}))

import * as emails from '@/utils/email/speaker-invite-emails'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  __setClock,
  acceptInvite,
  cancelByInvitee,
  changeDate,
  createInvite,
  requestSwap,
  respondSwap,
  swapExpiry,
  type Actor,
} from '@/utils/speaker-invites/service'
import { getSlots } from '@/utils/speaker-invites/slots'

const ECC = 'Test Ecclesia'
const RB: Actor = { personId: 'p-rb', trust: 'authenticated' }

// Thursday 2026-11-12, noon UTC. Sundays: 15, 22, 29 Nov, 6 Dec.
const NOW = new Date('2026-11-12T12:00:00.000Z')

function person(id: string, first: string, last: string, email: string) {
  h.state.people.set(id, { personId: id, firstName: first, lastName: last, displayName: `${first} ${last}`, primaryEmail: email, ecclesia: ECC })
}

/** A memorial row at 11:00 Toronto (16:00Z in November). */
function memorialRow(date: string, data: Record<string, any> = {}) {
  h.state.rows.push({
    PK: 'SCHEDULE#MEMORIAL',
    SK: `DATE#${date}`,
    ecclesia: ECC,
    type: 'memorial',
    date,
    data: { Preside: 'Pat Presider', Exhort: '', DateTime: `${date}T16:00:00.000Z`, ServiceTimezone: 'America/Toronto', ...data },
  })
}

function overlay(date: string, fields: Record<string, any>) {
  h.state.overrides.set(`SERVICE_OVERRIDE#${ECC}|memorial#${date}`, {
    pkey: `SERVICE_OVERRIDE#${ECC}`,
    skey: `memorial#${date}`,
    ecclesia: ECC,
    serviceType: 'memorial',
    date,
    version: 1,
    createdBy: 'x',
    createdAt: 'x',
    updatedAt: 'x',
    ...fields,
  })
}

const overrideOn = (date: string) => h.state.overrides.get(`SERVICE_OVERRIDE#${ECC}|memorial#${date}`)
const bookingOn = (date: string, type = 'memorial') => h.state.bookings.get(`${ECC}|${type}|${date}`)

async function invite(personId: string, dates: string[], extra: Record<string, any> = {}) {
  const r = await createInvite({
    ecclesia: ECC,
    type: 'memorial',
    inviter: RB,
    invitee: { personId },
    dates: dates.map((date) => ({ date })),
    ...extra,
  })
  if (!r.ok) throw new Error(`createInvite failed: ${r.code}`)
  return r.invite
}

const as = (personId: string, trust: Actor['trust'] = 'recognized'): Actor => ({ personId, trust })

beforeEach(() => {
  h.state.invites.clear()
  h.state.bookings.clear()
  h.state.swaps.clear()
  h.state.overrides.clear()
  h.state.people.clear()
  h.state.rows = []
  h.state.commitGate = null
  h.state.commits = 0
  vi.clearAllMocks()
  __setClock(() => NOW)
  person('p-rb', 'Rob', 'Recorder', 'rb@example.test')
  person('p-a', 'Alex', 'Speaker', 'alex@example.test')
  person('p-b', 'Blair', 'Speaker', 'blair@example.test')
  person('p-c', 'Casey', 'Visitor', 'casey@example.test')
})

afterEach(() => __setClock(null))

describe('getSlots — one function for "planned, and open?" (§4, criterion 2)', () => {
  it('labels every expected meeting day OPEN / FILLED / NO_MEETING and never drops one', async () => {
    memorialRow('2026-11-15') // open: Exhort blank
    memorialRow('2026-11-22', { Exhort: 'Blair Speaker' }) // filled from the Sheet
    memorialRow('2026-11-29', { Exhort: 'TBD' }) // placeholder → open
    memorialRow('2026-12-06', { Activities: 'Joining Other Ecclesia for a fraternal gathering', Preside: '', Exhort: '' })
    memorialRow('2026-12-13')
    overlay('2026-12-13', { status: 'cancelled', message: 'Hall closed' })
    // 2026-12-20 has no row at all

    const slots = await getSlots(ECC, 'memorial', '2026-11-13', '2026-12-20')
    const by = Object.fromEntries(slots.map((s) => [s.date, s]))

    expect(slots.map((s) => s.date)).toEqual(['2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20'])
    expect(by['2026-11-15']).toMatchObject({ state: 'OPEN', time: '11:00', tz: 'America/Toronto' })
    expect(by['2026-11-22']).toMatchObject({ state: 'FILLED', speakerName: 'Blair Speaker', speakerPersonId: 'p-b' })
    expect(by['2026-11-29'].state).toBe('OPEN')
    expect(by['2026-12-06']).toMatchObject({ state: 'NO_MEETING', reason: 'NO_SERVICE_AT_HALL' })
    expect(by['2026-12-13']).toMatchObject({ state: 'NO_MEETING', reason: 'CANCELLED', reasonNote: 'Hall closed' })
    expect(by['2026-12-20']).toMatchObject({ state: 'NO_MEETING', reason: 'NO_SCHEDULE_ROW' })
  })

  it('the overlay wins, and its roleFieldRefs supply the personId', async () => {
    memorialRow('2026-11-15', { Exhort: 'Someone Else' })
    overlay('2026-11-15', { roleFields: { Exhort: 'Alex Speaker' }, roleFieldRefs: { Exhort: 'p-a' } })
    const [slot] = await getSlots(ECC, 'memorial', '2026-11-15', '2026-11-15')
    expect(slot).toMatchObject({ state: 'FILLED', speakerName: 'Alex Speaker', speakerPersonId: 'p-a' })
  })

  it('the composer can only offer OPEN dates; FILLED and NO_MEETING are refused with their state', async () => {
    memorialRow('2026-11-15')
    memorialRow('2026-11-22', { Exhort: 'Blair Speaker' })
    const r = await createInvite({
      ecclesia: ECC,
      type: 'memorial',
      inviter: RB,
      invitee: { personId: 'p-a' },
      dates: [{ date: '2026-11-15' }, { date: '2026-11-22' }, { date: '2026-11-29' }],
    })
    expect(r).toMatchObject({
      ok: false,
      code: 'DATES_NOT_OPEN',
      dates: [
        { date: '2026-11-22', state: 'FILLED' },
        { date: '2026-11-29', state: 'NO_MEETING' },
      ],
    })
    expect(h.state.invites.size).toBe(0)
  })

  it('validates 1–3 dates', async () => {
    memorialRow('2026-11-15')
    const none = await createInvite({ ecclesia: ECC, type: 'memorial', inviter: RB, invitee: { personId: 'p-a' }, dates: [] })
    expect(none).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    const four = await createInvite({
      ecclesia: ECC, type: 'memorial', inviter: RB, invitee: { personId: 'p-a' },
      dates: ['2026-11-15', '2026-11-22', '2026-11-29', '2026-12-06'].map((date) => ({ date })),
    })
    expect(four).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
  })
})

describe('createInvite — the invitee is always a PersonRecord', () => {
  beforeEach(() => memorialRow('2026-11-15'))

  it('name + email looks the address up first and reuses the existing person', async () => {
    const r = await createInvite({
      ecclesia: ECC, type: 'memorial', inviter: RB,
      invitee: { firstName: 'Casey', lastName: 'Visitor', email: 'CASEY@example.test' },
      dates: [{ date: '2026-11-15' }],
    })
    expect(r.ok && r.invite.inviteePersonId).toBe('p-c')
    expect(personRepository.create).not.toHaveBeenCalled()
  })

  it('an unknown address creates a visitor record', async () => {
    const r = await createInvite({
      ecclesia: ECC, type: 'memorial', inviter: RB,
      invitee: { firstName: 'New', lastName: 'Brother', email: 'new@example.test', ecclesia: 'Elsewhere' },
      dates: [{ date: '2026-11-15' }],
    })
    expect(r.ok).toBe(true)
    expect(personRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.test', memberStatus: 'visitor', ecclesia: 'Elsewhere' })
    )
  })

  it('stores the schedule time + timezone on each offered date, and sends the invitation after the write', async () => {
    const inv = await invite('p-a', ['2026-11-15'])
    expect(inv.offeredDates).toEqual([{ date: '2026-11-15', time: '11:00', tz: 'America/Toronto' }])
    expect(inv.history[0]).toMatchObject({ action: 'created', byPersonId: 'p-rb', trust: 'authenticated' })
    expect(emails.sendInvitationEmail).toHaveBeenCalledTimes(1)
  })
})

describe('accept — no holds, first to accept wins (criterion 4)', () => {
  beforeEach(() => {
    memorialRow('2026-11-15')
    memorialRow('2026-11-22')
  })

  it('takes the booking and writes the overlay for the INVITE’s ecclesia with the personId', async () => {
    const inv = await invite('p-a', ['2026-11-15'])
    const r = await acceptInvite(inv.inviteId, '2026-11-15', as('p-a'))
    expect(r.ok).toBe(true)
    expect(bookingOn('2026-11-15')).toMatchObject({ personId: 'p-a', inviteId: inv.inviteId })
    expect(overrideOn('2026-11-15')).toMatchObject({
      ecclesia: ECC,
      roleFields: { Exhort: 'Alex Speaker' },
      roleFieldRefs: { Exhort: 'p-a' },
    })
    const stored = h.state.invites.get(inv.inviteId)
    expect(stored).toMatchObject({ status: 'accepted', acceptedDate: '2026-11-15', acceptedTime: '11:00' })
    expect(stored.history.at(-1)).toMatchObject({ action: 'accepted', byPersonId: 'p-a', trust: 'recognized', to: '2026-11-15' })
    expect(emails.sendConfirmationEmail).toHaveBeenCalledTimes(1)
    expect(emails.sendInviterNotice).toHaveBeenCalledWith(expect.anything(), 'accepted')
  })

  it('two people accepting the same slot at the same moment: exactly one wins, the other is told it was just taken', async () => {
    const a = await invite('p-a', ['2026-11-15', '2026-11-22'])
    const b = await invite('p-b', ['2026-11-15', '2026-11-22'])

    // Both read the slot as OPEN before either commits.
    const commitsBefore = h.state.commits
    let release!: () => void
    h.state.commitGate = new Promise<void>((r) => (release = r))
    const both = Promise.all([
      acceptInvite(a.inviteId, '2026-11-15', as('p-a')),
      acceptInvite(b.inviteId, '2026-11-15', as('p-b')),
    ])
    await new Promise((r) => setTimeout(r, 10))
    release()
    const [ra, rb] = await both
    // Both reached the conditional write: the booking lock decided, not a pre-check.
    expect(h.state.commits - commitsBefore).toBe(2)

    const winners = [ra, rb].filter((r) => r.ok)
    const losers = [ra, rb].filter((r) => !r.ok) as any[]
    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(losers[0].code).toBe('SLOT_TAKEN')
    expect(losers[0].message).toMatch(/just taken/)
    expect(losers[0].openDates.map((s: any) => s.date)).toEqual(['2026-11-22'])

    const winner = ra.ok ? 'p-a' : 'p-b'
    expect(bookingOn('2026-11-15').personId).toBe(winner)
    expect(overrideOn('2026-11-15').roleFieldRefs.Exhort).toBe(winner)
  })

  it('a date filled since the invite was sent is refused before any write', async () => {
    const inv = await invite('p-a', ['2026-11-15', '2026-11-22'])
    overlay('2026-11-15', { roleFields: { Exhort: 'Blair Speaker' } })
    const r = await acceptInvite(inv.inviteId, '2026-11-15', as('p-a'))
    expect(r).toMatchObject({ ok: false, code: 'SLOT_TAKEN' })
    expect(h.state.commits).toBe(0)
  })

  it('an email failure never rolls the booking back — it is recorded in history', async () => {
    vi.mocked(emails.sendConfirmationEmail).mockRejectedValueOnce(new Error('SES down'))
    const inv = await invite('p-a', ['2026-11-15'])
    const r = await acceptInvite(inv.inviteId, '2026-11-15', as('p-a'))
    expect(r.ok).toBe(true)
    expect(bookingOn('2026-11-15')).toBeTruthy()
    const history = h.state.invites.get(inv.inviteId).history
    expect(history.some((e: any) => e.action === 'email_failed' && /SES down/.test(e.note))).toBe(true)
  })

  it('a date that was not offered is refused', async () => {
    const inv = await invite('p-a', ['2026-11-15'])
    const r = await acceptInvite(inv.inviteId, '2026-11-22', as('p-a'))
    expect(r).toMatchObject({ ok: false, code: 'DATE_NOT_OFFERED' })
  })
})

describe('change date and cancel', () => {
  beforeEach(() => {
    memorialRow('2026-11-15')
    memorialRow('2026-11-22')
  })

  it('change moves the booking and the overlay in one commit', async () => {
    const inv = await invite('p-a', ['2026-11-15', '2026-11-22'])
    await acceptInvite(inv.inviteId, '2026-11-15', as('p-a'))
    const before = h.state.commits
    const r = await changeDate(inv.inviteId, '2026-11-22', as('p-a'))
    expect(r.ok).toBe(true)
    expect(h.state.commits - before).toBe(1)
    expect(bookingOn('2026-11-15')).toBeUndefined()
    expect(bookingOn('2026-11-22').personId).toBe('p-a')
    expect(overrideOn('2026-11-15').roleFields).toBeUndefined()
    expect(overrideOn('2026-11-22').roleFields).toEqual({ Exhort: 'Alex Speaker' })
    expect(emails.sendInviterNotice).toHaveBeenLastCalledWith(expect.anything(), 'changed')
  })

  it('cancel releases the booking and clears the overlay field', async () => {
    const inv = await invite('p-a', ['2026-11-15'])
    await acceptInvite(inv.inviteId, '2026-11-15', as('p-a'))
    const r = await cancelByInvitee(inv.inviteId, as('p-a'))
    expect(r.ok).toBe(true)
    expect(bookingOn('2026-11-15')).toBeUndefined()
    expect(overrideOn('2026-11-15').roleFields).toBeUndefined()
    expect(emails.sendCancellationEmail).toHaveBeenCalledTimes(1)
    expect(emails.sendInviterNotice).toHaveBeenLastCalledWith(expect.anything(), 'cancelled')
  })

  it('cancel leaves the overlay alone when it no longer names this person', async () => {
    const inv = await invite('p-a', ['2026-11-15'])
    await acceptInvite(inv.inviteId, '2026-11-15', as('p-a'))
    const o = overrideOn('2026-11-15')
    o.roleFields = { Exhort: 'Blair Speaker' }
    o.roleFieldRefs = { Exhort: 'p-b' }
    const r = await cancelByInvitee(inv.inviteId, as('p-a'))
    expect(r.ok).toBe(true)
    expect(overrideOn('2026-11-15').roleFields).toEqual({ Exhort: 'Blair Speaker' })
  })
})

describe('swap (criterion 8)', () => {
  const WINDOW = { otherDatesWindow: { from: '2026-11-13', to: '2026-12-31' } }

  async function twoBooked() {
    memorialRow('2026-11-15')
    memorialRow('2026-11-22')
    const a = await invite('p-a', ['2026-11-15'], WINDOW)
    const b = await invite('p-b', ['2026-11-22'], WINDOW)
    await acceptInvite(a.inviteId, '2026-11-15', as('p-a'))
    await acceptInvite(b.inviteId, '2026-11-22', as('p-b'))
    return { a, b }
  }

  it('accepted by the other speaker: both bookings, both overlays and both invites swap atomically; no inviter notice', async () => {
    const { a, b } = await twoBooked()
    const req = await requestSwap(a.inviteId, '2026-11-22', 'Family wedding', as('p-a', 'authenticated'))
    expect(req.ok).toBe(true)
    const swapId = (req as any).swap.swapId
    expect(emails.sendSwapRequestEmail).toHaveBeenCalledTimes(1)
    vi.mocked(emails.sendInviterNotice).mockClear()
    vi.mocked(emails.sendConfirmationEmail).mockClear()

    const before = h.state.commits
    const r = await respondSwap(swapId, 'accept', as('p-b'))
    expect(r.ok).toBe(true)
    expect(h.state.commits - before).toBe(1)

    expect(bookingOn('2026-11-15')).toMatchObject({ personId: 'p-b', inviteId: b.inviteId })
    expect(bookingOn('2026-11-22')).toMatchObject({ personId: 'p-a', inviteId: a.inviteId })
    expect(bookingOn('2026-11-15').openSwapId).toBeUndefined()
    expect(overrideOn('2026-11-15').roleFieldRefs).toEqual({ Exhort: 'p-b' })
    expect(overrideOn('2026-11-22').roleFieldRefs).toEqual({ Exhort: 'p-a' })
    expect(h.state.invites.get(a.inviteId).acceptedDate).toBe('2026-11-22')
    expect(h.state.invites.get(b.inviteId).acceptedDate).toBe('2026-11-15')
    expect(h.state.swaps.get(swapId).status).toBe('accepted')

    expect(emails.sendConfirmationEmail).toHaveBeenCalledTimes(2)
    expect(emails.sendInviterNotice).not.toHaveBeenCalled()
  })

  it('works against a Sheet-filled date whose speaker has no booking of their own', async () => {
    memorialRow('2026-11-15')
    memorialRow('2026-11-22', { Exhort: 'Blair Speaker' })
    const a = await invite('p-a', ['2026-11-15'], WINDOW)
    await acceptInvite(a.inviteId, '2026-11-15', as('p-a'))
    const req = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    expect(req.ok).toBe(true)
    const r = await respondSwap((req as any).swap.swapId, 'accept', as('p-b'))
    expect(r.ok).toBe(true)
    expect(bookingOn('2026-11-15')).toMatchObject({ personId: 'p-b' })
    expect(bookingOn('2026-11-15').inviteId).toBeUndefined()
    expect(overrideOn('2026-11-15').roleFields).toEqual({ Exhort: 'Blair Speaker' })
    expect(overrideOn('2026-11-22').roleFields).toEqual({ Exhort: 'Alex Speaker' })
    // The speaker with no invite still gets a confirmation (invite = null).
    expect(emails.sendConfirmationEmail).toHaveBeenCalledWith(null, expect.objectContaining({ date: '2026-11-15', personId: 'p-b' }), expect.anything())
  })

  it('fails cleanly when either booking changed in the meantime — nothing is swapped', async () => {
    const { a, b } = await twoBooked()
    const req = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    const swapId = (req as any).swap.swapId
    // Someone edits the target date's roster by hand.
    const o = overrideOn('2026-11-22')
    o.roleFields = { Exhort: 'Casey Visitor' }
    o.roleFieldRefs = { Exhort: 'p-c' }
    o.version += 1

    const r = await respondSwap(swapId, 'accept', as('p-b'))
    expect(r).toMatchObject({ ok: false, code: 'SWAP_STALE' })
    expect(bookingOn('2026-11-15').personId).toBe('p-a')
    expect(bookingOn('2026-11-22').personId).toBe('p-b')
    expect(h.state.invites.get(a.inviteId).acceptedDate).toBe('2026-11-15')
    expect(h.state.invites.get(b.inviteId).acceptedDate).toBe('2026-11-22')
    expect(h.state.swaps.get(swapId).status).toBe('failed')
  })

  it('fails cleanly when the overlay changes between the check and the commit', async () => {
    const { a } = await twoBooked()
    const req = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    const swapId = (req as any).swap.swapId
    let release!: () => void
    h.state.commitGate = new Promise<void>((r) => (release = r))
    const pending = respondSwap(swapId, 'accept', as('p-b'))
    await new Promise((r) => setTimeout(r, 10))
    overrideOn('2026-11-15').version += 1 // a concurrent admin edit
    h.state.commitGate = null
    release()
    const r = await pending
    expect(r).toMatchObject({ ok: false, code: 'SWAP_STALE' })
    expect(bookingOn('2026-11-15').personId).toBe('p-a')
  })

  it('only one open swap request per booking', async () => {
    const { a } = await twoBooked()
    memorialRow('2026-11-29', { Exhort: 'Casey Visitor' })
    expect((await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))).ok).toBe(true)
    const second = await requestSwap(a.inviteId, '2026-11-29', undefined, as('p-a', 'authenticated'))
    expect(second).toMatchObject({ ok: false, code: 'SWAP_PENDING' })
  })

  it('decline changes nothing, frees the lock, and the requester is told', async () => {
    const { a } = await twoBooked()
    const req = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    const r = await respondSwap((req as any).swap.swapId, 'decline', as('p-b'))
    expect(r.ok).toBe(true)
    expect(bookingOn('2026-11-15')).toMatchObject({ personId: 'p-a' })
    expect(bookingOn('2026-11-15').openSwapId).toBeUndefined()
    expect(emails.sendSwapOutcomeEmail).toHaveBeenCalledWith(expect.anything(), 'declined')
  })

  it('a filled date with no reachable person cannot be swapped', async () => {
    memorialRow('2026-11-15')
    memorialRow('2026-11-22', { Exhort: 'Unknown Visitor' })
    const a = await invite('p-a', ['2026-11-15'], WINDOW)
    await acceptInvite(a.inviteId, '2026-11-15', as('p-a'))
    const r = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    expect(r).toMatchObject({ ok: false, code: 'TARGET_UNREACHABLE' })
  })

  it('expires after 7 days or at the START of the earlier appointment, whichever is sooner', () => {
    const created = new Date('2026-11-12T12:00:00.000Z')
    const sunday = { date: '2026-11-15', time: '11:00', tz: 'America/Toronto' }
    const later = { date: '2026-12-27', time: '11:00', tz: 'America/Toronto' }
    expect(swapExpiry(created, sunday, later).toISOString()).toBe('2026-11-15T16:00:00.000Z')
    const far = { date: '2027-01-03', time: '11:00', tz: 'America/Toronto' }
    expect(swapExpiry(created, later, far).toISOString()).toBe('2026-11-19T12:00:00.000Z')
  })

  it('an expired request cannot be accepted', async () => {
    const { a } = await twoBooked()
    const req = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    __setClock(() => new Date('2026-11-15T16:00:00.000Z')) // the earlier appointment starts
    const r = await respondSwap((req as any).swap.swapId, 'accept', as('p-b'))
    expect(r).toMatchObject({ ok: false, code: 'SWAP_EXPIRED' })
    expect(bookingOn('2026-11-15').personId).toBe('p-a')
  })
})

describe('short-notice swap (§7.6): within 24h of either appointment', () => {
  const WINDOW = { otherDatesWindow: { from: '2026-11-13', to: '2026-12-31' } }

  async function requested() {
    memorialRow('2026-11-15', { Preside: 'Pat Presider' })
    memorialRow('2026-11-22', { Preside: 'Quinn Presider' })
    const a = await invite('p-a', ['2026-11-15'], WINDOW)
    const b = await invite('p-b', ['2026-11-22'], WINDOW)
    await acceptInvite(a.inviteId, '2026-11-15', as('p-a'))
    await acceptInvite(b.inviteId, '2026-11-22', as('p-b'))
    const req = await requestSwap(a.inviteId, '2026-11-22', undefined, as('p-a', 'authenticated'))
    return (req as any).swap.swapId as string
  }

  // The earlier appointment starts 2026-11-15T16:00Z (11:00 Toronto).
  it('exactly 24h before the start: the result + both confirmations carry the counterpart to inform', async () => {
    const swapId = await requested()
    __setClock(() => new Date('2026-11-14T16:00:00.000Z'))
    vi.mocked(emails.sendConfirmationEmail).mockClear()
    const r = await respondSwap(swapId, 'accept', as('p-b'))
    expect(r.ok).toBe(true)
    expect((r as any).shortNotice).toEqual([
      { date: '2026-11-15', counterpartRole: 'Presiding', counterpartName: 'Pat Presider' },
      { date: '2026-11-22', counterpartRole: 'Presiding', counterpartName: 'Quinn Presider' },
    ])
    const calls = vi.mocked(emails.sendConfirmationEmail).mock.calls
    expect(calls.map((c) => [c[1].date, c[2]?.shortNotice?.counterpartName])).toEqual([
      ['2026-11-22', 'Quinn Presider'],
      ['2026-11-15', 'Pat Presider'],
    ])
  })

  it('one minute more than 24h before: no note', async () => {
    const swapId = await requested()
    __setClock(() => new Date('2026-11-14T15:59:00.000Z'))
    const r = await respondSwap(swapId, 'accept', as('p-b'))
    expect(r.ok).toBe(true)
    expect((r as any).shortNotice).toBeUndefined()
    for (const call of vi.mocked(emails.sendConfirmationEmail).mock.calls) {
      expect(call[2]?.shortNotice).toBeUndefined()
    }
  })
})

describe('lecture (criterion 10): manual dates, booking on the invite only, no swap', () => {
  it('requires a time for each date, accepts without any booking or overlay, and refuses swaps', async () => {
    const missing = await createInvite({
      ecclesia: ECC, type: 'lecture', inviter: RB, invitee: { personId: 'p-a' }, dates: [{ date: '2026-11-20' }],
    })
    expect(missing).toMatchObject({ ok: false, code: 'INVALID_INPUT' })

    const r = await createInvite({
      ecclesia: ECC, type: 'lecture', inviter: RB, invitee: { personId: 'p-a' },
      dates: [{ date: '2026-11-20', time: '19:30' }, { date: '2026-11-27', time: '19:30', tz: 'America/Vancouver' }],
    })
    expect(r.ok).toBe(true)
    const inv = (r as any).invite
    expect(inv.offeredDates).toEqual([
      { date: '2026-11-20', time: '19:30', tz: 'America/Toronto' },
      { date: '2026-11-27', time: '19:30', tz: 'America/Vancouver' },
    ])

    const acc = await acceptInvite(inv.inviteId, '2026-11-27', as('p-a'))
    expect(acc.ok).toBe(true)
    expect(h.state.invites.get(inv.inviteId)).toMatchObject({
      status: 'accepted', acceptedDate: '2026-11-27', acceptedTime: '19:30', acceptedTz: 'America/Vancouver',
    })
    expect(h.state.bookings.size).toBe(0)
    expect(h.state.overrides.size).toBe(0)

    const ch = await changeDate(inv.inviteId, '2026-11-20', as('p-a'))
    expect(ch.ok).toBe(true)
    expect(h.state.invites.get(inv.inviteId).acceptedDate).toBe('2026-11-20')

    const swap = await requestSwap(inv.inviteId, '2026-11-27', undefined, as('p-a', 'authenticated'))
    expect(swap).toMatchObject({ ok: false, code: 'SWAP_NOT_AVAILABLE' })

    const cancelled = await cancelByInvitee(inv.inviteId, as('p-a'))
    expect(cancelled.ok).toBe(true)
    expect(emails.sendCancellationEmail).toHaveBeenCalledTimes(1)
  })
})
