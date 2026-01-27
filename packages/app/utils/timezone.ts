/**
 * Timezone utilities for event date/time handling
 *
 * Key concepts:
 * - Dates with time: Stored as ISO-8601 UTC (e.g., '2026-01-10T19:00:00.000Z')
 * - Date-only: Stored as YYYY-MM-DD string (e.g., '2026-01-10') - no timezone conversion
 * - Event timezone: IANA timezone string (e.g., 'America/Toronto')
 */

// Available timezone options for the form dropdown
export const TIMEZONE_OPTIONS = [
  { value: 'America/Toronto', label: 'Toronto (Eastern)' },
  { value: 'America/Vancouver', label: 'Vancouver (Pacific)' },
  { value: 'America/Edmonton', label: 'Edmonton (Mountain)' },
  { value: 'America/Winnipeg', label: 'Winnipeg (Central)' },
  { value: 'America/Halifax', label: 'Halifax (Atlantic)' },
  { value: 'America/St_Johns', label: "St. John's (Newfoundland)" },
] as const

export const DEFAULT_TIMEZONE = 'America/Toronto'

// Map IANA timezone to city name for display
const TIMEZONE_CITY_NAMES: Record<string, string> = {
  'America/Toronto': 'Toronto',
  'America/Vancouver': 'Vancouver',
  'America/Edmonton': 'Edmonton',
  'America/Winnipeg': 'Winnipeg',
  'America/Halifax': 'Halifax',
  'America/St_Johns': "St. John's",
}

/**
 * Check if a date string is date-only (no time component)
 * Date-only format: YYYY-MM-DD (no T, no timezone)
 */
export function isDateOnly(dateString: string | Date | undefined | null): boolean {
  if (!dateString) return false
  if (dateString instanceof Date) return false
  // Date-only format doesn't have 'T' character
  return typeof dateString === 'string' && !dateString.includes('T')
}

/**
 * Get city name from IANA timezone
 */
export function getTimezoneCityName(timezone: string): string {
  return TIMEZONE_CITY_NAMES[timezone] || timezone.split('/').pop()?.replace(/_/g, ' ') || timezone
}

/**
 * Format a date in a specific timezone
 * Returns formatted string like "January 10, 2026"
 */
export function formatDateInTimezone(
  date: Date | string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }

  return dateObj.toLocaleDateString('en-US', { ...defaultOptions, ...options })
}

/**
 * Format time in a specific timezone
 * Returns formatted string like "7:00pm"
 */
export function formatTimeInTimezone(date: Date | string, timezone: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }

  return dateObj.toLocaleTimeString('en-US', options).toLowerCase().replace(' ', '')
}

/**
 * Format date and time in a specific timezone
 * Returns formatted string like "January 10, 2026 at 7:00pm"
 */
export function formatDateTimeInTimezone(date: Date | string, timezone: string): string {
  const dateStr = formatDateInTimezone(date, timezone, { weekday: undefined })
  const timeStr = formatTimeInTimezone(date, timezone)
  return `${dateStr} at ${timeStr}`
}

/**
 * Format time with dual timezone display if user is in a different timezone
 * Returns: "7:00pm Toronto" or "7:00pm Toronto, 4:00pm Vancouver"
 */
export function formatTimeWithDualTimezone(
  date: Date | string,
  eventTimezone: string,
  userTimezone: string
): string {
  const eventTime = formatTimeInTimezone(date, eventTimezone)
  const eventCity = getTimezoneCityName(eventTimezone)

  if (eventTimezone === userTimezone) {
    return `${eventTime} (${eventCity} time)`
  }

  const userTime = formatTimeInTimezone(date, userTimezone)
  const userCity = getTimezoneCityName(userTimezone)

  return `${eventTime} ${eventCity}, ${userTime} ${userCity}`
}

/**
 * Format a time range (e.g., for visitation: 6:00pm - 8:00pm)
 */
export function formatTimeRange(
  startDate: Date | string,
  endDate: Date | string,
  timezone: string
): string {
  const startTime = formatTimeInTimezone(startDate, timezone)
  const endTime = formatTimeInTimezone(endDate, timezone)
  return `${startTime} - ${endTime}`
}

/**
 * Format a time range with dual timezone display
 */
export function formatTimeRangeWithDualTimezone(
  startDate: Date | string,
  endDate: Date | string,
  eventTimezone: string,
  userTimezone: string
): string {
  const eventRange = formatTimeRange(startDate, endDate, eventTimezone)
  const eventCity = getTimezoneCityName(eventTimezone)

  if (eventTimezone === userTimezone) {
    return `${eventRange} (${eventCity} time)`
  }

  const userRange = formatTimeRange(startDate, endDate, userTimezone)
  const userCity = getTimezoneCityName(userTimezone)

  return `${eventRange} ${eventCity}, ${userRange} ${userCity}`
}

/**
 * Get user's timezone from browser
 * Falls back to America/Toronto if detection fails
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * Parse a date-only string (YYYY-MM-DD) without timezone conversion
 * Returns a Date at midnight LOCAL time (not UTC)
 */
export function parseDateOnly(dateString: string): Date {
  // Parse YYYY-MM-DD as local date, not UTC
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a date-only value for display (no timezone conversion)
 */
export function formatDateOnly(dateString: string): string {
  const date = parseDateOnly(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Convert a date-only string to YYYY-MM-DD format
 */
export function toDateOnlyString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Check if a date has a meaningful time component (not midnight)
 */
export function hasTimeComponent(date: Date | string): boolean {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.getHours() !== 0 || dateObj.getMinutes() !== 0
}
