import type { ServiceOverrideType } from './service-override-types'

/**
 * Speaker Invitations (docs/SPEAKER_INVITATIONS.md §5). All records live in the
 * `tee-admin` table with lowercase `pkey`/`skey`.
 *
 *   SPEAKER_INVITE#{inviteId}            / META    → SpeakerInviteRecord
 *   SPEAKER_BOOKING#{ecclesia}#{type}    / {date}  → SpeakerBookingRecord (one per slot)
 *   SPEAKER_SWAP#{swapId}                / META    → SpeakerSwapRecord
 */

export type SpeakerInviteType = 'memorial' | 'bible_class' | 'lecture'

export const SPEAKER_INVITE_TYPES: readonly SpeakerInviteType[] = ['memorial', 'bible_class', 'lecture']

/**
 * Which schedule + slot field an invite type fills (§3). Lecture has no schedule
 * type yet (#110 Slice D): its booking lives on the invite only, with no swap.
 * Stored as data so a lecture roster picks up scanning by adding one entry here.
 */
export const INVITE_TYPE_SLOT: Record<
  SpeakerInviteType,
  { scheduleType: ServiceOverrideType; field: string } | null
> = {
  memorial: { scheduleType: 'memorial', field: 'Exhort' },
  bible_class: { scheduleType: 'bibleClass', field: 'Speaker' },
  lecture: null,
}

export type SpeakerInviteStatus = 'sent' | 'accepted' | 'cancelled' | 'expired'

export type InviteTrust = 'anonymous' | 'recognized' | 'authenticated'

export type InviteHistoryAction =
  | 'created'
  | 'accepted'
  | 'changed'
  | 'cancelled'
  | 'cancelled_by_inviter'
  | 'swap_requested'
  | 'swap_accepted'
  | 'swap_declined'
  | 'swap_expired'
  | 'swapped_in'
  | 'resent'
  | 'email_failed'

export interface InviteHistoryEntry {
  at: string
  action: InviteHistoryAction
  byPersonId: string
  trust: InviteTrust
  from?: string
  to?: string
  note?: string
}

export interface OfferedDate {
  date: string // YYYY-MM-DD
  time: string // HH:mm, local to tz ('' when the schedule has no time)
  tz: string // IANA timezone
}

export interface SpeakerInviteRecord {
  pkey: string // SPEAKER_INVITE#{inviteId}
  skey: 'META'
  /** gsi1 listing for the inviter's ecclesia: SPEAKER_INVITES#{ecclesia} / {createdAt}#{inviteId} */
  gsi1pk: string
  gsi1sk: string

  inviteId: string
  ecclesia: string
  type: SpeakerInviteType
  status: SpeakerInviteStatus

  inviterPersonId: string
  inviteePersonId: string
  inviteeEmail: string

  offeredDates: OfferedDate[]
  otherDatesWindow?: { from: string; to: string }

  acceptedDate?: string
  /** time/tz of the accepted date (copied from the slot or the offered date) */
  acceptedTime?: string
  acceptedTz?: string
  note?: string
  history: InviteHistoryEntry[]

  createdAt: string
  updatedAt: string
  version: number
}

export interface SpeakerBookingRecord {
  pkey: string // SPEAKER_BOOKING#{ecclesia}#{type}
  skey: string // {date}
  ecclesia: string
  type: SpeakerInviteType
  date: string
  personId: string
  /** Absent when the booking was created for a Sheet-filled speaker by a swap. */
  inviteId?: string
  /** Set while a swap request on this booking is open (one at a time, §7.5). */
  openSwapId?: string
  createdAt: string
  updatedAt: string
}

export type SpeakerSwapStatus = 'open' | 'accepted' | 'declined' | 'expired' | 'failed'

export interface SwapSide {
  personId: string
  name: string
  date: string
  time: string
  tz: string
  /** The side's invite, when its booking came from one. */
  inviteId?: string
  /** Whether a SPEAKER_BOOKING existed for this side when the swap was requested. */
  hadBooking: boolean
}

export interface SpeakerSwapRecord {
  pkey: string // SPEAKER_SWAP#{swapId}
  skey: 'META'
  swapId: string
  ecclesia: string
  type: SpeakerInviteType
  field: string
  status: SpeakerSwapStatus
  requester: SwapSide
  target: SwapSide
  note?: string
  createdAt: string
  expiresAt: string
  respondedAt?: string
  version: number
}

/** Who the counterpart of a swapped role is (§7.6). */
export type CounterpartRole = 'Presiding' | 'Exhorting' | 'Host'

export interface ShortNotice {
  /** The appointment date this note is about. */
  date: string
  counterpartRole: CounterpartRole
  counterpartName?: string
}

export const speakerInviteKeys = {
  invitePk: (inviteId: string) => `SPEAKER_INVITE#${inviteId}`,
  bookingPk: (ecclesia: string, type: SpeakerInviteType) => `SPEAKER_BOOKING#${ecclesia}#${type}`,
  swapPk: (swapId: string) => `SPEAKER_SWAP#${swapId}`,
  META: 'META' as const,
}

// ---------------------------------------------------------------------------
// Wire contract shared by the API (apps/next) and the screens
// (packages/app/features/speaker-invites). Declared ONCE here: both sides
// import these, neither redeclares them.
// ---------------------------------------------------------------------------

export type SlotState = 'OPEN' | 'FILLED' | 'NO_MEETING'

/** Why a date is NO_MEETING. */
export type NoMeetingReason = 'NO_SCHEDULE_ROW' | 'CANCELLED' | 'NO_SERVICE_AT_HALL' | 'SPECIAL_OCCASION'

/** One date as `getSlots` reports it (§4). */
export interface Slot {
  date: string
  time: string
  tz: string
  state: SlotState
  speakerName?: string
  /** Inviter-facing only; invitee responses never carry it. */
  speakerPersonId?: string
  /**
   * Invitee views, FILLED slots only: the speaker resolves to a person with an
   * email, so a swap can be requested. false → "Filled. Contact {inviter} to arrange".
   */
  reachable?: boolean
  reason?: NoMeetingReason
  /** Free text behind `reason` (override message, the row's note). */
  reasonNote?: string
}

/** What the inviter picks, and how lists name each type. */
export const INVITE_TYPE_LABEL: Record<SpeakerInviteType, string> = {
  memorial: 'Memorial exhortation',
  bible_class: 'Bible Class',
  lecture: 'Lecture',
}

/** "An invitation to {phrase} at {ecclesia}" (§1). */
export const INVITE_TYPE_PHRASE: Record<SpeakerInviteType, string> = {
  memorial: 'exhort at the Memorial',
  bible_class: 'lead Bible Class',
  lecture: 'give a Lecture',
}

export const INVITE_STATUS_LABEL: Record<SpeakerInviteStatus, string> = {
  sent: 'Waiting for a reply',
  accepted: 'Accepted',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

/** The invites list's history line for each action. */
export const INVITE_HISTORY_ACTION_LABEL: Record<InviteHistoryAction, string> = {
  created: 'Invitation sent',
  accepted: 'Accepted',
  changed: 'Changed date',
  cancelled: 'Cancelled by the speaker',
  cancelled_by_inviter: 'Cancelled by the sender',
  swap_requested: 'Asked to swap',
  swap_accepted: 'Swap accepted',
  swap_declined: 'Swap declined',
  swap_expired: 'Swap request expired',
  swapped_in: 'Swapped in',
  resent: 'Email sent again',
  email_failed: 'An email could not be sent',
}

export const NO_MEETING_REASON_LABEL: Record<NoMeetingReason, string> = {
  NO_SCHEDULE_ROW: 'No meeting scheduled',
  CANCELLED: 'Meeting cancelled',
  NO_SERVICE_AT_HALL: 'No service at the hall',
  SPECIAL_OCCASION: 'Special occasion',
}

export interface OnlineMeeting {
  label: string
  url?: string
  meetingId?: string
  password?: string
  dialInNumber?: string
}

/** Where the accepted appointment is (§8.2), as the confirmation email shows it. */
export interface AppointmentPlaceView {
  hallName?: string
  address?: string
  onlineMeetings?: OnlineMeeting[]
}

export interface InviteContactView {
  name: string
  email: string | null
}

/** GET /api/invite/{inviteId} → `invite`. */
export interface InviteeInviteView {
  inviteId: string
  ecclesia: string
  type: SpeakerInviteType
  status: SpeakerInviteStatus
  invitee: { firstName: string; lastName: string }
  inviter: InviteContactView | null
  note?: string
  acceptedDate?: string
  acceptedTime?: string
  acceptedTz?: string
  /** Offered dates with their live state (stored dates when not actionable). */
  offeredDates: Slot[]
  /** Other dates in the window, when the inviter enabled them; null otherwise. */
  otherDates: Slot[] | null
  swapAvailable: boolean
  /** Accepted only: the hall + online options, from the same helper as the email. */
  place?: AppointmentPlaceView
  /** Accepted only. */
  googleCalendarUrl?: string
  /** Accepted (or cancelled after accepting): the hosted .ics, same-origin path. */
  icsUrl?: string
}

export interface SwapSideView {
  name: string | undefined
  date: string
  time: string
  tz: string
}

/** GET/POST /api/invite/swap/{swapId} → `swap`. */
export interface SwapView {
  swapId: string
  ecclesia: string
  type: SpeakerInviteType
  status: SpeakerSwapStatus
  /** Who is looking: the speaker asked to trade, or the one who asked. */
  viewerRole: 'target' | 'requester'
  requester: SwapSideView
  target: SwapSideView
  note?: string
  expiresAt: string
  shortNotice?: ShortNotice[]
}
