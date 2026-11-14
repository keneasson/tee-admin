import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * Invitation programs through the service (docs/SPEAKER_INVITATIONS.md §3a).
 * Same in-memory harness as speaker-invites-service.test.ts: DynamoDB is never
 * touched, and every commit is applied atomically with its conditions.
 * Placeholder people only.
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
    // The household default: the holder whose EMAIL# row is not loginExcluded.
    getByEmail: async (email: string) =>
      [...h.state.people.values()].find(
        (p) => (p.primaryEmail === email || (p.emails ?? []).some((e: any) => e.email === email)) && !p.loginExcludedFor?.includes(email)
      ) ?? null,
    getAllPersonsByEmail: async (email: string) =>
      [...h.state.people.values()].filter((p) => p.primaryEmail === email || (p.emails ?? []).some((e: any) => e.email === email)),
    addEmail: vi.fn(async (personId: string, row: any) => {
      const p = h.state.people.get(personId)
      p.emails = [...(p.emails ?? []), row]
      if (row.loginExcluded) p.loginExcludedFor = [...(p.loginExcludedFor ?? []), row.email]
      return row
    }),
    addPhone: vi.fn(async () => undefined),
    searchByName: async (last: string, first?: string) => ({
      items: [...h.state.people.values()].filter(
        (p) => p.lastName.toLowerCase() === last && (!first || p.firstName.toLowerCase().startsWith(first))
      ),
    }),
    create: vi.fn(async (input: any) => {
      const p: any = { ...input, personId: `p-new-${h.state.people.size}`, primaryEmail: input.email ?? '' }
      if (input.email && input.emailLoginExcluded) p.loginExcludedFor = [input.email]
      h.state.people.set(p.personId, p)
      return p
    }),
  },
}))

vi.mock('@my/app/provider/dynamodb/repositories/privacy-repository', () => ({
  privacyRepository: { createPrivacySettings: vi.fn(async () => undefined) },
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


import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  __setClock,
  acceptInvite,
  cancelByInvitee,
  createInvite,
  requestSwap,
  type Actor,
} from '@/utils/speaker-invites/service'
import { getSlots } from '@/utils/speaker-invites/slots'
import type { InviteProgram } from '@my/app/provider/dynamodb/invite-program-types'

const ECC = 'Test Ecclesia'
const RB: Actor = { personId: 'p-rb', trust: 'authenticated' }
// Thursday 2026-11-12, noon UTC. Fridays: 13, 20, 27 Nov. Sundays: 15, 22, 29 Nov.
const NOW = new Date('2026-11-12T12:00:00.000Z')
const CYC_SLOT = { scheduleType: 'cyc' as const, field: 'speaker' }

function person(id: string, first: string, last: string, email: string, facts: Record<string, any> = {}) {
  h.state.people.set(id, { personId: id, firstName: first, lastName: last, displayName: `${first} ${last}`, primaryEmail: email, ecclesia: ECC, ...facts })
}

/** A CYC roster row (the registry's built-in CYC roster role is `speaker`). */
function cycRow(date: string, data: Record<string, any> = {}) {
  h.state.rows.push({
    PK: 'SCHEDULE#CYC',
    SK: `DATE#${date}`,
    ecclesia: ECC,
    type: 'cyc',
    date,
    data: { speaker: '', topic: 'Placeholder topic', DateTime: `${date}T23:30:00.000Z`, ServiceTimezone: 'America/Toronto', ...data },
  })
}

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

const cycClass: InviteProgram = {
  programId: 'cyc-class',
  name: 'CYC class',
  phrase: 'lead a CYC class',
  about: 'Our CYC meets at the hall on Friday evenings.',
  who: 'anyone',
  where: 'region',
  link: { scheduleId: 'cyc', field: 'speaker' },
  lengthMinutes: 75,
  active: true,
  order: 3,
}

const sisterClass: InviteProgram = {
  programId: 'sister-class',
  name: 'Sister Class',
  phrase: 'share a message at our Sister Class',
  who: 'sisters',
  where: 'region',
  lengthMinutes: 60,
  active: true,
  order: 4,
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
  person('p-a', 'Alex', 'Speaker', 'alex@example.test', { gender: 'male', baptized: true })
  person('p-s', 'Ann', 'Example', 'ann@example.test', { gender: 'female', baptized: true })
})

afterEach(() => __setClock(null))

describe('a program linked to a registered CYC roster (§3a)', () => {
  it('scans the roster, books into its `speaker` field, and the overlay shows the speaker', async () => {
    cycRow('2026-11-20')
    cycRow('2026-11-27', { speaker: 'Brad Tester' })

    const open = await getSlots(ECC, 'cyc-class', '2026-11-14', '2026-11-28', CYC_SLOT)
    // Every expected CYC day is listed (labelled, never dropped); the two roster rows read OPEN / FILLED.
    const by = Object.fromEntries(open.map((s) => [s.date, s.state]))
    expect(by['2026-11-20']).toBe('OPEN')
    expect(by['2026-11-27']).toBe('FILLED')
    expect(open.filter((s) => s.state !== 'NO_MEETING').map((s) => s.date)).toEqual(['2026-11-20', '2026-11-27'])

    const created = await createInvite({
      ecclesia: ECC,
      type: 'cyc-class',
      program: cycClass,
      slot: CYC_SLOT,
      inviter: RB,
      invitee: { personId: 'p-a' },
      dates: [{ date: '2026-11-20' }],
    })
    if (!created.ok) throw new Error(created.code)
    expect(created.invite.programSnapshot).toEqual({
      name: 'CYC class',
      phrase: 'lead a CYC class',
      about: 'Our CYC meets at the hall on Friday evenings.',
      lengthMinutes: 75,
      who: 'anyone',
      slot: CYC_SLOT,
    })
    // The schedule's time is offered, as for memorial/bible class.
    expect(created.invite.offeredDates).toEqual([{ date: '2026-11-20', time: '18:30', tz: 'America/Toronto' }])

    const accepted = await acceptInvite(created.invite.inviteId, '2026-11-20', as('p-a'))
    expect(accepted.ok).toBe(true)
    // The booking is keyed by the program id; the overlay is the CYC occurrence's `speaker` field.
    expect(h.state.bookings.get(`${ECC}|cyc-class|2026-11-20`)).toMatchObject({ personId: 'p-a', type: 'cyc-class' })
    const override = h.state.overrides.get(`SERVICE_OVERRIDE#${ECC}|cyc#2026-11-20`)
    expect(override).toMatchObject({ serviceType: 'cyc', roleFields: { speaker: 'Alex Speaker' }, roleFieldRefs: { speaker: 'p-a' } })
    expect(h.state.overrides.has(`SERVICE_OVERRIDE#${ECC}|memorial#2026-11-20`)).toBe(false)

    const [after] = await getSlots(ECC, 'cyc-class', '2026-11-20', '2026-11-20', CYC_SLOT)
    expect(after).toMatchObject({ state: 'FILLED', speakerName: 'Alex Speaker', speakerPersonId: 'p-a' })

    // Cancelling clears the same field again.
    expect((await cancelByInvitee(created.invite.inviteId, as('p-a'))).ok).toBe(true)
    expect(h.state.bookings.has(`${ECC}|cyc-class|2026-11-20`)).toBe(false)
    expect(h.state.overrides.get(`SERVICE_OVERRIDE#${ECC}|cyc#2026-11-20`)?.roleFields?.speaker).toBeUndefined()
  })
})

describe('a program with no linked schedule (§3a, like Lecture)', () => {
  it('takes typed dates, books on the invite only, and has no swap', async () => {
    const unlinked: InviteProgram = { ...cycClass, programId: 'youth-meditation', name: 'Youth meditation', phrase: 'share a meditation', link: undefined }
    const created = await createInvite({
      ecclesia: ECC,
      type: 'youth-meditation',
      program: unlinked,
      slot: null,
      inviter: RB,
      invitee: { personId: 'p-s' },
      dates: [{ date: '2026-11-21', time: '19:00' }],
    })
    if (!created.ok) throw new Error(created.code)
    expect(created.invite.offeredDates).toEqual([{ date: '2026-11-21', time: '19:00', tz: 'America/Toronto' }])
    expect(created.invite.programSnapshot?.slot).toBeUndefined()

    const accepted = await acceptInvite(created.invite.inviteId, '2026-11-21', as('p-s'))
    expect(accepted).toMatchObject({ ok: true, invite: { acceptedDate: '2026-11-21', acceptedTime: '19:00' } })
    expect(h.state.bookings.size).toBe(0)
    expect(h.state.overrides.size).toBe(0)
    expect(await requestSwap(created.invite.inviteId, '2026-11-28', undefined, as('p-s', 'authenticated'))).toMatchObject({
      ok: false,
      code: 'SWAP_NOT_AVAILABLE',
    })
  })

  it('a time is required for each typed date', async () => {
    const r = await createInvite({
      ecclesia: ECC,
      type: 'sister-class',
      program: sisterClass,
      slot: null,
      inviter: RB,
      invitee: { personId: 'p-s' },
      dates: [{ date: '2026-11-21' }],
    })
    expect(r).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
  })
})

describe('WHO is enforced by the server (NOT_INVITABLE)', () => {
  const sisterInvite = (personId: string) =>
    createInvite({
      ecclesia: ECC,
      type: 'sister-class',
      program: sisterClass,
      slot: null,
      inviter: RB,
      invitee: { personId },
      dates: [{ date: '2026-11-21', time: '14:00' }],
      send: false,
    })

  it('a sisters program refuses a recorded brother, and anyone whose gender is unrecorded', async () => {
    person('p-unset', 'Casey', 'Placeholder', 'casey@example.test')
    expect(await sisterInvite('p-a')).toMatchObject({ ok: false, code: 'NOT_INVITABLE' })
    expect(await sisterInvite('p-unset')).toMatchObject({ ok: false, code: 'NOT_INVITABLE' })
    expect((await sisterInvite('p-s')).ok).toBe(true)
  })

  it('a sisters program adds a new person only as a Sister', async () => {
    const add = (gender: 'male' | 'female') =>
      createInvite({
        ecclesia: ECC,
        type: 'sister-class',
        program: sisterClass,
        slot: null,
        inviter: RB,
        invitee: { firstName: 'Dana', lastName: 'Placeholder', email: `dana-${gender}@example.test`, gender, ecclesia: ECC },
        dates: [{ date: '2026-11-21', time: '14:00' }],
        send: false,
      })
    expect(await add('male')).toMatchObject({ ok: false, code: 'NOT_INVITABLE' })
    const ok = await add('female')
    expect(ok.ok).toBe(true)
    expect(personRepository.create).toHaveBeenCalledWith(expect.objectContaining({ gender: 'female' }))
  })

  it('a brethren program still refuses a sister (§9b unchanged)', async () => {
    memorialRow('2026-11-15')
    const r = await createInvite({ ecclesia: ECC, type: 'memorial', inviter: RB, invitee: { personId: 'p-s' }, dates: [{ date: '2026-11-15' }] })
    expect(r).toMatchObject({ ok: false, code: 'NOT_INVITABLE' })
  })
})

describe('core programs stay as they were', () => {
  it('memorial without a program: same booking key and Exhort overlay, and a snapshot of the built-in wording', async () => {
    memorialRow('2026-11-15')
    const created = await createInvite({ ecclesia: ECC, type: 'memorial', inviter: RB, invitee: { personId: 'p-a' }, dates: [{ date: '2026-11-15' }] })
    if (!created.ok) throw new Error(created.code)
    expect(created.invite.programSnapshot).toEqual({
      name: 'Memorial exhortation',
      phrase: 'exhort at our Memorial Service',
      lengthMinutes: 90,
      who: 'brethren',
      slot: { scheduleType: 'memorial', field: 'Exhort' },
    })
    await acceptInvite(created.invite.inviteId, '2026-11-15', as('p-a'))
    expect(h.state.bookings.get(`${ECC}|memorial|2026-11-15`)).toMatchObject({ pkey: `SPEAKER_BOOKING#${ECC}#memorial`, skey: '2026-11-15' })
    expect(h.state.overrides.get(`SERVICE_OVERRIDE#${ECC}|memorial#2026-11-15`)?.roleFields).toEqual({ Exhort: 'Alex Speaker' })
  })

  it('an invite stored before programs (no snapshot) still accepts into its type’s fixed slot', async () => {
    memorialRow('2026-11-15')
    const created = await createInvite({ ecclesia: ECC, type: 'memorial', inviter: RB, invitee: { personId: 'p-a' }, dates: [{ date: '2026-11-15' }] })
    if (!created.ok) throw new Error(created.code)
    const stored = h.state.invites.get(created.invite.inviteId)
    delete stored.programSnapshot
    expect((await acceptInvite(created.invite.inviteId, '2026-11-15', as('p-a'))).ok).toBe(true)
    expect(h.state.overrides.get(`SERVICE_OVERRIDE#${ECC}|memorial#2026-11-15`)?.roleFields).toEqual({ Exhort: 'Alex Speaker' })
  })

  it('a switched-off program cannot be sent; an unknown id is refused', async () => {
    const off = await createInvite({
      ecclesia: ECC,
      type: 'cyc-class',
      program: { ...cycClass, active: false },
      inviter: RB,
      invitee: { personId: 'p-a' },
      dates: [{ date: '2026-11-20' }],
    })
    expect(off).toMatchObject({ ok: false, code: 'INVALID_INPUT' })
    const unknown = await createInvite({ ecclesia: ECC, type: 'not-a-program', inviter: RB, invitee: { personId: 'p-a' }, dates: [{ date: '2026-11-20' }] })
    expect(unknown).toMatchObject({ ok: false, code: 'INVALID_INPUT', message: 'Unknown invitation type.' })
  })
})
