/**
 * Pure, timezone-aware date helpers for the newsletter / display-rules engines.
 *
 * These were previously private static methods on {@link EventDurationCalculator}
 * (event-duration.ts). They are extracted here VERBATIM (behaviour-identical) so
 * the unified Post lifecycle engine (post-lifecycle.ts) can reuse the exact same
 * "Thursday-before" + timezone-aware day comparison logic WITHOUT duplicating it —
 * the two engines must never disagree about what day an event falls on.
 *
 * Pure + I/O-free. Cross-platform: no platform imports.
 */

/**
 * Get the Thursday before a given date.
 * If the date is itself a Thursday, returns the PREVIOUS Thursday (7 days before).
 * Uses LOCAL day-of-week (matches the legacy funeral reminder semantics).
 */
export function getThursdayBefore(date: Date): Date {
  const result = new Date(date)
  const dayOfWeek = result.getDay()
  // Days to go back to reach Thursday (4). If the date IS Thursday, go back a
  // full week so the reminder lands on the prior Thursday, not the event day.
  const daysBack = dayOfWeek === 4 ? 7 : (dayOfWeek + 3) % 7 || 7
  result.setDate(result.getDate() - daysBack)
  return result
}

/**
 * True when two dates fall on the same calendar day (LOCAL time, ignoring time).
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

/**
 * Timezone-aware "is `currentDate` on or before `eventDate`?" (day granularity).
 *
 * Event dates stored as "YYYY-MM-DD" become midnight UTC, so we read them with
 * UTC accessors to recover the intended calendar day; `currentDate` (a browser
 * `new Date()`) is read with LOCAL accessors to get the viewer's calendar day.
 * Net effect: an event stays "on or before" until midnight in the USER's zone.
 */
export function isUserDateOnOrBefore(currentDate: Date, eventDate: Date): boolean {
  const currentStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
  const eventStr = `${eventDate.getUTCFullYear()}-${String(eventDate.getUTCMonth() + 1).padStart(2, '0')}-${String(eventDate.getUTCDate()).padStart(2, '0')}`
  return currentStr <= eventStr
}
