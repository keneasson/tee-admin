import type {
  InviteHistoryEntry,
  InviteTrust,
  OfferedDate,
  ShortNotice,
  SpeakerInviteStatus,
  SpeakerInviteType,
  SpeakerSwapStatus,
} from '@my/app/provider/dynamodb/speaker-invite-types'

/**
 * Wire shapes the speaker-invite screens read. They mirror the API responses
 * (`apps/next/utils/speaker-invites/views.ts` and `slots.ts`); the screens are
 * shared code and must not import from the web app, so the JSON contract is
 * restated here as types only.
 */

export type SlotState = 'OPEN' | 'FILLED' | 'NO_MEETING'
export type NoMeetingReason = 'NO_SCHEDULE_ROW' | 'CANCELLED' | 'NO_SERVICE_AT_HALL' | 'SPECIAL_OCCASION'

export interface InviteSlot {
  date: string
  time: string
  tz: string
  state: SlotState
  speakerName?: string
  reason?: NoMeetingReason
  reasonNote?: string
}

export interface InviteContact {
  name: string
  email: string | null
}

export interface InviteeInviteView {
  inviteId: string
  ecclesia: string
  type: SpeakerInviteType
  status: SpeakerInviteStatus
  invitee: { firstName: string; lastName: string }
  inviter: InviteContact | null
  note?: string
  acceptedDate?: string
  acceptedTime?: string
  acceptedTz?: string
  offeredDates: InviteSlot[]
  otherDates: InviteSlot[] | null
  swapAvailable: boolean
  /** Not yet sent by the API (see report): the hall, when it gets added. */
  place?: { hallName?: string; address?: string }
  /** Not yet sent by the API: the server-built Google Calendar link. */
  googleCalendarUrl?: string
  shortNotice?: ShortNotice[]
}

export interface SwapSideView {
  name: string | undefined
  date: string
  time: string
  tz: string
}

export interface SwapView {
  swapId: string
  ecclesia: string
  type: SpeakerInviteType
  status: SpeakerSwapStatus
  requester: SwapSideView
  target: SwapSideView
  note?: string
  expiresAt: string
  shortNotice?: ShortNotice[]
}

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
  invitee: InviteContact | null
}

/** Error body every speaker-invite route returns: `{ error, code, ... }`. */
export interface InviteApiError {
  error?: string
  code?: string
  trust?: InviteTrust
  stepUpRequired?: boolean
  mismatch?: boolean
  openDates?: InviteSlot[]
  dates?: Array<{ date: string; state: string }>
  status?: string
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: InviteApiError }

export type { ShortNotice, SpeakerInviteType, SpeakerInviteStatus, InviteHistoryEntry, InviteTrust }
