/**
 * How an unverified contact change becomes verified — the community-confirmation
 * rules, in one place.
 *
 * THE PRINCIPLE IS TRANSPARENCY, NOT HIDING. A proposed change is always shown
 * alongside the last confirmed value, clearly marked unverified, so a reader can
 * make an informed decision. If Brian has reportedly moved to a home in
 * Hamilton and the confirmed address is still Peterborough, somebody deciding
 * where to send a gift needs to SEE both — not be silently handed one of them.
 *
 * "We mostly trust each other", so confirmation is a community act. A change is
 * verified by ANY of:
 *
 *   - TWO other members of the ecclesia confirming it, without the member
 *     themselves having to click anything,
 *   - ONE Recording Brother or Rep from the same ecclesia,
 *   - the member's own approval (handled separately, and authoritative — see
 *     `applyApprovedEdit`).
 *
 * Those collapse into a single rule: **confirmation weight ≥ 2**, where an
 * ordinary member's vote is worth 1 and an RB's or Rep's is worth 2. One
 * threshold, so there is no second code path to drift.
 *
 * Weight is a FUNCTION rather than a constant because a trust system is coming:
 * somebody who votes often, is borne out by others and has no redactions should
 * weigh more; somebody who repeatedly votes carelessly should weigh less. That
 * plugs in here without reshaping any stored data.
 *
 * Pure + I/O-free. Cross-platform.
 */

import { ROLES } from '../provider/auth/auth-roles'

/** Confirmations needed before a proposed value is treated as verified. */
export const VERIFICATION_THRESHOLD = 2

export interface Voter {
  personId: string
  role?: string
  ecclesia?: string
  /** Designation, not a role — an RB carries Rep-level confirming authority. */
  isRecordingBrother?: boolean
  /** Reserved for the trust system; absent means "ordinary standing". */
  trustMultiplier?: number
}

export interface ContactVote {
  voterPersonId: string
  weight: number
  votedAt: string
}

/**
 * What one person's confirmation is worth.
 *
 * Zero means they may not confirm at all — a vote from outside the ecclesia
 * says nothing about whether somebody has moved house, and a guest has no
 * standing to assert it.
 */
export function voteWeight(voter: Voter, subjectEcclesia?: string): number {
  // Confirming is a claim of local knowledge. Someone from another ecclesia is
  // not in a position to make it.
  if (!voter.ecclesia || !subjectEcclesia || voter.ecclesia !== subjectEcclesia) return 0

  const role = voter.role
  if (role === ROLES.GUEST || role === ROLES.DECEASED || role === ROLES.SUSPICIOUS) return 0

  const isLeader =
    voter.isRecordingBrother ||
    role === ROLES.RECORDER ||
    role === ROLES.REP ||
    role === ROLES.ADMIN ||
    role === ROLES.OWNER

  // An RB or Rep alone meets the threshold; an ordinary member is half of it.
  const base = isLeader ? VERIFICATION_THRESHOLD : 1

  // Trust scaling, when it exists, must never let one careless member
  // single-handedly verify — so an ordinary vote is capped below the threshold.
  const scaled = base * (voter.trustMultiplier ?? 1)
  return isLeader ? scaled : Math.min(scaled, VERIFICATION_THRESHOLD - 0.5)
}

export interface VerificationProgress {
  weight: number
  threshold: number
  isVerified: boolean
  /** Whole confirmations still wanted — for "needs 1 more confirmation". */
  remaining: number
  voterIds: string[]
}

/** Where a proposed change stands, for display and for the decision to apply it. */
export function verificationProgress(votes: ContactVote[]): VerificationProgress {
  const weight = votes.reduce((sum, v) => sum + (v.weight || 0), 0)
  return {
    weight,
    threshold: VERIFICATION_THRESHOLD,
    isVerified: weight >= VERIFICATION_THRESHOLD,
    remaining: Math.max(0, Math.ceil(VERIFICATION_THRESHOLD - weight)),
    voterIds: votes.map((v) => v.voterPersonId),
  }
}

/** Human sentence for the progress badge. Plain words — members read this. */
export function progressLabel(progress: VerificationProgress): string {
  if (progress.isVerified) return 'Confirmed'
  if (progress.weight === 0) return `Needs ${progress.remaining} confirmations`
  return progress.remaining === 1
    ? 'Needs 1 more confirmation'
    : `Needs ${progress.remaining} more confirmations`
}

/** Whether this person may still confirm — nobody confirms twice, or their own. */
export function canVote(
  voter: Voter,
  subjectPersonId: string,
  subjectEcclesia: string | undefined,
  existingVotes: ContactVote[]
): { allowed: boolean; reason?: string } {
  if (voter.personId === subjectPersonId) {
    // Not a snub: the member's own confirmation is a different, stronger act
    // handled by the approval flow, which applies the change outright.
    return { allowed: false, reason: 'This is your own record — approve the change instead.' }
  }
  if (existingVotes.some((v) => v.voterPersonId === voter.personId)) {
    return { allowed: false, reason: 'You have already confirmed this.' }
  }
  if (voteWeight(voter, subjectEcclesia) <= 0) {
    return { allowed: false, reason: 'Only members of the same ecclesia can confirm a change.' }
  }
  return { allowed: true }
}

/**
 * The confirmation state of one proposed contact value, as the API hands it to
 * the UI. Shipped to everybody who can see the contact — see the note at the
 * top of this file: the point is that a pending change is visible.
 */
export interface ConfirmationProgress {
  weight: number
  threshold: number
  /** Whole confirmations still wanted. */
  remaining: number
  /** Ready-to-render sentence, e.g. "Needs 1 more confirmation". */
  label: string
  /** This viewer has already confirmed it — show the state, not the button. */
  hasVoted: boolean
  /** This viewer may confirm it now. */
  canConfirm: boolean
  /** Why they may not, written for display. Absent when they may. */
  blockedReason?: string
}
