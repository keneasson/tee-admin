/**
 * Centralized Service Time Configuration
 *
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for all service times.
 *
 * Key concepts:
 * - All times are in Toronto timezone (America/Toronto)
 * - expectedDayOfWeek helps validate data integrity (0 = Sunday, 3 = Wednesday, etc.)
 * - These times are used to:
 *   1. Inject accurate timestamps during sheet sync
 *   2. Display times in email templates
 *   3. Convert dates for display in user's timezone
 */

import { ProgramsTypes } from '../types'

export interface ServiceTimeConfig {
  /** Human-readable name for the service */
  name: string
  /** Default time in 24-hour format (HH:mm) */
  defaultTime: string
  /** Expected day of week (0=Sunday, 1=Monday, ..., 6=Saturday) */
  expectedDayOfWeek: number
  /** IANA timezone identifier */
  timezone: string
  /** Default location for the service */
  location: string
  /** Display time format (for emails and UI) */
  displayTime: string
}

export const SERVICE_TIMES: Record<ProgramsTypes, ServiceTimeConfig> = {
  [ProgramsTypes.memorial]: {
    name: 'Memorial Service',
    defaultTime: '11:00',
    expectedDayOfWeek: 0, // Sunday
    timezone: 'America/Toronto',
    location: 'Main Hall',
    displayTime: '11:00 AM',
  },
  [ProgramsTypes.sundaySchool]: {
    name: 'Sunday School',
    defaultTime: '09:30',
    expectedDayOfWeek: 0, // Sunday
    timezone: 'America/Toronto',
    location: 'Classroom A',
    displayTime: '9:30 AM',
  },
  [ProgramsTypes.bibleClass]: {
    name: 'Bible Class',
    defaultTime: '19:30',
    expectedDayOfWeek: 3, // Wednesday
    timezone: 'America/Toronto',
    location: 'Fellowship Hall',
    displayTime: '7:30 PM',
  },
  [ProgramsTypes.cyc]: {
    name: 'CYC',
    defaultTime: '18:30',
    expectedDayOfWeek: 6, // Saturday (but may vary)
    timezone: 'America/Toronto',
    location: 'Youth Room',
    displayTime: '6:30 PM',
  },
}

/**
 * Get service time config by program type
 */
export function getServiceTimeConfig(type: ProgramsTypes): ServiceTimeConfig {
  return SERVICE_TIMES[type]
}

/**
 * Get service time config by string type (for API routes)
 */
export function getServiceTimeConfigByString(
  type: string
): ServiceTimeConfig | undefined {
  return SERVICE_TIMES[type as ProgramsTypes]
}

/**
 * Combine a date string (YYYY-MM-DD) with a service time config to create a full ISO datetime
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param serviceType - The type of service (memorial, bibleClass, etc.)
 * @returns ISO datetime string in UTC (e.g., "2026-02-01T16:00:00.000Z" for 11am Toronto)
 */
export function combineDateWithServiceTime(
  dateString: string,
  serviceType: ProgramsTypes
): string {
  const config = SERVICE_TIMES[serviceType]
  const [hours, minutes] = config.defaultTime.split(':').map(Number)
  const [year, month, day] = dateString.split('-').map(Number)

  // Strategy: Create a reference date in UTC, then use Intl to find what time
  // in Toronto corresponds to that UTC time. The difference tells us the offset.

  // Create a UTC date at the target time (as if Toronto were UTC)
  const tentativeUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
  const tentativeDate = new Date(tentativeUtc)

  // Format this UTC time as if viewed in Toronto timezone
  const torontoFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  // Parse the Toronto-formatted time back
  const parts = torontoFormatter.formatToParts(tentativeDate)
  const torontoParts: Record<string, string> = {}
  for (const part of parts) {
    torontoParts[part.type] = part.value
  }

  const torontoHour = parseInt(torontoParts.hour || '0', 10)
  const torontoMinute = parseInt(torontoParts.minute || '0', 10)
  const torontoDay = parseInt(torontoParts.day || '1', 10)

  // Calculate how much we need to adjust
  // If tentativeUtc shows as 6:00 in Toronto but we want 11:00 Toronto,
  // we need to add 5 hours to get the correct UTC time
  let hourDiff = hours - torontoHour
  let dayDiff = day - torontoDay

  // Handle day boundary crossing
  if (dayDiff > 0) {
    hourDiff += 24
  } else if (dayDiff < 0) {
    hourDiff -= 24
  }

  const minuteDiff = minutes - torontoMinute
  const adjustmentMs = (hourDiff * 60 + minuteDiff) * 60 * 1000

  // Apply adjustment to get correct UTC time
  const correctUtc = new Date(tentativeUtc + adjustmentMs)

  return correctUtc.toISOString()
}

/**
 * Validate that a date falls on the expected day of week for a service
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param serviceType - The type of service
 * @returns Object with isValid flag and optional warning message
 */
export function validateServiceDate(
  dateString: string,
  serviceType: ProgramsTypes
): { isValid: boolean; warning?: string } {
  const config = SERVICE_TIMES[serviceType]
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const actualDay = date.getDay()

  // CYC can vary, so skip strict validation
  if (serviceType === ProgramsTypes.cyc) {
    return { isValid: true }
  }

  if (actualDay !== config.expectedDayOfWeek) {
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]
    return {
      isValid: false,
      warning: `${config.name} on ${dateString} falls on ${dayNames[actualDay]}, expected ${dayNames[config.expectedDayOfWeek]}`,
    }
  }

  return { isValid: true }
}

/**
 * Get day of week name from number
 */
export function getDayOfWeekName(dayNum: number): string {
  const dayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ]
  return dayNames[dayNum] || 'Unknown'
}
