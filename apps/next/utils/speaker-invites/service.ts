import { randomUUID } from 'node:crypto'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { serviceOverrideRepository } from '@my/app/provider/dynamodb/repositories/service-override-repository'
import {
  SpeakerInviteRepository,
  SpeakerWriteConflict,
  speakerInviteRepository,
  type BookingExpectation,
  type SpeakerWriteOp,
} from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import {
  speakerInviteKeys,
  type CounterpartRole,
  type InviteFollowUp,
  type InviteHistoryAction,
  type InviteHistoryEntry,
  type InviteProgramId,
  type InviteTrust,
  type OfferedDate,
  type ShortNotice,
  type SpeakerBookingRecord,
  type SpeakerInviteRecord,
  type SpeakerInviteStatus,
  type SpeakerSwapRecord,
  type SwapSide,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import {
  builtInProgram,
  inviteSlot,
  inviteWording,
  isEligibleFor,
  snapshotOf,
  type InviteProgram,
  type InviteWho,
  type ProgramSlot,
} from '@my/app/provider/dynamodb/invite-program-types'
import { createVisitorPerson } from '@my/app/provider/dynamodb/repositories/visitor-person'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import {
  sendCancellationEmail,
  sendConfirmationEmail,
  sendInvitationEmail,
  sendInviterNotice,
  sendSwapOutcomeEmail,
  sendSwapRequestEmail,
  type InviterNoticeOptions,
  type SpeakerBookingDetails,
} from '../email/speaker-invite-emails'
import { loadSlotDetails, toPublicSlot, type Slot, type SlotDetail } from './slots'
import { isHHmm, isISODate, isValidTimeZone, localISODate, zonedStart } from './time'
import { speakerEmailFor } from './contact'

/**
 * Speaker invitations service (docs/SPEAKER_INVITATIONS.md §2–§7).
 *
 * ATOMICITY. A booking item (`SPEAKER_BOOKING#{ecclesia}#{type}` / `{date}`) is
 * the lock on a slot. Every action that takes, moves, swaps or releases a
 * booking writes the roster overlay (the service override's `roleFields` /
 * `roleFieldRefs`) in the SAME DynamoDB TransactWrite, using
 * `serviceOverrideRepository.buildRoleFieldPut` — the record `upsert()` would
 * write, conditioned on the override version that was read. So the booking and
 * the public schedule can never disagree, and a concurrent overlay edit makes
 * the transaction fail instead of being overwritten. No compensation needed.
 *
 * Emails are sent AFTER the transaction commits. An email failure never undoes
 * a booking: it is logged and recorded as `email_failed` in the history.
 *
 * Permission to create/cancel as an inviter is checked by the route
 * (`canSendSpeakerInvite`); invitee identity by `resolveInviteActor`.
 */

export interface Actor {
  personId: string
  trust: InviteTrust
}

export type ServiceErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'DATES_NOT_OPEN'
  | 'INVITEE_NOT_FOUND'
  | 'INVITEE_NO_EMAIL'
  | 'NOT_INVITABLE'
  | 'INVITE_CANCELLED'
  | 'INVITE_EXPIRED'
  | 'ALREADY_ACCEPTED'
  | 'NOT_ACCEPTED'
  | 'DATE_NOT_OFFERED'
  | 'DATE_IN_PAST'
  | 'SLOT_TAKEN'
  | 'SWAP_NOT_AVAILABLE'
  | 'SWAP_PENDING'
  | 'TARGET_UNREACHABLE'
  | 'SWAP_CLOSED'
  | 'SWAP_EXPIRED'
  | 'SWAP_STALE'
  | 'CONFLICT'
  | 'SEND_FAILED'

export interface ServiceError {
  ok: false
  code: ServiceErrorCode
  message: string
  /** SLOT_TAKEN: the dates still open to this invite. */
  openDates?: Slot[]
  /** DATES_NOT_OPEN: the state of each offending date. */
  dates?: Array<{ date: string; state: string }>
  /** SWAP_CLOSED: the swap's status. */
  status?: string
}

const fail = (code: ServiceErrorCode, message: string, extra: Partial<ServiceError> = {}): ServiceError => ({
  ok: false,
  code,
  message,
  ...extra,
})

const SWAP_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SHORT_NOTICE_MS = 24 * 60 * 60 * 1000

/** Injectable clock (tests). */
let nowFn = () => new Date()
export function __setClock(fn: (() => Date) | null) {
  nowFn = fn ?? (() => new Date())
}

function todayISO(): string {
  return localISODate(nowFn(), DEFAULT_TIMEZONE)
}

function personName(p: Pick<PersonRecord, 'firstName' | 'lastName' | 'displayName'> | null | undefined): string {
  if (!p) return ''
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.displayName || ''
}

function historyEntry(
  action: InviteHistoryAction,
  actor: Actor,
  extra: Partial<Omit<InviteHistoryEntry, 'at' | 'action' | 'byPersonId' | 'trust'>> = {}
): InviteHistoryEntry {
  return { at: nowFn().toISOString(), action, byPersonId: actor.personId, trust: actor.trust, ...extra }
}

/** The next version of an invite, with history appended. */
function nextInvite(
  invite: SpeakerInviteRecord,
  changes: Partial<SpeakerInviteRecord>,
  entries: InviteHistoryEntry[]
): SpeakerInviteRecord {
  return {
    ...invite,
    ...changes,
    history: [...(invite.history ?? []), ...entries],
    updatedAt: nowFn().toISOString(),
    version: (invite.version ?? 0) + 1,
  }
}

function bookingRecord(
  ecclesia: string,
  type: InviteProgramId,
  date: string,
  personId: string,
  inviteId: string | undefined,
  existing?: SpeakerBookingRecord | null
): SpeakerBookingRecord {
  const now = nowFn().toISOString()
  return {
    pkey: speakerInviteKeys.bookingPk(ecclesia, type),
    skey: date,
    ecclesia,
    type,
    date,
    personId,
    ...(inviteId ? { inviteId } : {}),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
}

function bookingDetails(
  ecclesia: string,
  type: InviteProgramId,
  date: string,
  time: string,
  tz: string,
  personId: string,
  inviteId?: string,
  slot?: ProgramSlot | null
): SpeakerBookingDetails {
  return { ecclesia, type, date, time, tz, personId, ...(inviteId ? { inviteId } : {}), ...(slot !== undefined ? { slot } : {}) }
}

function acceptedDetails(invite: SpeakerInviteRecord): SpeakerBookingDetails | null {
  if (!invite.acceptedDate) return null
  return bookingDetails(
    invite.ecclesia,
    invite.type,
    invite.acceptedDate,
    invite.acceptedTime ?? '',
    invite.acceptedTz ?? DEFAULT_TIMEZONE,
    invite.inviteePersonId,
    invite.inviteId,
    inviteSlot(invite)
  )
}

/**
 * Where a program books, as the write helpers need it: the program id (keys
 * the bookings) and the slot (kind + roster field) from the invite's snapshot,
 * or the core type's fixed slot for invites sent before programs.
 */
interface SlotRef {
  ecclesia: string
  type: InviteProgramId
  slot: ProgramSlot
}

function slotRefOf(invite: Pick<SpeakerInviteRecord, 'ecclesia' | 'type' | 'programSnapshot'>): SlotRef | null {
  const slot = inviteSlot(invite)
  return slot ? { ecclesia: invite.ecclesia, type: invite.type, slot } : null
}

/** A swap books where its invite did: the stored kind + field, else the core type's fixed slot. */
function swapRefOf(swap: SpeakerSwapRecord): SlotRef {
  const fixed = inviteSlot({ type: swap.type })
  const scheduleType = swap.scheduleType ?? fixed?.scheduleType ?? 'memorial'
  return { ecclesia: swap.ecclesia, type: swap.type, slot: { scheduleType, field: swap.field } }
}

/** Run an email after the write committed; on failure, log + record it. */
async function afterCommitEmail(
  label: string,
  inviteId: string | null,
  actor: Actor,
  send: () => Promise<void>
): Promise<void> {
  try {
    await send()
  } catch (err: any) {
    console.error(`[speaker-invites] ${label} email failed:`, err)
    if (!inviteId) return
    await speakerInviteRepository
      .appendHistory(inviteId, [historyEntry('email_failed', actor, { note: `${label}: ${err?.message ?? String(err)}` })])
      .catch((e) => console.error('[speaker-invites] could not record email failure:', e))
  }
}

// ---------------------------------------------------------------------------
// Invite status + which dates an invite may take
// ---------------------------------------------------------------------------

/** Status as the reader should see it. GET never writes, so `expired` is derived. */
export function effectiveStatus(invite: SpeakerInviteRecord): SpeakerInviteStatus {
  if (invite.status !== 'sent') return invite.status
  const today = todayISO()
  const anyOffered = invite.offeredDates.some((d) => d.date >= today)
  const windowOpen = !!invite.otherDatesWindow && invite.otherDatesWindow.to >= today
  return anyOffered || windowOpen ? 'sent' : 'expired'
}

function isDateAllowed(invite: SpeakerInviteRecord, date: string): boolean {
  if (invite.offeredDates.some((d) => d.date === date)) return true
  const w = invite.otherDatesWindow
  return !!w && date >= w.from && date <= w.to
}

/** The invite's candidate range (offered dates ∪ window), from today. */
function inviteRange(invite: SpeakerInviteRecord): { from: string; to: string } | null {
  const today = todayISO()
  const dates = invite.offeredDates.map((d) => d.date)
  if (invite.otherDatesWindow) dates.push(invite.otherDatesWindow.from, invite.otherDatesWindow.to)
  const sorted = [...dates].sort()
  const to = sorted[sorted.length - 1]
  if (!to || to < today) return null
  return { from: sorted[0] < today ? today : sorted[0], to }
}

/**
 * Every date this invite could take, with its live state (memorial/bible
 * class). Offered dates first-class; window dates when the inviter enabled them.
 */
export async function inviteSlots(invite: SpeakerInviteRecord): Promise<{ offered: Slot[]; other: Slot[] }> {
  const slot = inviteSlot(invite)
  if (!slot) {
    return {
      offered: invite.offeredDates.map((d) => ({ date: d.date, time: d.time, tz: d.tz, state: 'OPEN' as const })),
      other: [],
    }
  }
  const range = inviteRange(invite)
  if (!range) return { offered: [], other: [] }
  const { slots } = await loadSlotDetails(invite.ecclesia, invite.type, range.from, range.to, slot)
  const offeredSet = new Set(invite.offeredDates.map((d) => d.date))
  const offered = slots.filter((s) => offeredSet.has(s.date)).map(toPublicSlot)
  const w = invite.otherDatesWindow
  const other = w
    ? slots.filter((s) => !offeredSet.has(s.date) && s.date >= w.from && s.date <= w.to).map(toPublicSlot)
    : []
  return { offered, other }
}

async function remainingOpenDates(invite: SpeakerInviteRecord): Promise<Slot[]> {
  const { offered, other } = await inviteSlots(invite)
  return [...offered, ...other].filter((s) => s.state === 'OPEN')
}

async function slotOn(ref: SlotRef, date: string): Promise<SlotDetail | undefined> {
  const { slots } = await loadSlotDetails(ref.ecclesia, ref.type, date, date, ref.slot)
  return slots.find((s) => s.date === date)
}

/** Overlay write that names `person` on `date`, in the program's linked field. */
function overlaySet(invite: SlotRef, slot: SlotDetail, name: string, personId: string, by: string): SpeakerWriteOp {
  const mapping = invite.slot
  return {
    kind: 'override',
    put: serviceOverrideRepository.buildRoleFieldPut(slot.override ?? null, {
      ecclesia: invite.ecclesia, // the INVITE's ecclesia, never HOME_ECCLESIA
      serviceType: mapping.scheduleType,
      date: slot.date,
      field: mapping.field,
      value: name,
      personId,
      by,
    }),
  }
}

/**
 * Release a departing speaker's slot on the roster overlay.
 *
 *  - Overlay names someone else → leave it alone (null op).
 *  - Overlay names this person and the synced Sheet does NOT → remove the key,
 *    so the Sheet's own value (blank / someone else) shows again.
 *  - The Sheet itself names this person (the RB typed them in after the
 *    accept) → write an explicit '' so the merged slot reads OPEN. Removing the
 *    key would put a speaker who cancelled back on the schedule.
 *
 * `sheetNamed` tells the caller to remind the inviter to clear the Sheet.
 */
function overlayClear(
  invite: SlotRef | null,
  slot: SlotDetail | undefined,
  personId: string,
  by: string
): { op: SpeakerWriteOp | null; sheetNamed: boolean } {
  const mapping = invite?.slot
  if (!invite || !mapping || !slot) return { op: null, sheetNamed: false }
  const overlayHasField = slot.override?.roleFields?.[mapping.field] !== undefined
  const ref = slot.override?.roleFieldRefs?.[mapping.field]
  // Without an overlay entry, the merged speaker IS the Sheet's value.
  const sheetNamed = overlayHasField ? slot.basePersonId === personId : slot.speakerPersonId === personId
  if (overlayHasField && ref !== personId) return { op: null, sheetNamed: false }
  if (!overlayHasField && !sheetNamed) return { op: null, sheetNamed: false }
  return {
    op: {
      kind: 'override',
      put: serviceOverrideRepository.buildRoleFieldPut(slot.override ?? null, {
        ecclesia: invite.ecclesia,
        serviceType: mapping.scheduleType,
        date: slot.date,
        field: mapping.field,
        value: sheetNamed ? '' : null,
        // The Sheet value the blank hides: once the RB types someone else, that shows.
        ...(sheetNamed ? { suppress: (overlayHasField ? slot.baseName : slot.speakerName) ?? '' } : {}),
        by,
      }),
    },
    sheetNamed,
  }
}

/** Reminder for the inviter's notice when the Sheet still names the speaker. */
function sheetReminder(sheetNamed: boolean, name: string, date: string): InviterNoticeOptions['sheetReminder'] {
  return sheetNamed ? { name, date } : undefined
}

/** Is a booking's swap lock free? A lock on a closed or expired swap is stale. */
async function swapLock(booking: SpeakerBookingRecord | null): Promise<{ free: boolean; current: string | null }> {
  if (!booking?.openSwapId) return { free: true, current: null }
  const swap = await speakerInviteRepository.getSwap(booking.openSwapId)
  const open = !!swap && swap.status === 'open' && nowFn().getTime() < Date.parse(swap.expiresAt)
  return { free: !open, current: booking.openSwapId }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface NewInviteeInput {
  firstName: string
  lastName: string
  email: string
  ecclesia?: string
  /**
   * §9a: the inviter confirmed this address belongs to SOMEONE ELSE in the
   * directory (a household inbox). The new visitor joins that address as a
   * shared one (#267) instead of being taken for its existing holder.
   */
  sharedEmailConfirmedNotSamePerson?: boolean
  /** §9b: required. Brethren programs need 'male'; sisters programs 'female' (§3a "who"). */
  gender?: 'male' | 'female'
  /** §9b: true = Yes, false = No (refused), absent/null = not answered (left unset). */
  baptized?: boolean | null
  /** YYYY-MM-DD, optional. */
  baptismDate?: string
}

export interface CreateInviteInput {
  ecclesia: string
  /** The program id (§3a). */
  type: InviteProgramId
  /**
   * The ecclesia's program for `type`, resolved by the route
   * (`resolveProgram`). Omitted = the built-in core program of that id.
   */
  program?: InviteProgram
  /** Where the program books (its resolved link). Omitted = the program's built-in link. */
  slot?: ProgramSlot | null
  inviter: Actor
  invitee: { personId: string } | NewInviteeInput
  /** 1–3. memorial/bible_class: date only (time comes from the schedule). lecture: date + time (+ tz). */
  dates: Array<{ date: string; time?: string; tz?: string }>
  otherDatesWindow?: { from: string; to: string }
  note?: string
  /** Send the invitation email after creating (default true). */
  send?: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value.trim())
}

const sameName = (p: Pick<PersonRecord, 'firstName' | 'lastName'>, first: string, last: string) =>
  (p.firstName ?? '').trim().toLowerCase() === first.toLowerCase() &&
  (p.lastName ?? '').trim().toLowerCase() === last.toLowerCase()

const NOT_INVITABLE_MESSAGE: Record<InviteWho, string> = {
  brethren: 'Only brethren can be invited to speak, and this person isn’t recorded as one.',
  sisters: 'This program invites sisters, and this person isn’t recorded as one.',
  anyone: 'This person can’t be invited.',
}

const notInvitable = (who: InviteWho = 'brethren') => fail('NOT_INVITABLE', NOT_INVITABLE_MESSAGE[who])

type ResolvedInvitee =
  | { ok: true; person: PersonRecord | null; name: string; email: string; followUp?: InviteFollowUp }
  | ServiceError

async function resolveInvitee(
  invitee: CreateInviteInput['invitee'],
  create: boolean,
  ctx: { inviteId: string; inviter: Actor; who: InviteWho }
): Promise<ResolvedInvitee> {
  const who = ctx.who
  if ('personId' in invitee) {
    const person = await personRepository.getById(invitee.personId)
    if (!person) return fail('INVITEE_NOT_FOUND', 'That person is not in the directory.')
    if (!isEligibleFor(who, person)) return notInvitable(who)
    if (!person.primaryEmail) return fail('INVITEE_NO_EMAIL', 'That person has no email address on file.')
    return { ok: true, person, name: personName(person), email: person.primaryEmail }
  }
  const email = invitee.email?.trim().toLowerCase()
  const firstName = invitee.firstName?.trim()
  const lastName = invitee.lastName?.trim()
  if (!email || !isEmailAddress(email)) return fail('INVALID_INPUT', 'A valid email is required.')
  if (!firstName || !lastName) return fail('INVALID_INPUT', 'First and last name are required.')
  // Look the address up first (GSI1) — never take an address from its holder.
  const existing = await personRepository.getByEmail(email)
  const shared = !!existing && invitee.sharedEmailConfirmedNotSamePerson === true
  if (existing && !shared) {
    if (!isEligibleFor(who, existing)) return notInvitable(who)
    return { ok: true, person: existing, name: personName(existing), email }
  }
  // §9b: a person added for a brethren program is added as a Brother, and not
  // one recorded as unbaptized; for a sisters program, as a Sister (§3a "who").
  if (who === 'brethren') {
    if (invitee.gender !== 'male') return fail('NOT_INVITABLE', 'Invitations to speak are for brethren. Choose Brother to continue.')
    if (invitee.baptized === false) return notInvitable()
  } else if (who === 'sisters') {
    if (invitee.gender !== 'female') return fail('NOT_INVITABLE', 'This program invites sisters. Choose Sister to continue.')
    if (invitee.baptized === false) return notInvitable(who)
  } else if (invitee.gender !== 'male' && invitee.gender !== 'female') {
    return fail('INVALID_INPUT', 'Choose Brother or Sister.')
  }
  const gender: 'male' | 'female' = invitee.gender
  const baptismDate = invitee.baptismDate?.trim() || undefined
  if (baptismDate && !isISODate(baptismDate)) return fail('INVALID_INPUT', 'The baptism date must be YYYY-MM-DD.')
  if (existing && shared) {
    // Already added on this address before (a second invite)? Use them.
    const holders = await personRepository.getAllPersonsByEmail(email)
    const again = holders.find((p) => p.personId !== existing.personId && sameName(p, firstName, lastName))
    if (again) return { ok: true, person: again, name: personName(again), email }
  }
  // A test send names the invitee in the preview but creates no one.
  if (!create) return { ok: true, person: null, name: `${firstName} ${lastName}`, email }

  const now = nowFn().toISOString()
  const person = await createVisitorPerson({
    firstName,
    lastName,
    ecclesia: invitee.ecclesia?.trim() || 'Unknown',
    ...(shared
      ? { sharedEmail: { address: email, asPrimary: existing!.primaryEmail?.toLowerCase() === email } }
      : { email }),
    source: 'speaker-invitation',
    sourceRef: `speaker-invite:${ctx.inviteId}`,
    createdByPersonId: ctx.inviter.personId,
    // §9b: the inviting RB/Rep vouches they are aligned with an ecclesia, so
    // 'member' whatever the baptism answer (role and baptism are independent).
    role: 'member',
    gender,
    ...(invitee.baptized === true ? { baptized: true, ...(baptismDate ? { baptismDate } : {}) } : {}),
  })
  return {
    ok: true,
    person,
    name: personName(person),
    email,
    ...(shared ? { followUp: { kind: 'shared-email' as const, withPersonId: existing!.personId, createdAt: now } } : {}),
  }
}

/**
 * Validate the input and build the invite record — no writes, except that a
 * real create (`create: true`) makes a visitor PersonRecord for an unknown
 * name + email.
 */
async function prepareInvite(
  input: CreateInviteInput,
  create: boolean
): Promise<{ ok: true; invite: SpeakerInviteRecord; inviteeName: string } | ServiceError> {
  const program = input.program ?? builtInProgram(input.type)
  if (!program || program.programId !== input.type) return fail('INVALID_INPUT', 'Unknown invitation type.')
  if (!program.active) return fail('INVALID_INPUT', 'That invitation program is switched off.')
  if (!input.ecclesia) return fail('INVALID_INPUT', 'An ecclesia is required.')
  const dates = input.dates ?? []
  if (dates.length < 1 || dates.length > 3) return fail('INVALID_INPUT', 'Offer between one and three dates.')
  const seen = new Set<string>()
  const today = todayISO()
  for (const d of dates) {
    if (!isISODate(d?.date)) return fail('INVALID_INPUT', `Invalid date: ${d?.date}`)
    if (seen.has(d.date)) return fail('INVALID_INPUT', `Duplicate date: ${d.date}`)
    if (d.date < today) return fail('DATE_IN_PAST', `${d.date} is in the past.`)
    seen.add(d.date)
  }

  const snapshot = snapshotOf(program)
  if (input.slot !== undefined) {
    if (input.slot) snapshot.slot = input.slot
    else delete snapshot.slot
  }
  const mapping = snapshot.slot ?? null
  let offeredDates: OfferedDate[]
  let otherDatesWindow: { from: string; to: string } | undefined

  if (!mapping) {
    // Lecture: the inviter types each date + time. No scanning, no booking item.
    offeredDates = []
    for (const d of dates) {
      if (!isHHmm(d.time)) return fail('INVALID_INPUT', `A time (HH:mm) is required for ${d.date}.`)
      const tz = d.tz || DEFAULT_TIMEZONE
      if (!isValidTimeZone(tz)) return fail('INVALID_INPUT', `Unknown timezone: ${tz}`)
      offeredDates.push({ date: d.date, time: d.time, tz })
    }
    if (input.otherDatesWindow) {
      return fail(
        'INVALID_INPUT',
        input.type === 'lecture'
          ? 'Lectures have no other open dates to offer.'
          : 'This invitation has no schedule, so there are no other open dates to offer.'
      )
    }
  } else {
    const sorted = [...seen].sort()
    const { slots } = await loadSlotDetails(input.ecclesia, input.type, sorted[0], sorted[sorted.length - 1], mapping)
    const byDate = new Map(slots.map((s) => [s.date, s]))
    const notOpen = sorted
      .map((date) => ({ date, state: byDate.get(date)?.state ?? 'NO_MEETING' }))
      .filter((d) => d.state !== 'OPEN')
    if (notOpen.length > 0) {
      return fail('DATES_NOT_OPEN', 'Only open dates can be offered.', { dates: notOpen })
    }
    offeredDates = dates.map((d) => {
      const s = byDate.get(d.date)!
      return { date: d.date, time: s.time, tz: s.tz }
    })
    if (input.otherDatesWindow) {
      const w = input.otherDatesWindow
      if (!isISODate(w.from) || !isISODate(w.to) || w.from > w.to) {
        return fail('INVALID_INPUT', 'The other-dates window is invalid.')
      }
      otherDatesWindow = { from: w.from, to: w.to }
    }
  }

  // The id comes first: a person created for this invite records it (sourceRef).
  const inviteId = randomUUID()
  const invitee = await resolveInvitee(input.invitee, create, { inviteId, inviter: input.inviter, who: program.who })
  if (!invitee.ok) return invitee

  const now = nowFn().toISOString()
  const note = input.note?.trim() || undefined
  const invite: SpeakerInviteRecord = {
    pkey: speakerInviteKeys.invitePk(inviteId),
    skey: 'META',
    ...SpeakerInviteRepository.listingEntry({ ecclesia: input.ecclesia, createdAt: now, inviteId }),
    inviteId,
    ecclesia: input.ecclesia,
    type: input.type,
    programSnapshot: snapshot,
    status: 'sent',
    inviterPersonId: input.inviter.personId,
    inviteePersonId: invitee.person?.personId ?? '',
    inviteeEmail: invitee.email,
    offeredDates,
    ...(otherDatesWindow ? { otherDatesWindow } : {}),
    ...(note ? { note } : {}),
    ...(invitee.followUp ? { followUp: invitee.followUp } : {}),
    history: [historyEntry('created', input.inviter, { to: offeredDates.map((d) => d.date).join(',') })],
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
  return { ok: true, invite, inviteeName: invitee.name }
}

export async function createInvite(
  input: CreateInviteInput
): Promise<{ ok: true; invite: SpeakerInviteRecord } | ServiceError> {
  const prepared = await prepareInvite(input, true)
  if (!prepared.ok) return prepared
  const { invite } = prepared
  const inviteId = invite.inviteId

  await speakerInviteRepository.createInvite(invite)

  if (input.send !== false) {
    await afterCommitEmail('invitation', inviteId, input.inviter, () => sendInvitationEmail(invite))
  }
  return { ok: true, invite }
}

/**
 * TEST send (composer "send a test to me"): validates exactly like
 * createInvite, then renders the invitation and sends it ONLY to `testTo` (the
 * signed-in inviter). No invite, no booking, no person is created, and the
 * invitee is never mailed. Send errors propagate (the inviter is waiting on it).
 */
export async function sendTestInvitation(
  input: CreateInviteInput,
  testTo: string
): Promise<{ ok: true; sentTo: string } | ServiceError> {
  if (!testTo) return fail('INVALID_INPUT', 'Your account has no email address to send a test to.')
  const prepared = await prepareInvite(input, false)
  if (!prepared.ok) return prepared
  await sendInvitationEmail(prepared.invite, { testTo, inviteeName: prepared.inviteeName })
  return { ok: true, sentTo: testTo }
}

// ---------------------------------------------------------------------------
// Accept
// ---------------------------------------------------------------------------

/**
 * `shortNotice`: accepted or moved within 24h of the appointment (or, for a
 * change, of either date) — the same rule and shape as respondSwap.
 */
export type AcceptResult = { ok: true; invite: SpeakerInviteRecord; shortNotice?: ShortNotice[] } | ServiceError

/** The §7.6 note for dates whose speaker just changed, if any is within 24h. */
function shortNoticeIfDue(
  mapping: ProgramSlot | null,
  slots: Array<{ date: string; time: string; tz: string; row?: Record<string, any> }>
): ShortNotice[] | undefined {
  if (!mapping || !isShortNotice(nowFn(), slots)) return undefined
  const notes = shortNoticesFor(mapping.field, slots)
  return notes.length > 0 ? notes : undefined
}

function statusGuard(invite: SpeakerInviteRecord, wanted: 'sent' | 'accepted'): ServiceError | null {
  const status = effectiveStatus(invite)
  if (status === 'cancelled') return fail('INVITE_CANCELLED', 'This invitation was cancelled.')
  if (status === 'expired') return fail('INVITE_EXPIRED', 'This invitation has expired.')
  if (wanted === 'sent' && status === 'accepted') return fail('ALREADY_ACCEPTED', 'You have already accepted this invitation.')
  if (wanted === 'accepted' && status !== 'accepted') return fail('NOT_ACCEPTED', 'This invitation has not been accepted yet.')
  return null
}

async function slotTaken(invite: SpeakerInviteRecord): Promise<ServiceError> {
  return fail('SLOT_TAKEN', 'That date was just taken.', { openDates: await remainingOpenDates(invite) })
}

export async function acceptInvite(inviteId: string, date: string, actor: Actor): Promise<AcceptResult> {
  const invite = await speakerInviteRepository.getInvite(inviteId)
  if (!invite) return fail('NOT_FOUND', 'Invitation not found.')
  const guard = statusGuard(invite, 'sent')
  if (guard) return guard
  if (!isISODate(date)) return fail('INVALID_INPUT', 'Choose a date.')
  if (!isDateAllowed(invite, date)) return fail('DATE_NOT_OFFERED', 'That date is not part of this invitation.')
  if (date < todayISO()) return fail('DATE_IN_PAST', 'That date has passed.')

  const ref = slotRefOf(invite)
  const entry = historyEntry('accepted', actor, { to: date })

  if (!ref) {
    const offered = invite.offeredDates.find((d) => d.date === date)!
    const updated = nextInvite(
      invite,
      { status: 'accepted', acceptedDate: date, acceptedTime: offered.time, acceptedTz: offered.tz },
      [entry]
    )
    try {
      await speakerInviteRepository.commit([{ kind: 'putInvite', invite: updated, expect: { version: invite.version } }])
    } catch (err) {
      if (err instanceof SpeakerWriteConflict) return fail('CONFLICT', 'The invitation changed. Reload and try again.')
      throw err
    }
    await notifyAccepted(updated, actor)
    return { ok: true, invite: updated }
  }

  // Re-check the merged slot is still OPEN, then take the booking (first wins).
  const slot = await slotOn(ref, date)
  if (!slot || slot.state !== 'OPEN') return slotTaken(invite)

  const person = await personRepository.getById(invite.inviteePersonId)
  const name = personName(person) || invite.inviteeEmail
  const updated = nextInvite(
    invite,
    { status: 'accepted', acceptedDate: date, acceptedTime: slot.time, acceptedTz: slot.tz },
    [entry]
  )
  try {
    await speakerInviteRepository.commit([
      { kind: 'putBooking', booking: bookingRecord(invite.ecclesia, invite.type, date, invite.inviteePersonId, inviteId), expect: 'absent' },
      overlaySet(ref, slot, name, invite.inviteePersonId, actor.personId),
      { kind: 'putInvite', invite: updated, expect: { version: invite.version } },
    ])
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return slotTaken(invite)
    throw err
  }

  const shortNotice = shortNoticeIfDue(ref.slot, [slot])
  await notifyAccepted(updated, actor, shortNotice)
  return { ok: true, invite: updated, ...(shortNotice ? { shortNotice } : {}) }
}

async function notifyAccepted(invite: SpeakerInviteRecord, actor: Actor, shortNotice?: ShortNotice[]) {
  const details = acceptedDetails(invite)!
  const mine = shortNotice?.find((n) => n.date === details.date)
  await afterCommitEmail('confirmation', invite.inviteId, actor, () =>
    sendConfirmationEmail(invite, details, { reason: 'accepted', ...(mine ? { shortNotice: mine } : {}) })
  )
  await afterCommitEmail('inviter notice', invite.inviteId, actor, () => sendInviterNotice(invite, 'accepted'))
}

// ---------------------------------------------------------------------------
// Change date
// ---------------------------------------------------------------------------

function heldBookingExpect(invite: SpeakerInviteRecord, lock: { current: string | null }): BookingExpectation {
  return { personId: invite.inviteePersonId, inviteId: invite.inviteId, openSwapId: lock.current }
}

export async function changeDate(inviteId: string, newDate: string, actor: Actor): Promise<AcceptResult> {
  const invite = await speakerInviteRepository.getInvite(inviteId)
  if (!invite) return fail('NOT_FOUND', 'Invitation not found.')
  const guard = statusGuard(invite, 'accepted')
  if (guard) return guard
  const oldDate = invite.acceptedDate!
  if (!isISODate(newDate)) return fail('INVALID_INPUT', 'Choose a date.')
  if (newDate === oldDate) return fail('INVALID_INPUT', 'That is already your date.')
  if (!isDateAllowed(invite, newDate)) return fail('DATE_NOT_OFFERED', 'That date is not part of this invitation.')
  if (newDate < todayISO()) return fail('DATE_IN_PAST', 'That date has passed.')

  const ref = slotRefOf(invite)
  const entry = historyEntry('changed', actor, { from: oldDate, to: newDate })

  if (!ref) {
    const offered = invite.offeredDates.find((d) => d.date === newDate)!
    const updated = nextInvite(invite, { acceptedDate: newDate, acceptedTime: offered.time, acceptedTz: offered.tz }, [entry])
    try {
      await speakerInviteRepository.commit([{ kind: 'putInvite', invite: updated, expect: { version: invite.version } }])
    } catch (err) {
      if (err instanceof SpeakerWriteConflict) return fail('CONFLICT', 'The invitation changed. Reload and try again.')
      throw err
    }
    await notifyChanged(updated, actor, oldDate)
    return { ok: true, invite: updated }
  }

  const [oldSlot, newSlot, oldBooking] = await Promise.all([
    slotOn(ref, oldDate),
    slotOn(ref, newDate),
    speakerInviteRepository.getBooking(invite.ecclesia, invite.type, oldDate),
  ])
  if (!oldBooking || oldBooking.personId !== invite.inviteePersonId) {
    return fail('CONFLICT', 'Your booking changed. Reload and try again.')
  }
  if (!newSlot || newSlot.state !== 'OPEN') return slotTaken(invite)
  const lock = await swapLock(oldBooking)
  if (!lock.free) return fail('SWAP_PENDING', 'A swap request for your date is waiting for an answer.')

  const person = await personRepository.getById(invite.inviteePersonId)
  const name = personName(person) || invite.inviteeEmail
  const updated = nextInvite(invite, { acceptedDate: newDate, acceptedTime: newSlot.time, acceptedTz: newSlot.tz }, [entry])
  const clear = overlayClear(ref, oldSlot, invite.inviteePersonId, actor.personId)
  const reminder = sheetReminder(clear.sheetNamed, name, oldDate)
  try {
    // One transaction: release the old booking + overlay, take the new ones.
    await speakerInviteRepository.commit([
      { kind: 'deleteBooking', ecclesia: invite.ecclesia, type: invite.type, date: oldDate, expect: heldBookingExpect(invite, lock) },
      ...(clear.op ? [clear.op] : []),
      { kind: 'putBooking', booking: bookingRecord(invite.ecclesia, invite.type, newDate, invite.inviteePersonId, inviteId), expect: 'absent' },
      overlaySet(ref, newSlot, name, invite.inviteePersonId, actor.personId),
      { kind: 'putInvite', invite: updated, expect: { version: invite.version } },
    ])
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return slotTaken(invite)
    throw err
  }

  // Both dates' counterparts are affected: one gains this speaker, one loses him.
  const shortNotice = shortNoticeIfDue(ref.slot, [newSlot, ...(oldSlot ? [oldSlot] : [])])
  await notifyChanged(updated, actor, oldDate, reminder, shortNotice)
  return { ok: true, invite: updated, ...(shortNotice ? { shortNotice } : {}) }
}

async function notifyChanged(
  invite: SpeakerInviteRecord,
  actor: Actor,
  previousDate: string,
  reminder?: InviterNoticeOptions['sheetReminder'],
  shortNotice?: ShortNotice[]
) {
  const details = acceptedDetails(invite)!
  const mine = shortNotice?.find((n) => n.date === details.date)
  await afterCommitEmail('confirmation', invite.inviteId, actor, () =>
    sendConfirmationEmail(invite, details, { reason: 'changed', previousDate, ...(mine ? { shortNotice: mine } : {}) })
  )
  await afterCommitEmail('inviter notice', invite.inviteId, actor, () =>
    sendInviterNotice(invite, 'changed', { previousDate, ...(reminder ? { sheetReminder: reminder } : {}) })
  )
}

// ---------------------------------------------------------------------------
// Cancel (invitee or inviter)
// ---------------------------------------------------------------------------

/** `sheetReminder`: the Sheet still lists the speaker on that date — tell the inviter to remove it. */
export type CancelResult =
  | { ok: true; invite: SpeakerInviteRecord; sheetReminder?: { name: string; date: string } }
  | ServiceError

async function cancel(
  inviteId: string,
  actor: Actor,
  by: 'invitee' | 'inviter',
  rawNote?: string
): Promise<CancelResult> {
  // The speaker's reason, kept in history and passed to the inviter (bounded).
  const note = rawNote?.trim().slice(0, 1000) || undefined
  const invite = await speakerInviteRepository.getInvite(inviteId)
  if (!invite) return fail('NOT_FOUND', 'Invitation not found.')
  if (invite.status === 'cancelled') return fail('INVITE_CANCELLED', 'This invitation is already cancelled.')
  // An inviter may cancel an expired invite (tidy-up); an invitee has nothing to cancel.
  if (by === 'invitee' && effectiveStatus(invite) === 'expired') return fail('INVITE_EXPIRED', 'This invitation has expired.')

  const wasAccepted = invite.status === 'accepted' && !!invite.acceptedDate
  const details = wasAccepted ? acceptedDetails(invite) : null
  const action: InviteHistoryAction = by === 'inviter' ? 'cancelled_by_inviter' : 'cancelled'
  const updated = nextInvite(invite, { status: 'cancelled' }, [
    historyEntry(action, actor, {
      ...(wasAccepted ? { from: invite.acceptedDate } : {}),
      ...(note ? { note } : {}),
    }),
  ])
  const ops: SpeakerWriteOp[] = []
  let reminder: InviterNoticeOptions['sheetReminder']

  const ref = slotRefOf(invite)
  if (wasAccepted && ref) {
    const date = invite.acceptedDate!
    const [slot, booking] = await Promise.all([
      slotOn(ref, date),
      speakerInviteRepository.getBooking(invite.ecclesia, invite.type, date),
    ])
    const lock = await swapLock(booking)
    if (!lock.free) return fail('SWAP_PENDING', 'A swap request for this date is waiting for an answer.')
    // Release only a booking that is still this invite's (a missing one has nothing to release).
    if (booking && booking.personId === invite.inviteePersonId && booking.inviteId === invite.inviteId) {
      ops.push({ kind: 'deleteBooking', ecclesia: invite.ecclesia, type: invite.type, date, expect: heldBookingExpect(invite, lock) })
    }
    const clear = overlayClear(ref, slot, invite.inviteePersonId, actor.personId)
    if (clear.op) ops.push(clear.op)
    if (clear.sheetNamed) {
      const person = await personRepository.getById(invite.inviteePersonId)
      reminder = sheetReminder(true, personName(person) || invite.inviteeEmail, date)
    }
  }
  ops.push({ kind: 'putInvite', invite: updated, expect: { version: invite.version } })

  try {
    await speakerInviteRepository.commit(ops)
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return fail('CONFLICT', 'The invitation changed. Reload and try again.')
    throw err
  }

  if (details) {
    await afterCommitEmail('cancellation', inviteId, actor, () => sendCancellationEmail(updated, details))
  }
  if (by === 'invitee') {
    await afterCommitEmail('inviter notice', inviteId, actor, () =>
      sendInviterNotice(
        updated,
        'cancelled',
        reminder || note ? { ...(reminder ? { sheetReminder: reminder } : {}), ...(note ? { reason: note } : {}) } : undefined
      )
    )
  }
  return { ok: true, invite: updated, ...(reminder ? { sheetReminder: reminder } : {}) }
}

export const cancelByInvitee = (inviteId: string, actor: Actor, note?: string) =>
  cancel(inviteId, actor, 'invitee', note)
export const cancelByInviter = (inviteId: string, actor: Actor) => cancel(inviteId, actor, 'inviter')

// ---------------------------------------------------------------------------
// Resend (§9 invites list)
// ---------------------------------------------------------------------------

/**
 * Re-send the email for the invite's current state — the invitation while
 * `sent`, the confirmation once `accepted` — with fresh token links. A
 * `resent` history entry is written first: it is the record of the resend and
 * it moves the email's idempotency key on, so each resend is its own claim.
 * Refused for cancelled / expired invites. A failed send is reported (the
 * inviter pressed the button) and recorded as `email_failed`.
 */
export async function resendInvite(
  inviteId: string,
  actor: Actor
): Promise<{ ok: true; invite: SpeakerInviteRecord; sent: 'invitation' | 'confirmation' } | ServiceError> {
  const invite = await speakerInviteRepository.getInvite(inviteId)
  if (!invite) return fail('NOT_FOUND', 'Invitation not found.')
  const status = effectiveStatus(invite)
  if (status === 'cancelled') return fail('INVITE_CANCELLED', 'This invitation was cancelled.')
  if (status === 'expired') return fail('INVITE_EXPIRED', 'This invitation has expired.')
  const sent = status === 'accepted' ? 'confirmation' : 'invitation'

  const updated = nextInvite(invite, {}, [historyEntry('resent', actor, { note: sent })])
  try {
    await speakerInviteRepository.commit([{ kind: 'putInvite', invite: updated, expect: { version: invite.version } }])
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return fail('CONFLICT', 'The invitation changed. Reload and try again.')
    throw err
  }

  try {
    if (sent === 'invitation') await sendInvitationEmail(updated)
    else await sendConfirmationEmail(updated, acceptedDetails(updated)!, { reason: 'accepted' })
  } catch (err: any) {
    console.error('[speaker-invites] resend failed:', err)
    await speakerInviteRepository
      .appendHistory(inviteId, [historyEntry('email_failed', actor, { note: `resend ${sent}: ${err?.message ?? String(err)}` })])
      .catch(() => undefined)
    return fail('SEND_FAILED', 'The email could not be sent. Try again later.')
  }
  return { ok: true, invite: updated, sent }
}

// ---------------------------------------------------------------------------
// Swaps (§7)
// ---------------------------------------------------------------------------

/** Swap expiry: 7 days, or the START of the earlier appointment, whichever is sooner. */
export function swapExpiry(createdAt: Date, a: { date: string; time: string; tz: string }, b: { date: string; time: string; tz: string }): Date {
  const earlier = Math.min(zonedStart(a.date, a.time, a.tz).getTime(), zonedStart(b.date, b.time, b.tz).getTime())
  return new Date(Math.min(createdAt.getTime() + SWAP_TTL_MS, earlier))
}

const COUNTERPART: Record<string, { role: CounterpartRole; field: string }> = {
  Exhort: { role: 'Presiding', field: 'Preside' },
  Preside: { role: 'Exhorting', field: 'Exhort' },
  Speaker: { role: 'Host', field: 'Host' },
}

/** True when `at` is within 24h of either appointment's start (§7.6). */
export function isShortNotice(at: Date, sides: Array<{ date: string; time: string; tz: string }>): boolean {
  return sides.some((s) => zonedStart(s.date, s.time, s.tz).getTime() - at.getTime() <= SHORT_NOTICE_MS)
}

/** The "please inform the {counterpart}" note for each swapped date. Names are FULL here. */
export function shortNoticesFor(field: string, slots: Array<{ date: string; row?: Record<string, any> }>): ShortNotice[] {
  const cp = COUNTERPART[field]
  if (!cp) return []
  return slots.map((s) => {
    const name = String(s.row?.[cp.field] ?? '').trim()
    return { date: s.date, counterpartRole: cp.role, ...(name ? { counterpartName: name } : {}) }
  })
}

export type SwapResult = { ok: true; swap: SpeakerSwapRecord; shortNotice?: ShortNotice[] } | ServiceError

export async function requestSwap(
  inviteId: string,
  targetDate: string,
  note: string | undefined,
  actor: Actor
): Promise<SwapResult> {
  const invite = await speakerInviteRepository.getInvite(inviteId)
  if (!invite) return fail('NOT_FOUND', 'Invitation not found.')
  const ref = slotRefOf(invite)
  if (!ref) return fail('SWAP_NOT_AVAILABLE', 'Swaps are not available for this kind of invitation.')
  const guard = statusGuard(invite, 'accepted')
  if (guard) return guard
  const myDate = invite.acceptedDate!
  if (!isISODate(targetDate) || targetDate === myDate) return fail('INVALID_INPUT', 'Choose another speaker’s date.')
  if (!isDateAllowed(invite, targetDate)) return fail('DATE_NOT_OFFERED', 'That date is outside this invitation’s window.')
  if (targetDate < todayISO()) return fail('DATE_IN_PAST', 'That date has passed.')

  const [targetSlot, myBooking, targetBooking] = await Promise.all([
    slotOn(ref, targetDate),
    speakerInviteRepository.getBooking(invite.ecclesia, invite.type, myDate),
    speakerInviteRepository.getBooking(invite.ecclesia, invite.type, targetDate),
  ])
  if (!myBooking || myBooking.personId !== invite.inviteePersonId) {
    return fail('CONFLICT', 'Your booking changed. Reload and try again.')
  }
  if (!targetSlot || targetSlot.state !== 'FILLED' || !targetSlot.speakerPersonId) {
    return fail('TARGET_UNREACHABLE', 'That date has no speaker we can contact. Contact the inviter to arrange it.')
  }
  if (targetSlot.speakerPersonId === invite.inviteePersonId) return fail('INVALID_INPUT', 'That is already your date.')
  const targetPerson = await personRepository.getById(targetSlot.speakerPersonId)
  // Their own primary, or the (household) address their invite was sent to.
  if (!targetPerson || !(await speakerEmailFor(targetPerson.personId, targetBooking?.inviteId, targetPerson))) {
    return fail('TARGET_UNREACHABLE', 'That speaker has no email on file. Contact the inviter to arrange it.')
  }
  if (targetBooking && targetBooking.personId !== targetPerson.personId) {
    return fail('CONFLICT', 'That date changed. Reload and try again.')
  }
  const [myLock, targetLock] = await Promise.all([swapLock(myBooking), swapLock(targetBooking)])
  if (!myLock.free || !targetLock.free) {
    return fail('SWAP_PENDING', 'There is already an open swap request for one of these dates.')
  }

  const me = await personRepository.getById(invite.inviteePersonId)
  const now = nowFn()
  const requester: SwapSide = {
    personId: invite.inviteePersonId,
    name: personName(me) || invite.inviteeEmail,
    date: myDate,
    time: invite.acceptedTime ?? '',
    tz: invite.acceptedTz ?? DEFAULT_TIMEZONE,
    inviteId: invite.inviteId,
    hadBooking: true,
  }
  const target: SwapSide = {
    personId: targetPerson.personId,
    name: personName(targetPerson) || targetSlot.speakerName || '',
    date: targetDate,
    time: targetSlot.time,
    tz: targetSlot.tz,
    ...(targetBooking?.inviteId ? { inviteId: targetBooking.inviteId } : {}),
    hadBooking: !!targetBooking,
  }
  const expiresAt = swapExpiry(now, requester, target)
  if (expiresAt.getTime() <= now.getTime()) return fail('DATE_IN_PAST', 'One of these appointments has already started.')

  const swapId = randomUUID()
  const trimmedNote = note?.trim() || undefined
  const swap: SpeakerSwapRecord = {
    pkey: speakerInviteKeys.swapPk(swapId),
    skey: 'META',
    swapId,
    ecclesia: invite.ecclesia,
    type: invite.type,
    field: ref.slot.field,
    scheduleType: ref.slot.scheduleType,
    programName: inviteWording(invite).name,
    status: 'open',
    requester,
    target,
    ...(trimmedNote ? { note: trimmedNote } : {}),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    version: 1,
  }

  const updated = nextInvite(invite, {}, [historyEntry('swap_requested', actor, { from: myDate, to: targetDate, note: swapId })])
  const ops: SpeakerWriteOp[] = [
    { kind: 'putSwap', swap, expect: 'absent' },
    {
      kind: 'putBooking',
      booking: { ...myBooking, openSwapId: swapId, updatedAt: now.toISOString() },
      expect: heldBookingExpect(invite, myLock),
    },
    { kind: 'putInvite', invite: updated, expect: { version: invite.version } },
  ]
  if (targetBooking) {
    ops.push({
      kind: 'putBooking',
      booking: { ...targetBooking, openSwapId: swapId, updatedAt: now.toISOString() },
      expect: { personId: targetBooking.personId, openSwapId: targetLock.current },
    })
  }
  try {
    await speakerInviteRepository.commit(ops)
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return fail('SWAP_PENDING', 'Something changed while sending. Reload and try again.')
    throw err
  }

  await afterCommitEmail('swap request', inviteId, actor, () => sendSwapRequestEmail(swap))
  return { ok: true, swap }
}

/** Effective swap status (GET never writes; an elapsed open swap reads as expired). */
export function effectiveSwapStatus(swap: SpeakerSwapRecord): SpeakerSwapRecord['status'] {
  if (swap.status === 'open' && nowFn().getTime() >= Date.parse(swap.expiresAt)) return 'expired'
  return swap.status
}

/** Close a swap without swapping (decline / expire / fail) and free both locks. */
async function closeSwap(swap: SpeakerSwapRecord, status: 'declined' | 'expired' | 'failed', actor: Actor): Promise<SpeakerSwapRecord | null> {
  const now = nowFn().toISOString()
  const closed: SpeakerSwapRecord = { ...swap, status, respondedAt: now, version: swap.version + 1 }
  const ops: SpeakerWriteOp[] = [{ kind: 'putSwap', swap: closed, expect: { version: swap.version, status: 'open' } }]

  for (const side of [swap.requester, swap.target]) {
    if (!side.hadBooking) continue
    const b = await speakerInviteRepository.getBooking(swap.ecclesia, swap.type, side.date)
    if (b && b.openSwapId === swap.swapId) {
      const { openSwapId: _drop, ...rest } = b
      ops.push({ kind: 'putBooking', booking: { ...rest, updatedAt: now }, expect: { personId: b.personId, openSwapId: swap.swapId } })
    }
  }
  const history: InviteHistoryAction = status === 'declined' ? 'swap_declined' : 'swap_expired'
  if (swap.requester.inviteId && status !== 'failed') {
    const inv = await speakerInviteRepository.getInvite(swap.requester.inviteId)
    if (inv) {
      ops.push({
        kind: 'putInvite',
        invite: nextInvite(inv, {}, [historyEntry(history, actor, { note: swap.swapId })]),
        expect: { version: inv.version },
      })
    }
  }
  try {
    await speakerInviteRepository.commit(ops)
    return closed
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return null
    throw err
  }
}

export async function respondSwap(swapId: string, response: 'accept' | 'decline', actor: Actor): Promise<SwapResult> {
  const swap = await speakerInviteRepository.getSwap(swapId)
  if (!swap) return fail('NOT_FOUND', 'Swap request not found.')
  if (swap.status !== 'open') return fail('SWAP_CLOSED', 'This swap request has already been answered.', { status: swap.status })

  if (effectiveSwapStatus(swap) === 'expired') {
    const closed = await closeSwap(swap, 'expired', actor)
    if (closed) {
      await afterCommitEmail('swap outcome', swap.requester.inviteId ?? null, actor, () => sendSwapOutcomeEmail(closed, 'expired'))
    }
    return fail('SWAP_EXPIRED', 'This swap request has expired.')
  }

  if (response === 'decline') {
    const closed = await closeSwap(swap, 'declined', actor)
    if (!closed) return fail('CONFLICT', 'The swap request changed. Reload and try again.')
    await afterCommitEmail('swap outcome', swap.requester.inviteId ?? null, actor, () => sendSwapOutcomeEmail(closed, 'declined'))
    return { ok: true, swap: closed }
  }

  // ACCEPT — both sides must still be exactly as they were when requested.
  const R = swap.requester
  const T = swap.target
  const ref = swapRefOf(swap)
  const [rBooking, tBooking, rSlot, tSlot, rInvite, tInvite, rPerson, tPerson] = await Promise.all([
    speakerInviteRepository.getBooking(swap.ecclesia, swap.type, R.date),
    speakerInviteRepository.getBooking(swap.ecclesia, swap.type, T.date),
    slotOn(ref, R.date),
    slotOn(ref, T.date),
    R.inviteId ? speakerInviteRepository.getInvite(R.inviteId) : Promise.resolve(null),
    T.inviteId ? speakerInviteRepository.getInvite(T.inviteId) : Promise.resolve(null),
    personRepository.getById(R.personId),
    personRepository.getById(T.personId),
  ])

  const unchanged =
    !!rBooking &&
    rBooking.personId === R.personId &&
    (rBooking.inviteId ?? undefined) === R.inviteId &&
    rBooking.openSwapId === swap.swapId &&
    (T.hadBooking
      ? !!tBooking && tBooking.personId === T.personId && tBooking.openSwapId === swap.swapId
      : !tBooking) &&
    rSlot?.state === 'FILLED' &&
    rSlot.speakerPersonId === R.personId &&
    tSlot?.state === 'FILLED' &&
    tSlot.speakerPersonId === T.personId &&
    !!rInvite &&
    rInvite.status === 'accepted' &&
    rInvite.acceptedDate === R.date &&
    (!T.inviteId || (!!tInvite && tInvite.status === 'accepted' && tInvite.acceptedDate === T.date))

  if (!unchanged || !rSlot || !tSlot || !rInvite) {
    await closeSwap(swap, 'failed', actor)
    return fail('SWAP_STALE', 'One of the appointments changed since the request. Nothing was swapped.')
  }

  const now = nowFn()
  const rName = personName(rPerson) || R.name
  const tName = personName(tPerson) || T.name
  const accepted: SpeakerSwapRecord = { ...swap, status: 'accepted', respondedAt: now.toISOString(), version: swap.version + 1 }

  const rInviteNext = nextInvite(rInvite, { acceptedDate: T.date, acceptedTime: tSlot.time, acceptedTz: tSlot.tz }, [
    historyEntry('swap_accepted', actor, { from: R.date, to: T.date, note: swap.swapId }),
  ])
  const tInviteNext = tInvite
    ? nextInvite(tInvite, { acceptedDate: R.date, acceptedTime: rSlot.time, acceptedTz: rSlot.tz }, [
        historyEntry('swapped_in', actor, { from: T.date, to: R.date, note: swap.swapId }),
      ])
    : null

  const ops: SpeakerWriteOp[] = [
    // Requester's old date now belongs to the target …
    {
      kind: 'putBooking',
      booking: bookingRecord(swap.ecclesia, swap.type, R.date, T.personId, T.inviteId, rBooking),
      expect: { personId: R.personId, inviteId: R.inviteId ?? null, openSwapId: swap.swapId },
    },
    // … and the target's date to the requester.
    {
      kind: 'putBooking',
      booking: bookingRecord(swap.ecclesia, swap.type, T.date, R.personId, R.inviteId, tBooking),
      expect: T.hadBooking ? { personId: T.personId, openSwapId: swap.swapId } : 'absent',
    },
    overlaySet(ref, rSlot, tName, T.personId, actor.personId),
    overlaySet(ref, tSlot, rName, R.personId, actor.personId),
    { kind: 'putSwap', swap: accepted, expect: { version: swap.version, status: 'open' } },
    { kind: 'putInvite', invite: rInviteNext, expect: { version: rInvite.version } },
    ...(tInvite && tInviteNext ? [{ kind: 'putInvite' as const, invite: tInviteNext, expect: { version: tInvite.version } }] : []),
  ]

  try {
    await speakerInviteRepository.commit(ops)
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) {
      await closeSwap(swap, 'failed', actor).catch(() => null)
      return fail('SWAP_STALE', 'One of the appointments changed since the request. Nothing was swapped.')
    }
    throw err
  }

  const shortNotice = isShortNotice(now, [R, T]) ? shortNoticesFor(swap.field, [rSlot, tSlot]) : undefined
  const noticeFor = (date: string) => shortNotice?.find((n) => n.date === date)

  // Fresh confirmations for both. The inviter is neither asked nor notified (§7.7).
  await afterCommitEmail('confirmation', rInviteNext.inviteId, actor, () =>
    sendConfirmationEmail(
      rInviteNext,
      bookingDetails(swap.ecclesia, swap.type, T.date, tSlot.time, tSlot.tz, R.personId, R.inviteId, ref.slot),
      { reason: 'swapped', swapId: swap.swapId, previousDate: R.date, shortNotice: noticeFor(T.date) }
    )
  )
  await afterCommitEmail('confirmation', tInviteNext?.inviteId ?? null, actor, () =>
    sendConfirmationEmail(
      tInviteNext,
      bookingDetails(swap.ecclesia, swap.type, R.date, rSlot.time, rSlot.tz, T.personId, T.inviteId, ref.slot),
      { reason: 'swapped', swapId: swap.swapId, previousDate: T.date, shortNotice: noticeFor(R.date) }
    )
  )

  return { ok: true, swap: accepted, ...(shortNotice ? { shortNotice } : {}) }
}

/**
 * The short-notice note for the swap view (GET). For an open swap: what
 * accepting NOW would trigger. For an accepted one: whether it was.
 */
export async function swapViewShortNotice(swap: SpeakerSwapRecord): Promise<ShortNotice[] | undefined> {
  const at = swap.status === 'accepted' && swap.respondedAt ? new Date(swap.respondedAt) : nowFn()
  if (swap.status !== 'accepted' && effectiveSwapStatus(swap) !== 'open') return undefined
  if (!isShortNotice(at, [swap.requester, swap.target])) return undefined
  const ref = swapRefOf(swap)
  const [r, t] = await Promise.all([slotOn(ref, swap.requester.date), slotOn(ref, swap.target.date)])
  return shortNoticesFor(swap.field, [r ?? { date: swap.requester.date }, t ?? { date: swap.target.date }])
}

// ---------------------------------------------------------------------------
// Follow-up (§9a)
// ---------------------------------------------------------------------------

/** Mark an invite's follow-up resolved (inviter of its ecclesia or owner; the route checks). Idempotent. */
export async function resolveFollowUp(
  inviteId: string,
  actor: Actor
): Promise<{ ok: true; invite: SpeakerInviteRecord } | ServiceError> {
  const invite = await speakerInviteRepository.getInvite(inviteId)
  if (!invite) return fail('NOT_FOUND', 'Invitation not found.')
  if (!invite.followUp) return fail('INVALID_INPUT', 'This invitation has nothing to follow up.')
  if (invite.followUp.resolvedAt) return { ok: true, invite }
  const at = nowFn().toISOString()
  const updated = nextInvite(
    invite,
    { followUp: { ...invite.followUp, resolvedAt: at, resolvedByPersonId: actor.personId } },
    [historyEntry('follow_up_resolved', actor, { note: invite.followUp.kind })]
  )
  try {
    await speakerInviteRepository.commit([{ kind: 'putInvite', invite: updated, expect: { version: invite.version } }])
  } catch (err) {
    if (err instanceof SpeakerWriteConflict) return fail('CONFLICT', 'The invitation changed. Reload and try again.')
    throw err
  }
  return { ok: true, invite: updated }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getInvite(inviteId: string): Promise<SpeakerInviteRecord | null> {
  return speakerInviteRepository.getInvite(inviteId)
}

export async function listInvites(ecclesia: string): Promise<SpeakerInviteRecord[]> {
  return speakerInviteRepository.listInvitesByEcclesia(ecclesia)
}

export async function getSwap(swapId: string): Promise<SpeakerSwapRecord | null> {
  return speakerInviteRepository.getSwap(swapId)
}
