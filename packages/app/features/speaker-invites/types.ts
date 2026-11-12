import type {
  InviteContactView,
  InviteHistoryEntry,
  InviteeInviteView,
  InviteTrust,
  OfferedDate,
  ShortNotice,
  Slot,
  SpeakerInviteStatus,
  SpeakerInviteType,
} from '@my/app/provider/dynamodb/speaker-invite-types'

/**
 * Screen-side types. The wire contract (Slot, InviteeInviteView, SwapView, …)
 * is declared once in `speaker-invite-types.ts`; only shapes it doesn't cover
 * live here.
 */

export type {
  AppointmentPlaceView,
  InviteContactView,
  InviteHistoryEntry,
  InviteeInviteView,
  InviteTrust,
  NoMeetingReason,
  OnlineMeeting,
  ShortNotice,
  Slot,
  SlotState,
  SpeakerInviteStatus,
  SpeakerInviteType,
  SwapSideView,
  SwapView,
} from '@my/app/provider/dynamodb/speaker-invite-types'

/** GET /api/speaker-invites → `invites[]` (the inviter's view). */
export interface InviterInviteView {
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
  acceptedTime?: string
  acceptedTz?: string
  note?: string
  history: InviteHistoryEntry[]
  createdAt: string
  updatedAt: string
  invitee: InviteContactView | null
}

/** Error body every speaker-invite route returns: `{ error, code, ... }`. */
export interface InviteApiError {
  error?: string
  code?: string
  trust?: InviteTrust
  stepUpRequired?: boolean
  mismatch?: boolean
  openDates?: Slot[]
  dates?: Array<{ date: string; state: string }>
  status?: string
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: InviteApiError }

/** accept / change also return `shortNotice` (within 24h of the appointment). */
export type InviteActionResponse = { invite: InviteeInviteView; shortNotice?: ShortNotice[] }
