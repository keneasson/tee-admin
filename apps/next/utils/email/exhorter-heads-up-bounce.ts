import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  exhorterHeadsUpRepository,
  type PendingHeadsUp,
} from '@my/app/provider/dynamodb/repositories/exhorter-headsup-repository'
import { sendRecipientRepository } from '@my/app/provider/dynamodb/repositories/send-recipient-repository'
import { normalizeToISODate } from '@my/app/utils/service-overrides/merge'
import { exhorterHeadsUpCampaignId } from './exhorter-heads-up'
import { prepareHeadsUpForReview } from './exhorter-heads-up-review'
import { checkSuppressed } from './suppression-check'

/**
 * Sending a heads-up again after the first one BOUNCED (#267).
 *
 * A released heads-up takes the SEND claim, and the claim is what stops a
 * speaker being told twice. When the send hard-bounces he was never told, so
 * the claim guards nothing — but nothing could lift it either, and the review
 * page could only say "reach them another way".
 *
 * This lifts it, under three conditions, and then does exactly what the
 * ordinary flow does: a fresh QA copy, addressed to his CURRENT address, is
 * redirected to the reviewer, who sends it from the link. Nothing here emails
 * the speaker directly — the person who approves the email still reads the
 * email that goes out, with the address it goes to.
 *
 * The conditions:
 *   1. the last send for this Sunday is recorded as bounced;
 *   2. his address on file is NOT the one that bounced (fix the directory first
 *      — re-sending to the same dead address is pointless);
 *   3. the new address is not on the SES suppression list (SES would drop it
 *      silently).
 */

export interface BounceResendStatus {
  /** The send for this copy bounced. */
  bounced: boolean
  bounceType?: string
  bouncedAt?: string
  /** His address on file now — where a re-send would go. */
  currentEmail?: string
  /** A corrected copy has already been sent since the bounce. */
  resolved?: boolean
  /** True when a corrected copy can be prepared right now. */
  eligible: boolean
  /** Why not, in words the reviewer can act on. */
  reason?: string
}

async function deliveryFor(pending: PendingHeadsUp) {
  const rows = await sendRecipientRepository.getCampaignRecipients(
    exhorterHeadsUpCampaignId(pending.date)
  )
  return rows.find((r) => r.email?.toLowerCase() === pending.recipientEmail.toLowerCase())
}

export async function getBounceResendStatus(pending: PendingHeadsUp): Promise<BounceResendStatus> {
  if (!pending.releasedAt) return { bounced: false, eligible: false }

  const row = await deliveryFor(pending)
  if (!row?.bouncedAt) return { bounced: false, eligible: false }

  const base = {
    bounced: true,
    bounceType: row.bounceType,
    bouncedAt: row.bouncedAt,
  }

  if (normalizeToISODate(pending.date) < normalizeToISODate(new Date())) {
    return { ...base, eligible: false, reason: 'That Sunday has passed.' }
  }

  // A corrected copy may already have gone out from a newer link.
  const claim = await exhorterHeadsUpRepository.getClaim(pending.date, pending.personId)
  if (claim && claim.sentTo.toLowerCase() !== pending.recipientEmail.toLowerCase()) {
    return {
      ...base,
      currentEmail: claim.sentTo,
      resolved: true,
      eligible: false,
      reason: `A corrected copy has already been sent to ${claim.sentTo}.`,
    }
  }

  const person = await personRepository.getById(pending.personId)
  const currentEmail = person?.primaryEmail?.trim().toLowerCase() || undefined
  if (!currentEmail) {
    return {
      ...base,
      eligible: false,
      reason: 'He has no email address on file. Add one in the Contact List, then reload this page.',
    }
  }
  if (currentEmail === pending.recipientEmail.toLowerCase()) {
    return {
      ...base,
      currentEmail,
      eligible: false,
      reason:
        'His address on file is still the one that bounced. Correct it in the Contact List, then reload this page.',
    }
  }

  const suppression = await checkSuppressed(currentEmail)
  if (suppression.suppressed) {
    return {
      ...base,
      currentEmail,
      eligible: false,
      reason: `His address on file is on the suppression list${
        suppression.reason ? ` (${suppression.reason.toLowerCase()})` : ''
      } — mail to it would be dropped. Reach him another way.`,
    }
  }

  return { ...base, currentEmail, eligible: true }
}

export type ReopenBouncedResult =
  | { ok: true; redirectedTo?: string; currentEmail: string; date: string }
  | { ok: false; status: number; error: string }

/**
 * Lift the claim on a bounced send and redirect a corrected QA copy.
 * Sends NOTHING to the speaker — the reviewer does that from the new link.
 */
export async function reopenBouncedHeadsUp(
  token: string,
  actor: string
): Promise<ReopenBouncedResult> {
  const pending = await exhorterHeadsUpRepository.findPendingByToken(token)
  if (!pending) return { ok: false, status: 404, error: 'This link is not valid.' }
  if (!pending.releasedAt) {
    return { ok: false, status: 409, error: 'This copy has not been sent yet — there is no bounce to recover from.' }
  }

  const status = await getBounceResendStatus(pending)
  if (!status.bounced) {
    return { ok: false, status: 409, error: 'No bounce is recorded for this send.' }
  }
  if (!status.eligible || !status.currentEmail) {
    return { ok: false, status: 409, error: status.reason ?? 'This cannot be re-sent yet.' }
  }

  const reopened = await exhorterHeadsUpRepository.reopenAfterBounce({
    date: pending.date,
    personId: pending.personId,
    bouncedAddress: pending.recipientEmail.toLowerCase(),
    bounceType: status.bounceType,
    bouncedAt: status.bouncedAt,
    reopenedBy: actor,
  })
  if (!reopened) {
    return {
      ok: false,
      status: 409,
      error: 'Something else has been sent for this Sunday since the bounce. Nothing was changed.',
    }
  }

  const result = await prepareHeadsUpForReview({ date: pending.date })
  if (!result.parked) {
    return {
      ok: false,
      status: 409,
      error:
        result.report.note ??
        `The bounce was cleared, but no corrected copy could be prepared for ${pending.date} (${result.report.status}). Check the schedule, then press this button again.`,
    }
  }
  return {
    ok: true,
    redirectedTo: result.reviewerEmail,
    currentEmail: status.currentEmail,
    date: pending.date,
  }
}
