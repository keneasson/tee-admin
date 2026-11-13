/**
 * Office ASSIGNMENT planning (R3, docs/legacy-people-retirement-plan.md §0).
 *
 * PURE: turns the owner's CONFIRMED review-page answers plus a snapshot of the
 * table into a list of office writes, and predicts the inter-ecclesia
 * recipients those offices would yield. `scripts/backfill-office-assignments.ts`
 * does the I/O (dry run by default); everything that decides is here, so it is
 * unit-tested without DynamoDB.
 *
 * The input file is private (it may hold office inbox addresses) and never
 * lives in the repo. Shape:
 *
 *   {
 *     "assignments": [
 *       { "ecclesiaId": "toronto-east", "office": "rb",  "holderPersonId": "<uuid>", "confirmed": true },
 *       { "ecclesiaId": "toronto-east", "office": "rep", "inboxFromPersonId": "<uuid>", "confirmed": true },
 *       { "ecclesiaId": "cambridge",    "office": "rep#2", "inbox": "role@example.org", "holderPersonId": null, "confirmed": true }
 *     ]
 *   }
 *
 *   office            `rb`, `rep` (next free slot), `rep#<n>`, or another slug (`treasurer`)
 *   holderPersonId    the current holder; must be a NAMED person who is not a test account. null = vacant.
 *   inbox             the office's own address (a role inbox)
 *   inboxFromPersonId copy that record's primary address as the office inbox — how today's
 *                     nameless "ecclesia mailbox" records become office inboxes without retyping
 *   phone             the office's own phone
 *   confirmed         only rows the owner confirmed are applied; the rest are counted and skipped
 *
 * Rules: never deletes or merges anything; every ecclesia ends with an RB
 * office (vacant if unassigned); no office holder is a nameless person; test
 * accounts are excluded everywhere.
 */
import {
  OFFICE_ROLES,
  isTestAccountEmail,
  normalizeOfficeRole,
  parseOfficeId,
  repOfficeId,
  resolveInterEcclesiaContacts,
  type InterEcclesiaContact,
  type OfficeHolder,
  type OfficeRecord,
} from './office-repository'

export interface OfficeAssignmentInput {
  ecclesiaId: string
  office: string
  holderPersonId?: string | null
  inbox?: string | null
  inboxFromPersonId?: string
  phone?: string | null
  confirmed?: boolean
}

export interface OfficeAssignmentFile {
  assignments: OfficeAssignmentInput[]
}

/** What the planner needs to know about a person (no PII leaves the planner except addresses for the diff). */
export interface PersonSnapshot {
  personId: string
  named: boolean
  primaryEmail: string
}

export type OfficeAction =
  | { op: 'createOffice'; ecclesiaId: string; officeId: string; reason: 'rb-missing' | 'assignment' }
  | { op: 'setChannels'; ecclesiaId: string; officeId: string; email?: string | null; phone?: string | null }
  | { op: 'assignHolder'; ecclesiaId: string; officeId: string; personId: string | null }

export interface OfficePlan {
  actions: OfficeAction[]
  /** Row-level problems; any error blocks --apply. Ids only, never an address or a name. */
  errors: Array<{ row: number; error: string }>
  skippedUnconfirmed: number
  /** The offices as they would stand after the plan (for the recipient diff). */
  offices: OfficeRecord[]
}

const blankOffice = (ecclesiaId: string, officeId: string): OfficeRecord => {
  const { kind, slot } = parseOfficeId(officeId)
  return {
    pkey: `ECCLESIA_ID#${ecclesiaId}`,
    skey: `OFFICE#${officeId}`,
    type: 'OFFICE',
    ecclesiaId,
    role: officeId,
    kind,
    slot,
    title: officeId,
    terms: [],
    createdAt: '',
    updatedAt: '',
    version: 0,
  }
}

export function planOfficeAssignments(input: {
  file: OfficeAssignmentFile
  ecclesiaIds: string[]
  persons: Map<string, PersonSnapshot>
  existingOffices: OfficeRecord[]
}): OfficePlan {
  const { file, persons } = input
  const ecclesiaIds = new Set(input.ecclesiaIds)
  const offices = new Map(input.existingOffices.map((o) => [`${o.ecclesiaId}|${o.role}`, { ...o }]))
  const actions: OfficeAction[] = []
  const errors: OfficePlan['errors'] = []
  let skippedUnconfirmed = 0

  const nextRepSlot = (ecclesiaId: string) => {
    const used = [...offices.values()].filter((o) => o.ecclesiaId === ecclesiaId && o.kind === OFFICE_ROLES.REP)
    return Math.max(0, ...used.map((o) => o.slot || 0)) + 1
  }
  // A slot-less "rep" row reuses the Rep office that already has its inbox or
  // holder, so re-running the same file is a no-op instead of a new slot.
  const sameRep = (ecclesiaId: string, holder?: string | null, inbox?: string | null) => {
    const email = inbox?.trim().toLowerCase()
    return [...offices.values()].find(
      (o) =>
        o.ecclesiaId === ecclesiaId &&
        o.kind === OFFICE_ROLES.REP &&
        ((email && o.email === email) || (holder && o.holderPersonId === holder))
    )?.role
  }
  const ensure = (ecclesiaId: string, officeId: string, reason: 'rb-missing' | 'assignment') => {
    const key = `${ecclesiaId}|${officeId}`
    if (!offices.has(key)) {
      offices.set(key, blankOffice(ecclesiaId, officeId))
      actions.push({ op: 'createOffice', ecclesiaId, officeId, reason })
    }
    return offices.get(key) as OfficeRecord
  }

  const assignedRb = new Set<string>()
  ;(file.assignments || []).forEach((row, i) => {
    const rowNo = i + 1
    if (row.confirmed !== true) {
      skippedUnconfirmed++
      return
    }
    if (!row.ecclesiaId || !ecclesiaIds.has(row.ecclesiaId)) {
      errors.push({ row: rowNo, error: `unknown ecclesia id "${row.ecclesiaId}"` })
      return
    }
    const rowInbox = row.inboxFromPersonId ? persons.get(row.inboxFromPersonId)?.primaryEmail : row.inbox
    let officeId: string
    try {
      officeId = row.office?.trim().toLowerCase() === OFFICE_ROLES.REP
        ? sameRep(row.ecclesiaId, row.holderPersonId, rowInbox) || repOfficeId(nextRepSlot(row.ecclesiaId))
        : normalizeOfficeRole(row.office)
    } catch (error: any) {
      errors.push({ row: rowNo, error: error.message })
      return
    }
    if (officeId === OFFICE_ROLES.RECORDING_BROTHER && assignedRb.has(row.ecclesiaId)) {
      errors.push({ row: rowNo, error: `second Recording Brother row for ${row.ecclesiaId}` })
      return
    }

    // Holder: a named, real person (never an office mailbox, never a test account).
    const holder = row.holderPersonId ? persons.get(row.holderPersonId) : undefined
    if (row.holderPersonId && !holder) {
      errors.push({ row: rowNo, error: `holder ${row.holderPersonId} has no PROFILE` })
      return
    }
    if (holder && !holder.named) {
      errors.push({ row: rowNo, error: `holder ${holder.personId} is a nameless record; an office mailbox is not a person (use inboxFromPersonId)` })
      return
    }
    if (holder && isTestAccountEmail(holder.primaryEmail)) {
      errors.push({ row: rowNo, error: `holder ${holder.personId} is a test account` })
      return
    }

    // Inbox: given, or copied from a (typically nameless) mailbox record.
    let inbox: string | null | undefined = row.inbox === undefined ? undefined : row.inbox ? row.inbox.trim().toLowerCase() : null
    if (row.inboxFromPersonId) {
      const source = persons.get(row.inboxFromPersonId)
      if (!source) {
        errors.push({ row: rowNo, error: `inboxFromPersonId ${row.inboxFromPersonId} has no PROFILE` })
        return
      }
      inbox = source.primaryEmail.trim().toLowerCase()
    }
    if (inbox && isTestAccountEmail(inbox)) {
      errors.push({ row: rowNo, error: `office inbox for ${row.ecclesiaId}/${officeId} is a test account` })
      return
    }

    if (officeId === OFFICE_ROLES.RECORDING_BROTHER) assignedRb.add(row.ecclesiaId)
    const office = ensure(row.ecclesiaId, officeId, 'assignment')
    const phone = row.phone === undefined ? undefined : row.phone ? row.phone.trim() : null
    const emailChanged = inbox !== undefined && (inbox || undefined) !== office.email
    const phoneChanged = phone !== undefined && (phone || undefined) !== office.phone
    if (emailChanged || phoneChanged) {
      actions.push({
        op: 'setChannels',
        ecclesiaId: row.ecclesiaId,
        officeId,
        ...(emailChanged ? { email: inbox } : {}),
        ...(phoneChanged ? { phone } : {}),
      })
      if (emailChanged) office.email = inbox || undefined
      if (phoneChanged) office.phone = phone || undefined
    }
    if (row.holderPersonId !== undefined) {
      const personId = row.holderPersonId || null
      if ((office.holderPersonId || null) !== personId) {
        actions.push({ op: 'assignHolder', ecclesiaId: row.ecclesiaId, officeId, personId })
        office.holderPersonId = personId || undefined
      }
    }
  })

  // Every ecclesia has a Recording Brother office, vacant if nobody was assigned.
  for (const ecclesiaId of [...ecclesiaIds].sort()) ensure(ecclesiaId, OFFICE_ROLES.RECORDING_BROTHER, 'rb-missing')

  return { actions, errors, skippedUnconfirmed, offices: [...offices.values()] }
}

/** The inter-ecclesia contacts the planned offices would yield. */
export function predictInterEcclesiaContacts(plan: OfficePlan, persons: Map<string, PersonSnapshot>): InterEcclesiaContact[] {
  const cards = new Map<string, Pick<OfficeHolder, 'personId' | 'primaryEmail'>>(
    [...persons.values()].map((p) => [p.personId, { personId: p.personId, primaryEmail: p.primaryEmail }])
  )
  return resolveInterEcclesiaContacts(plan.offices, cards)
}

/**
 * Today's path: every PROFILE with `isInterEcclesiaRep`, by primary address
 * (what `cron/sync-ses-contacts` opts into the interEcclesia topic). Test
 * accounts are excluded.
 */
export function legacyInterEcclesiaRecipients(
  profiles: Array<{ personId: string; primaryEmail?: string; isInterEcclesiaRep?: boolean }>
): Map<string, string[]> {
  const byAddress = new Map<string, string[]>()
  for (const p of profiles) {
    if (!p.isInterEcclesiaRep || !p.primaryEmail) continue
    const email = p.primaryEmail.trim().toLowerCase()
    if (isTestAccountEmail(email)) continue
    byAddress.set(email, [...(byAddress.get(email) || []), p.personId])
  }
  return byAddress
}

// ---------------------------------------------------------------------------
// Proposal: a first assignments file drafted from today's data (R3)
// ---------------------------------------------------------------------------

const lower = (e?: string) => (e || '').trim().toLowerCase()

/** What the proposal needs about a person (ids and flags; the address only to match an RB email on file). */
export interface ProposalPerson {
  personId: string
  ecclesia?: string
  named: boolean
  primaryEmail: string
  isInterEcclesiaRep?: boolean
  isRecordingBrother?: boolean
  /** role 'rep' (an older way of marking a Rep). */
  isRepRole?: boolean
  /** role 'recorder' (an older way of marking the Recording Brother). */
  isRecorderRole?: boolean
  /** Opted in to the inter-ecclesia list today (receives inter-ecclesia mail). */
  receivesInterEcclesia?: boolean
  /** Opted OUT of the inter-ecclesia list: never given a Rep office. */
  optedOutInterEcclesia?: boolean
}

export interface ProposalEcclesia {
  ecclesiaId: string
  name: string
  /** The legacy RB email copied onto the ecclesia item, if any. */
  recordingBrotherEmail?: string
  /** The legacy RB person id copied onto the ecclesia item, if any. */
  recordingBrotherPersonId?: string
}

export interface OfficeProposal {
  file: OfficeAssignmentFile
  /** Nameless person records whose address now sits on an office: retire them in R8. */
  namelessToRetire: string[]
  /** Contacts / inter-ecclesia recipients whose ecclesia matches no ecclesia record: fix their ecclesia, re-run. */
  unmatchedContacts: string[]
  /** Ecclesias whose RB office already has a holder: left as the owner set them. */
  keptRbHolders: number
  /**
   * Ecclesias with addresses on file that the proposal did not put on the RB
   * office: choose on the Recording Brothers page whether one is the
   * ecclesia's shared address (moves with the role). Until then they
   * receive no inter-ecclesia mail.
   */
  toChoose: string[]
}

/**
 * The named person the data records as this ecclesia's Recording Brother, in
 * order: the person flag, the 'recorder' role, the RB person id copied onto
 * the ecclesia, then the RB email copied onto the ecclesia when it is a named
 * person's own primary. Older records set only some of these (one ecclesia
 * names its Recording Brother and his role is 'recorder', but the flag was
 * never set). Null when none of them names a person at this ecclesia.
 */
function recordedRecordingBrother(e: ProposalEcclesia, at: ProposalPerson[]): string | null {
  const named = at.filter((p) => p.named)
  const legacyEmail = lower(e.recordingBrotherEmail)
  return (
    named.find((p) => p.isRecordingBrother) ||
    named.find((p) => p.isRecorderRole) ||
    named.find((p) => !!e.recordingBrotherPersonId && p.personId === e.recordingBrotherPersonId) ||
    named.find((p) => !!legacyEmail && lower(p.primaryEmail) === legacyEmail)
  )?.personId || null
}

/**
 * Draft the office assignments from today's data, for the owner to review and
 * then apply with `backfill-office-assignments.ts`. Never decides a person
 * from an address alone:
 *
 *  - Inter-ecclesia mail goes to the Recording Brother office only: its own
 *    address, else its holder's primary email. Reps hold offices (they help
 *    the RB run the ecclesia) but don't receive it.
 *  - A NAMELESS record (no first or last name) is an ADDRESS, not a person
 *    (most came from a 2024 mailing list; many are ecclesia mailboxes). It
 *    can only be the RB office's own address. The record itself is left
 *    alone and is reported to retire in R8.
 *  - A NAMED record flagged as the ecclesia's Recording Brother holds its RB
 *    office. Other named people marked as contacts (the contact flag, role
 *    'rep', or an opt-in on the inter-ecclesia list) hold Rep offices.
 *  - A shared ecclesia address is the ecclesia's CHOICE, made on the
 *    Recording Brothers page: some ecclesias keep an address that moves with
 *    the role (Toronto West's mailbox), others use the RB's own email and
 *    change it when the RB changes. The proposal can't tell which an address
 *    is, so it never puts one on a named RB's office: his mail goes to his
 *    own email. Ecclesias with other addresses are listed in `toChoose`.
 *  - With no named RB there is nobody for mail to follow, so the ecclesia's
 *    single address (a nameless "RB", the copied RB email, or its one
 *    nameless contact) is the RB office's address. Several: none is chosen.
 *  - A nameless record whose address is a named person's own primary is a
 *    leftover duplicate of that person, not an ecclesia address.
 *  - An RB office already set (Recording Brothers page or nomination) is
 *    kept exactly as set: its holder and its address, or no address when
 *    the ecclesia chose the RB's own email.
 */
export function proposeOfficeAssignments(input: {
  ecclesias: ProposalEcclesia[]
  persons: ProposalPerson[]
  existingOffices: Array<Pick<OfficeRecord, 'ecclesiaId' | 'kind' | 'role' | 'email' | 'holderPersonId'>>
}): OfficeProposal {
  const byName = new Map(input.ecclesias.map((e) => [e.name, e]))
  const namedPrimaries = new Set(input.persons.filter((p) => p.named).map((p) => lower(p.primaryEmail)).filter(Boolean))
  const rows: OfficeAssignmentInput[] = []
  const retire = new Set<string>()
  const unmatched: string[] = []
  const toChoose: string[] = []
  let keptRbHolders = 0

  const people = [...input.persons]
    .filter((p) => !isTestAccountEmail(p.primaryEmail))
    .sort((a, b) => a.personId.localeCompare(b.personId))
  const receives = (p: ProposalPerson) =>
    !!(p.isInterEcclesiaRep || p.isRecordingBrother || p.isRecorderRole || p.isRepRole || p.receivesInterEcclesia)
  for (const p of people) {
    if (receives(p) && (!p.ecclesia || !byName.has(p.ecclesia))) unmatched.push(p.personId)
  }

  for (const e of [...input.ecclesias].sort((a, b) => a.ecclesiaId.localeCompare(b.ecclesiaId))) {
    const at = people.filter((p) => p.ecclesia === e.name)
    const rbOffice = input.existingOffices.find(
      (o) => o.ecclesiaId === e.ecclesiaId && o.kind === OFFICE_ROLES.RECORDING_BROTHER
    )
    const existingReps = input.existingOffices.filter((o) => o.ecclesiaId === e.ecclesiaId && o.kind === OFFICE_ROLES.REP)

    // Recording Brother holder: kept if the office has one, else the named flagged RB.
    let rbHolder: string | null = rbOffice?.holderPersonId || null
    if (rbHolder) keptRbHolders++
    else rbHolder = recordedRecordingBrother(e, at)

    // Addresses that are not people: nameless contacts and a nameless "RB".
    const allNameless = at.filter((p) => !p.named && p.primaryEmail && receives(p))
    for (const p of allNameless) retire.add(p.personId)
    const nameless = allNameless.filter((p) => !namedPrimaries.has(lower(p.primaryEmail)))

    // The RB office's own address: only for a vacant office (see above).
    const legacyRbEmail = lower(e.recordingBrotherEmail)
    const legacyIsAddress = !!legacyRbEmail && !namedPrimaries.has(legacyRbEmail)
    let rbInbox: { inbox?: string; inboxFromPersonId?: string } = {}
    if (!rbOffice && !rbHolder) {
      const namelessRb = nameless.find((p) => p.isRecordingBrother)
      if (namelessRb) rbInbox = { inboxFromPersonId: namelessRb.personId }
      else if (legacyIsAddress) rbInbox = { inbox: legacyRbEmail }
      else if (nameless.length === 1) rbInbox = { inboxFromPersonId: nameless[0].personId }
    }
    const rbAddress =
      lower(rbOffice?.email) ||
      rbInbox.inbox ||
      lower(nameless.find((p) => p.personId === rbInbox.inboxFromPersonId)?.primaryEmail)

    rows.push({
      ecclesiaId: e.ecclesiaId,
      office: OFFICE_ROLES.RECORDING_BROTHER,
      ...(rbOffice?.holderPersonId ? {} : { holderPersonId: rbHolder }),
      ...rbInbox,
      confirmed: true,
    })

    // Addresses not on the RB office: the owner chooses (they get no inter-ecclesia mail).
    const unused = nameless.some((p) => lower(p.primaryEmail) !== rbAddress) || (legacyIsAddress && legacyRbEmail !== rbAddress)
    if (!rbOffice && unused) toChoose.push(e.ecclesiaId)
    // Named contacts other than the RB hold Rep offices (no inter-ecclesia mail).
    for (const p of at) {
      if (!p.named || !receives(p) || p.optedOutInterEcclesia || p.personId === rbHolder) continue
      if (existingReps.some((o) => o.holderPersonId === p.personId)) continue
      rows.push({ ecclesiaId: e.ecclesiaId, office: OFFICE_ROLES.REP, holderPersonId: p.personId, confirmed: true })
    }
  }

  return {
    file: { assignments: rows },
    namelessToRetire: [...retire].sort(),
    unmatchedContacts: unmatched,
    keptRbHolders,
    toChoose,
  }
}

/**
 * Today's inter-ecclesia send path (R5): the registry list keyed
 * `interEcclesia` (defaultOptIn off), so its recipients are its `opt_in`
 * subscription rows, by address. Test accounts are excluded. `optedOut` is
 * every person with an `opt_out` row on it.
 */
export function registryListRecipients(
  items: Array<Record<string, any>>,
  listKey: string
): { listId: string | null; byAddress: Map<string, string[]>; optedOut: Set<string> } {
  const list = items.find((i) => String(i.pkey).startsWith('LIST#') && i.skey === 'DETAILS' && i.key === listKey)
  const byAddress = new Map<string, string[]>()
  const optedOut = new Set<string>()
  if (!list) return { listId: null, byAddress, optedOut }
  const prefix = `SUB#${list.listId}#`
  for (const row of items) {
    if (!String(row.pkey).startsWith('PERSON#') || !String(row.skey).startsWith(prefix)) continue
    const personId = String(row.pkey).slice('PERSON#'.length)
    if (row.status === 'opt_out') optedOut.add(personId)
    if (row.status !== 'opt_in') continue
    const email = lower(row.email)
    if (!email || isTestAccountEmail(email)) continue
    byAddress.set(email, [...(byAddress.get(email) || []), personId])
  }
  return { listId: list.listId as string, byAddress, optedOut }
}
