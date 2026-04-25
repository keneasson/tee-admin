// Re-export timezone utilities for convenience
export {
  formatScheduleDateTime,
  formatScheduleDateForEmail,
  formatTimeWithDualTimezone,
  DEFAULT_TIMEZONE,
} from '@my/app/utils/timezone'

export function setAwkwardTimeStuff(asOfDate: string): string {
  const tzname = 'America/New_York'
  const today = new Date(asOfDate)
  const longOffsetFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tzname,
    timeZoneName: 'longOffset',
  })
  const longOffsetString = longOffsetFormatter.format(new Date(today.toISOString())) // '2/28/2013, GMT-05:00'
  return longOffsetString.split('GMT')[1]
}

/**
 * Convert a Date to a human-readable string like "Sunday, February 1, 2026"
 *
 * CRITICAL: Toronto East Memorial is ALWAYS on Sunday, Bible Class ALWAYS on Wednesday.
 * Any changes to this function MUST be verified against these facts.
 *
 * LEGACY BEHAVIOR (date-only strings):
 * Dates in DynamoDB stored as UTC timestamps at midnight (e.g., "2026-02-01T00:00:00.000Z").
 * We use UTC timezone here to ensure the displayed date matches the stored calendar date.
 * Using America/New_York would shift midnight UTC to 7pm EST the PREVIOUS day, causing
 * Sunday to display as Saturday, Wednesday to display as Tuesday, etc.
 *
 * NEW BEHAVIOR (timezone-aware dateTime):
 * For records with `dateTime` and `sourceTimezone` fields, use `formatScheduleDateForEmail()`
 * or `formatScheduleDateTime()` instead. These functions properly handle timezone conversion
 * and display times in the user's preferred timezone.
 *
 * @see formatScheduleDateForEmail - For email templates
 * @see formatScheduleDateTime - For UI display with timezone options
 */
export function convertHumanReadableDate(date: Date): string {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC', // CRITICAL: Use UTC to match stored calendar dates, not local time
  } as Intl.DateTimeFormatOptions

  return date.toLocaleDateString('en-CA', options)
}

/**
 * Convert a Date to a short format like "Feb 1"
 *
 * CRITICAL: Toronto East Memorial is ALWAYS on Sunday, Bible Class ALWAYS on Wednesday.
 * Any changes to this function MUST be verified against these facts.
 *
 * Uses UTC timezone to match stored calendar dates (see convertHumanReadableDate for details).
 */
export function convertToMonthDay(date: Date): string {
  const options = {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC', // CRITICAL: Use UTC to match stored calendar dates
  } as Intl.DateTimeFormatOptions

  return date.toLocaleDateString('en-CA', options)
}

function getNextDayOfTheWeek(
  dayName: string,
  excludeToday = true,
  refDate = new Date()
): Date | undefined {
  const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(
    dayName.slice(0, 3).toLowerCase()
  )
  if (dayOfWeek < 0) return
  refDate.setHours(0, 0, 0, 0)
  refDate.setDate(
    refDate.getDate() + +excludeToday + ((dayOfWeek + 7 - refDate.getDay() - +excludeToday) % 7)
  )
  return refDate
}
