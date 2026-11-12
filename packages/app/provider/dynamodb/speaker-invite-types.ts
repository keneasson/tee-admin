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
