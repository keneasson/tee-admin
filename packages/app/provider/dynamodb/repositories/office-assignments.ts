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
