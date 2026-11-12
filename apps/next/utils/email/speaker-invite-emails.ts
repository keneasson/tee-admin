import type {
  ShortNotice,
  SpeakerInviteRecord,
  SpeakerInviteType,
  SpeakerSwapRecord,
} from '@my/app/provider/dynamodb/speaker-invite-types'

/**
 * Email seam for speaker invitations (spec §8). The service calls these AFTER
 * its database writes commit; a failure here never rolls a booking back — the
 * service logs it and records `email_failed` in the invite's history.
 *
 * Phase 2 fills these in (templates in apps/email-builder/emails/Speaker*.tsx,
 * the hosted .ics and Google Calendar link in apps/next/utils/calendar/*),
 * following the exhorter heads-up send pattern.
 */

/** The appointment an email is about. Lecture bookings live on the invite only. */
export interface SpeakerBookingDetails {
  ecclesia: string
  type: SpeakerInviteType
  date: string // YYYY-MM-DD
  time: string // HH:mm local ('' if the schedule has no time)
  tz: string // IANA
  personId: string
  inviteId?: string
}

export interface ConfirmationOptions {
  /** Present when a swap was accepted within 24h of either appointment (§7.6). */
  shortNotice?: ShortNotice
  /** Why the confirmation is (re)sent. */
  reason?: 'accepted' | 'changed' | 'swapped'
}

export type InviterNoticeEvent = 'accepted' | 'changed' | 'cancelled'

export type SwapOutcome = 'declined' | 'expired'

export async function sendInvitationEmail(_invite: SpeakerInviteRecord): Promise<void> {
  // TODO(phase2): render SpeakerInvitation, send from the canonical brand sender, Reply-To = inviter.
  throw new Error('not implemented')
}

/**
 * `invite` is null for a speaker whose booking came from the Sheet and who
 * received a date through a swap (no invite of their own).
 */
export async function sendConfirmationEmail(
  _invite: SpeakerInviteRecord | null,
  _booking: SpeakerBookingDetails,
  _options?: ConfirmationOptions
): Promise<void> {
  // TODO(phase2): render SpeakerConfirmation with Google Calendar + hosted .ics links.
  throw new Error('not implemented')
}

export async function sendSwapRequestEmail(_swap: SpeakerSwapRecord): Promise<void> {
  // TODO(phase2): render SpeakerSwapRequest to swap.target with their own token link.
  throw new Error('not implemented')
}

/** Tells the requester their swap request was declined or expired (§7.5). */
export async function sendSwapOutcomeEmail(_swap: SpeakerSwapRecord, _outcome: SwapOutcome): Promise<void> {
  // TODO(phase2)
  throw new Error('not implemented')
}

export async function sendInviterNotice(_invite: SpeakerInviteRecord, _event: InviterNoticeEvent): Promise<void> {
  // TODO(phase2): render SpeakerInviterNotice (reminds the RB to update the Sheet if they keep one).
  throw new Error('not implemented')
}

export async function sendCancellationEmail(
  _invite: SpeakerInviteRecord,
  _booking: SpeakerBookingDetails
): Promise<void> {
  // TODO(phase2): cancellation email with the METHOD:CANCEL .ics link.
  throw new Error('not implemented')
}
