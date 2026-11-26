/**
 * Schedule-row rules shared by the public schedule (apps/next/utils/schedule-data.ts),
 * the exhorter heads-up (apps/next/utils/email/exhorter-heads-up.ts) and speaker
 * invitations' `getSlots` (apps/next/utils/speaker-invites/slots.ts).
 *
 * Moved here from apps/next so all three read ONE definition of "is this row a
 * meeting" and "is this a cancelled / relocated occurrence". Pure, no I/O.
 */

/** The "Holidays and Special Events" text on a Sunday School row (raw or transformed key). */
export function sundaySchoolNoClassNote(row: any): string {
  return String(row?.['Holidays and Special Events'] ?? row?.HolidaysAndSpecialEvents ?? '').trim()
}

/**
 * Text that clearly says there is NO class. Whole-word, case-insensitive and
 * deliberately conservative: a family name or ordinary text must never match.
 * A bare "Holiday" does NOT match (it could be a note about a class that still
 * runs); it needs "holiday break" or similar.
 */
const NO_CLASS_TEXT_RE = new RegExp(
  [
    'no\\s+(sunday\\s+)?school',
    'no\\s+class(es)?',
    'no\\s+ss',
    'cancel(l)?ed',
    'not\\s+(running|held|meeting)',
    '(christmas|summer|march|holiday)\\s+break',
  ]
    .map((p) => `\\b${p}\\b`)
    .join('|'),
  'i'
)

/** Whether free text clearly says there is no class. */
export function looksLikeNoClass(text: unknown): boolean {
  return NO_CLASS_TEXT_RE.test(String(text ?? ''))
}

export interface SundaySchoolDecision {
  /** Whether a class runs. */
  runs: boolean
  /** Why there is no class (empty when a class runs). */
  note: string
  /** Refreshments looks like a class but the Holidays note says no class. A class wins. */
  conflict: boolean
}

/**
 * THE one "does Sunday School run" decision, shared by the schedule page, the
 * newsletter (email + web), the Sunday School email and the exhorter heads-up.
 * Precedence: override 'cancelled' forces none, 'active' forces a class; else
 * blank Refreshments, or Refreshments that says "no class", means none (the
 * reason is the Holidays and Special Events text, or the Refreshments text).
 */
export function resolveSundaySchool(row: any): SundaySchoolDecision {
  const refreshments = String(row?.Refreshments ?? '').trim()
  const holiday = sundaySchoolNoClassNote(row)
  const refreshmentsSaysNoClass = refreshments !== '' && looksLikeNoClass(refreshments)
  const conflict = refreshments !== '' && !refreshmentsSaysNoClass && looksLikeNoClass(holiday)
  const note = refreshmentsSaysNoClass ? (holiday || refreshments) : holiday

  if (row?.overrideStatus === 'cancelled') return { runs: false, note, conflict: false }
  if (row?.overrideStatus === 'active') return { runs: true, note: '', conflict: false }
  if (refreshments === '' || refreshmentsSaysNoClass) return { runs: false, note, conflict: false }
  return { runs: true, note: '', conflict }
}

/** Whether Sunday School actually runs for this row (see resolveSundaySchool). */
export function sundaySchoolClassRuns(row: any): boolean {
  return resolveSundaySchool(row).runs
}

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
    case 'sundaySchool': {
      const decision = resolveSundaySchool(event)
      if (decision.runs) {
        if (decision.conflict) event.conflict = true
        return true
      }
      // No class (blank Refreshments, or Refreshments saying so) with a reason
      // somewhere: keep the row so the schedule can say why.
      if (decision.note) {
        event.noClass = true
        event.noClassNote = decision.note
        return true
      }
      return false
    }
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
