/**
 * Pure helpers for the {@link RegistrationEditor} (Consolidated CMS 2R-2). A
 * RegistrationBlock stores a fee as a number and a deadline as an ISO instant;
 * the editor lets the author type a forgiving currency string and pick a date.
 * These deterministic conversions live here (no React) so they are unit-testable.
 *
 * Deadline date⇄ISO deliberately reuses the {@link time-resolve.ts} wall-clock
 * conversions (anchored to a default timezone, since a RegistrationBlock carries
 * no timezone of its own) so a deadline round-trips the same way a TimeBlock does.
 */

import { combineWall, utcToWallParts, wallTimeToUtc } from './time-resolve'

/**
 * Parse a forgiving fee string ("$25", "25.00", "1,200") into a number. Returns
 * undefined for blank / non-numeric / negative input, so a cleared field drops
 * the `fee` rather than storing 0 or NaN.
 */
export function parseFee(input: string): number | undefined {
  const cleaned = (input ?? '').replace(/[$,\s]/g, '')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

/** A stored fee → the text shown in the input ('' when unset). */
export function formatFee(fee: number | undefined): string {
  return fee == null ? '' : String(fee)
}

/**
 * A `YYYY-MM-DD` date input (in `timeZone`) → an ISO deadline at start-of-day, or
 * undefined for a blank date (clearing the deadline). Midnight in the zone keeps
 * the calendar date stable regardless of the viewer's own offset.
 */
export function deadlineDateToIso(date: string, timeZone: string): string | undefined {
  if (!date) return undefined
  return wallTimeToUtc(combineWall(date, ''), timeZone)
}

/** An ISO deadline → the `YYYY-MM-DD` value for the date input ('' when unset). */
export function isoToDeadlineDate(iso: string | undefined, timeZone: string): string {
  return utcToWallParts(iso, timeZone).date
}

/**
 * A registration contact must have a name whenever it has an email or phone
 * (#254, ADR-0005). The first name is the safe fallback an unidentified reader
 * sees ("Contact Jessica — Sign in to view contact details"). A bare address
 * has no fallback, so it would vanish for them, which is what broke the
 * Shelburne reception. Returns the publish-blocking message, or null when OK.
 */
export function registrationContactError(block: {
  contactEmail?: string
  contactPhone?: string
  contactPerson?: { firstName?: string }
}): string | null {
  const hasDetail = !!(block.contactEmail?.trim() || block.contactPhone?.trim())
  if (!hasDetail) return null
  if (block.contactPerson?.firstName?.trim()) return null
  return "Registration: add the contact's first name. Readers who aren't signed in see it in place of the email or phone."
}

/** "Jessica Easson", or "Jessica" when only the floor survived redaction. */
export function contactDisplayName(p: { firstName: string; lastName?: string } | undefined): string {
  if (!p) return ''
  return [p.firstName, p.lastName].filter(Boolean).join(' ')
}
