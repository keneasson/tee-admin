/**
 * Unified service time resolver.
 *
 * Resolves the effective service time for a given ecclesia and schedule type,
 * accounting for seasonal schedules (e.g. summer hours).
 *
 * Also provides a helper to derive a directory-friendly service list from
 * the schedule config, replacing the deprecated EcclesiaData.services[] array.
 */

import {
  type ScheduleTypeKey,
  type ServiceTimeDef,
  type ServiceTimePeriod,
  SCHEDULE_TYPE_KEYS,
  mergeWithCatalogue,
} from './schedule-fields'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Get the currently active schedule period based on the date.
 * - Finds the first period whose month range includes the given month
 * - Month ranges can wrap around year boundary (e.g. startMonth=11, endMonth=2 = Nov-Feb)
 * - Falls back to the first period (the default) if no seasonal match
 */
export function getActiveSchedulePeriod(
  schedule: ServiceTimePeriod[],
  date: Date = new Date()
): ServiceTimePeriod {
  if (!schedule || schedule.length === 0) {
    return { defaultTime: '', displayTime: '', expectedDayOfWeek: 0 }
  }

  const month = date.getMonth() + 1 // 1-12

  // Look for a seasonal period that matches the current month
  for (const period of schedule) {
    if (period.startMonth == null || period.endMonth == null) continue

    if (period.startMonth <= period.endMonth) {
      // Simple range: e.g. May(5) to August(8)
      if (month >= period.startMonth && month <= period.endMonth) {
        return period
      }
    } else {
      // Wraps around year: e.g. November(11) to February(2)
      if (month >= period.startMonth || month <= period.endMonth) {
        return period
      }
    }
  }

  // No seasonal match — return the first period (the default/year-round)
  return schedule[0]
}

/** Resolved flat time info for a specific point in time */
export interface ResolvedServiceTime {
  name: string
  defaultTime: string
  displayTime: string
  expectedDayOfWeek: number
  timezone: string
  location: string
}

/**
 * Resolve the effective service time for a given ecclesia and schedule type.
 * Picks the active seasonal period based on the provided date (defaults to now).
 */
export function resolveServiceTime(
  scheduleConfig: Record<string, any> | undefined,
  typeKey: ScheduleTypeKey,
  date?: Date
): ResolvedServiceTime {
  const merged = mergeWithCatalogue(scheduleConfig)
  const typeConfig = merged[typeKey]
  const activePeriod = getActiveSchedulePeriod(typeConfig.serviceTime.schedule, date)

  return {
    name: typeConfig.label,
    defaultTime: activePeriod.defaultTime,
    displayTime: activePeriod.displayTime,
    expectedDayOfWeek: activePeriod.expectedDayOfWeek,
    timezone: typeConfig.serviceTime.timezone,
    location: typeConfig.serviceTime.location,
  }
}

/**
 * Resolve service times for all enabled schedule types.
 */
export function resolveAllServiceTimes(
  scheduleConfig: Record<string, any> | undefined,
  date?: Date
): Partial<Record<ScheduleTypeKey, ResolvedServiceTime>> {
  const merged = mergeWithCatalogue(scheduleConfig)
  const result: Partial<Record<ScheduleTypeKey, ResolvedServiceTime>> = {}

  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const typeConfig = merged[typeKey]
    if (typeConfig.enabled) {
      const activePeriod = getActiveSchedulePeriod(typeConfig.serviceTime.schedule, date)
      result[typeKey] = {
        name: typeConfig.label,
        defaultTime: activePeriod.defaultTime,
        displayTime: activePeriod.displayTime,
        expectedDayOfWeek: activePeriod.expectedDayOfWeek,
        timezone: typeConfig.serviceTime.timezone,
        location: typeConfig.serviceTime.location,
      }
    }
  }

  return result
}

/** A directory-friendly worship service entry derived from schedule config */
export interface DerivedWorshipService {
  id: string          // Schedule type key (e.g. "memorial")
  name: string        // Custom label (e.g. "Breaking of Bread")
  type: ScheduleTypeKey
  day: string         // "Sunday", "Wednesday", etc.
  time: string        // "11:00 AM" (current seasonal period)
  location: string    // "Main Hall"
  timezone: string    // "America/Toronto"
  /** If seasonal schedules exist, includes all periods for display */
  allPeriods?: Array<{
    label?: string
    day: string
    time: string
    months?: string   // e.g. "Jul–Aug"
  }>
}

const MONTH_ABBREV = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Derive a directory-friendly service list from scheduleConfig.
 * Only includes enabled schedule types.
 * Replaces the deprecated EcclesiaData.services[] array.
 */
export function deriveServicesFromScheduleConfig(
  scheduleConfig: Record<string, any> | undefined,
  date?: Date
): DerivedWorshipService[] {
  const merged = mergeWithCatalogue(scheduleConfig)

  return SCHEDULE_TYPE_KEYS
    .filter(typeKey => merged[typeKey].enabled)
    .map(typeKey => {
      const config = merged[typeKey]
      const activePeriod = getActiveSchedulePeriod(config.serviceTime.schedule, date)
      const hasSeasons = config.serviceTime.schedule.length > 1

      const service: DerivedWorshipService = {
        id: typeKey,
        name: config.label,
        type: typeKey,
        day: DAY_NAMES[activePeriod.expectedDayOfWeek] || '',
        time: activePeriod.displayTime,
        location: config.serviceTime.location,
        timezone: config.serviceTime.timezone,
      }

      if (hasSeasons) {
        service.allPeriods = config.serviceTime.schedule.map((p: ServiceTimePeriod) => ({
          label: p.label,
          day: DAY_NAMES[p.expectedDayOfWeek] || '',
          time: p.displayTime,
          months: p.startMonth && p.endMonth
            ? `${MONTH_ABBREV[p.startMonth]}–${MONTH_ABBREV[p.endMonth]}`
            : undefined,
        }))
      }

      return service
    })
}

/**
 * Get the day of week name from a day number.
 */
export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] || 'Unknown'
}
