import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * GET /api/user/emails — DATA-LOSS SAFETY for multi-email people.
 *
 * The email-system consolidation makes the PersonRecord EMAIL# store the single
 * source of truth, and heals historical addresses that only ever lived in the
 * legacy USER# store via a lazy-migrate on read (see the GET handler). These
 * tests PROVE that consolidation never drops or duplicates a person's addresses —
 * the failure mode that matters for someone like a Recording Brother (e.g. Geoff
 * McKay of Brampton) who has several personal emails plus a role email.
 *
 * The PersonRecord side is a STATEFUL mock: `addEmail` actually appends to the
 * in-memory row set and `getEmails` returns the current set. That is deliberate —
 * the GET handler re-reads `getEmails` AFTER migrating, so the returned response
 * reflects exactly what the migration wrote. If the handler dropped or duplicated
 * an address, the asserted response set would be wrong.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  u_getEmails: vi.fn(),
  p_getByEmail: vi.fn(),
  p_getAllPersonsByEmail: vi.fn(),
  p_getEmails: vi.fn(),
  p_addEmail: vi.fn(),
  t_getByPersonAndType: vi.fn(),
  optInCount: vi.fn(),
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
vi.mock('../utils/email/public-topics', () => ({ getPublicOptInCount: h.optInCount }))

import { GET } from '../app/api/user/emails/route'

const PID = 'geoff-mckay-1'
const PRIMARY = 'geoff@brampton.example'

const GEOFF: any = { personId: PID, primaryEmail: PRIMARY }

// ---- Stateful PersonRecord EMAIL# store ------------------------------------

let rows: any[]

/** Seed the person's existing PersonRecord EMAIL# rows. */
function seedPersonEmails(
  initial: Array<{ emailId: string; email: string; emailType?: string; order?: number; verified?: boolean; sesSubscribed?: boolean }>
) {
  rows = initial.map((r, i) => ({
    pkey: `PERSON#${PID}`,
    skey: `EMAIL#${r.emailId}`,
    gsi1pk: `EMAIL#${r.email.toLowerCase()}`,
    gsi1sk: `PERSON#${PID}`,
    emailId: r.emailId,
    email: r.email.toLowerCase(),
    emailType: r.emailType ?? 'secondary',
    order: r.order ?? i,
    verified: r.verified ?? false,
    sesSubscribed: r.sesSubscribed ?? false,
    sesStatus: 'active',
  }))
}

/** Legacy USER# EmailRecord shape returned by userRepository.getEmails. */
function legacy(
  items: Array<{ email: string; isPrimary?: boolean; order?: number; verified?: boolean; subscribed?: boolean }>
) {
  h.u_getEmails.mockResolvedValue({
    items: items.map((r, i) => ({
      emailId: `legacy-${i}`,
      email: r.email,
      isPrimary: r.isPrimary ?? false,
      order: r.order ?? i,
      verified: r.verified ?? false,
      subscribed: r.subscribed,
    })),
  })
}

async function getJson() {
  const res = await GET()
  expect(res.status).toBe(200)
  const body = await res.json()
  return body.emails as Array<{
    id: string
    email: string
    verified: boolean
    subscribed?: boolean
    isPrimary?: boolean
    roleLabel?: string
  }>
}

const addressesMigrated = () => h.p_addEmail.mock.calls.map((c) => c[1].email)

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: PRIMARY } })
  h.p_getByEmail.mockResolvedValue(GEOFF)
  h.p_getAllPersonsByEmail.mockResolvedValue([GEOFF])
  h.t_getByPersonAndType.mockResolvedValue([])
  h.optInCount.mockResolvedValue(2)

  // Stateful store wiring: addEmail appends, getEmails returns the live set.
  rows = []
  h.p_getEmails.mockImplementation(async () => rows.map((r) => ({ ...r })))
  h.p_addEmail.mockImplementation(async (pid: string, rec: any) => {
    const emailId = `migrated-${rows.length}`
    const row = {
      pkey: `PERSON#${pid}`,
      skey: `EMAIL#${emailId}`,
      gsi1pk: `EMAIL#${rec.email.toLowerCase()}`,
      gsi1sk: `PERSON#${pid}`,
      emailId,
      ...rec,
      email: rec.email.toLowerCase(),
    }
    rows.push(row)
    return row
  })
})

describe('GET /api/user/emails — multi-email consolidation (no drop, no dupe)', () => {
  it('1) secondaries only in the legacy USER# store are ALL migrated; primary is left untouched', async () => {
    // Login email already has its PersonRecord EMAIL# row (created at signup).
    seedPersonEmails([{ emailId: 'p', email: PRIMARY, emailType: 'primary', order: 0, verified: true }])
    // Legacy has the primary plus 3 secondaries that never made it onto the PersonRecord.
    legacy([
      { email: PRIMARY, isPrimary: true, verified: true },
      { email: 'geoff.personal@gmail.example', order: 1, verified: true },
      { email: 'geoffmckay@outlook.example', order: 2 },
      { email: 'g.mckay@work.example', order: 3, verified: true },
    ])

    const emails = await getJson()
    const set = emails.map((e) => e.email.toLowerCase())

    // None lost: all four addresses present.
    expect(set).toEqual(
      expect.arrayContaining([
        PRIMARY,
        'geoff.personal@gmail.example',
        'geoffmckay@outlook.example',
        'g.mckay@work.example',
      ])
    )
    expect(set).toHaveLength(4)

    // Primary stays primary — exactly one, and it is the login email.
    const primaries = emails.filter((e) => e.isPrimary)
    expect(primaries).toHaveLength(1)
    expect(primaries[0].email.toLowerCase()).toBe(PRIMARY)

    // Exactly the 3 USER#-only secondaries were migrated — NOT the primary.
    expect(h.p_addEmail).toHaveBeenCalledTimes(3)
    expect(addressesMigrated()).toEqual(
      expect.arrayContaining([
        'geoff.personal@gmail.example',
        'geoffmckay@outlook.example',
        'g.mckay@work.example',
      ])
    )
    expect(addressesMigrated()).not.toContain(PRIMARY)
  })

  it('2) addresses split across BOTH stores union with no duplicates and no loss', async () => {
    // Already on the PersonRecord: primary + one already-healed secondary.
    seedPersonEmails([
      { emailId: 'p', email: PRIMARY, emailType: 'primary', order: 0, verified: true },
      { emailId: 's1', email: 'shared@both.example', emailType: 'secondary', order: 1, verified: true },
    ])
    // Legacy overlaps on primary + shared@both, and adds two USER#-only addresses.
    legacy([
      { email: PRIMARY, isPrimary: true, verified: true },
      { email: 'shared@both.example', order: 1, verified: true }, // overlap — must NOT duplicate
      { email: 'legacy-only-a@x.example', order: 2, verified: true },
      { email: 'legacy-only-b@x.example', order: 3 },
    ])

    const emails = await getJson()
    const set = emails.map((e) => e.email.toLowerCase())

    // Union by address, no duplicates.
    expect(new Set(set).size).toBe(set.length)
    expect(set.sort()).toEqual(
      [PRIMARY, 'shared@both.example', 'legacy-only-a@x.example', 'legacy-only-b@x.example'].sort()
    )

    // Only the genuinely USER#-only addresses were migrated.
    expect(h.p_addEmail).toHaveBeenCalledTimes(2)
    expect(addressesMigrated().sort()).toEqual(['legacy-only-a@x.example', 'legacy-only-b@x.example'])
  })

  it('3) verified + subscribed + order carry over onto the migrated PersonRecord row', async () => {
    seedPersonEmails([{ emailId: 'p', email: PRIMARY, emailType: 'primary', order: 0, verified: true }])
    legacy([
      { email: PRIMARY, isPrimary: true, verified: true },
      { email: 'verified.sub@x.example', order: 7, verified: true, subscribed: true },
    ])

    const emails = await getJson()

    expect(h.p_addEmail).toHaveBeenCalledTimes(1)
    const [, rec] = h.p_addEmail.mock.calls[0]
    expect(rec.email).toBe('verified.sub@x.example')
    expect(rec.emailType).toBe('secondary')
    expect(rec.verified).toBe(true)
    expect(rec.sesSubscribed).toBe(true) // subscribed → sesSubscribed
    expect(rec.order).toBe(7) // order carried, not defaulted

    // And it surfaces in the response as verified + subscribed.
    const migrated = emails.find((e) => e.email.toLowerCase() === 'verified.sub@x.example')!
    expect(migrated.verified).toBe(true)
    expect(migrated.subscribed).toBe(true)
  })

  it('4) idempotent: a second GET after everything is on the PersonRecord migrates nothing and returns the same set', async () => {
    seedPersonEmails([
      { emailId: 'p', email: PRIMARY, emailType: 'primary', order: 0, verified: true },
      { emailId: 's1', email: 'a@x.example', emailType: 'secondary', order: 1, verified: true },
      { emailId: 's2', email: 'b@x.example', emailType: 'secondary', order: 2 },
    ])
    // Legacy holds the same addresses — all already known, so nothing to heal.
    legacy([
      { email: PRIMARY, isPrimary: true, verified: true },
      { email: 'a@x.example', order: 1, verified: true },
      { email: 'b@x.example', order: 2 },
    ])

    const first = await getJson()
    expect(h.p_addEmail).not.toHaveBeenCalled()

    const second = await getJson()
    expect(h.p_addEmail).not.toHaveBeenCalled()

    const norm = (list: typeof first) => list.map((e) => e.email.toLowerCase()).sort()
    expect(norm(second)).toEqual(norm(first))
    expect(norm(first)).toEqual([PRIMARY, 'a@x.example', 'b@x.example'].sort())
  })

  it('5) a legacy address differing ONLY in case is the same address — no duplicate, no migrate', async () => {
    seedPersonEmails([
      { emailId: 'p', email: PRIMARY, emailType: 'primary', order: 0, verified: true },
      { emailId: 's1', email: 'mixed.case@x.example', emailType: 'secondary', order: 1, verified: true },
    ])
    // Legacy carries the SAME address in a different case.
    legacy([
      { email: PRIMARY.toUpperCase(), isPrimary: true, verified: true },
      { email: 'Mixed.Case@X.Example', order: 1, verified: true },
    ])

    const emails = await getJson()
    const set = emails.map((e) => e.email.toLowerCase())

    expect(new Set(set).size).toBe(set.length) // no case-only duplicate
    expect(set.sort()).toEqual([PRIMARY, 'mixed.case@x.example'].sort())
    expect(h.p_addEmail).not.toHaveBeenCalled()
  })

  it('6) Recording Brother: all personal addresses remain AND the role email is injected read-only (never written back)', async () => {
    const RB_EMAIL = 'recorder@brampton-ecclesia.example'
    h.p_getByEmail.mockResolvedValue({
      ...GEOFF,
      isRecordingBrother: true,
      rbEcclesiaEmail: RB_EMAIL,
    })
    h.p_getAllPersonsByEmail.mockResolvedValue([
      { ...GEOFF, isRecordingBrother: true, rbEcclesiaEmail: RB_EMAIL },
    ])

    // Geoff's real personal addresses, already consolidated onto the PersonRecord.
    seedPersonEmails([
      { emailId: 'p', email: PRIMARY, emailType: 'primary', order: 0, verified: true },
      { emailId: 's1', email: 'geoff.personal@gmail.example', emailType: 'secondary', order: 1, verified: true },
      { emailId: 's2', email: 'g.mckay@work.example', emailType: 'secondary', order: 2, verified: true },
    ])
    legacy([]) // nothing left in the legacy store

    const emails = await getJson()
    const set = emails.map((e) => e.email.toLowerCase())

    // All three personal addresses still present, alongside the injected role email.
    expect(set).toEqual(
      expect.arrayContaining([
        PRIMARY,
        'geoff.personal@gmail.example',
        'g.mckay@work.example',
        RB_EMAIL,
      ])
    )
    expect(set).toHaveLength(4)

    // The RB entry is read-only role metadata, not a personal address.
    const rb = emails.find((e) => e.email.toLowerCase() === RB_EMAIL)!
    expect(rb.roleLabel).toBe('Recording Brother')
    expect(rb.isPrimary).toBeFalsy()

    // The role email is NOT written back onto the personal EMAIL# set.
    expect(h.p_addEmail).not.toHaveBeenCalled()
    expect(addressesMigrated()).not.toContain(RB_EMAIL)
  })
})
