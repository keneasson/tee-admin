/**
 * Schedule-row rules shared by the public schedule (apps/next/utils/schedule-data.ts),
 * the exhorter heads-up (apps/next/utils/email/exhorter-heads-up.ts) and speaker
 * invitations' `getSlots` (apps/next/utils/speaker-invites/slots.ts).
 *
 * Moved here from apps/next so all three read ONE definition of "is this row a
 * meeting" and "is this a cancelled / relocated occurrence". Pure, no I/O.
 */

/**
 * Whether a flattened schedule row is shown on the public schedule.
 *
 * Side effect (kept from the original): a memorial row with no assignments but
 * a Lunch/Activities note is marked `noServiceAtHall = true` — the note explains
 * why there is no service at the hall that day.
 */
export function isValidScheduleRow(event: any, type: string): boolean {
  switch (type) {
    case 'memorial': {
      const hasAssignments = !!(event.Preside || event.Exhort || event.Organist || event.Steward || event.Doorkeeper)
      if (hasAssignments) return true
      // No assignments — only keep if there's Lunch or Activities content (indicates "no service" with explanation)
      const hasContent = !!(event.Lunch?.trim() || event.Activities?.trim())
      if (hasContent) {
        event.noServiceAtHall = true
        return true
      }
      return false
    }
    case 'bibleClass':
      return !!(event.Presider?.trim() || event.Speaker?.trim() || event.Host?.trim())
    case 'sundaySchool':
      return !!event.Refreshments
    case 'cyc':
      return !!(event.speaker || event.topic)
    default:
      return true
  }
}

// A non-lunch note in the memorial row's `Lunch`/`Activities` free-text columns
// signals the normal at-hall memorial DIDN'T happen — cancelled, online-only, or
// relocated (joining another ecclesia / a fraternal gathering). Keyword-based
// (verified against the live schedule: matches the 4 cancel/relocate days, and
// leaves the "tee study weekend" + potluck days alone). STOPGAP: the durable fix
// is a structured occurrence status on the service-override record (see #124
// follow-up) so we stop parsing free-text.
const SPECIAL_OCCASION_RE = /(cancel|joining|join us at|fraternal gathering|elsewhere)/i

/** Returns the free-text signal for a cancelled/relocated occurrence, else null. */
export function detectSpecialOccasion(lunch?: string, activities?: string): string | null {
  const blob = `${lunch ?? ''}  ${activities ?? ''}`
  if (!SPECIAL_OCCASION_RE.test(blob)) return null
  return activities?.trim() || lunch?.trim() || 'Special occasion — not the usual memorial'
}
