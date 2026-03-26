/**
 * Unified service time resolver.
 *
 * Resolves the effective service time for a given ecclesia and schedule type.
 * Priority: ecclesia's stored serviceTime > catalogue defaults.
 *
 * Also provides a helper to derive a directory-friendly service list from
 * the schedule config, replacing the deprecated EcclesiaData.services[] array.
 */

import {
  type ScheduleTypeKey,
  type ServiceTimeDef,
  type ScheduleTypeConfigState,
  SCHEDULE_TYPE_CATALOGUE,
  SCHEDULE_TYPE_KEYS,
  mergeWithCatalogue,
} from './schedule-fields'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Resolve the effective service time for a given ecclesia and schedule type.
 * Returns the ecclesia's override if stored, otherwise catalogue defaults.
 */
export function resolveServiceTime(
  scheduleConfig: Record<string, any> | undefined,
  typeKey: ScheduleTypeKey
): ServiceTimeDef & { name: string } {
  const merged = mergeWithCatalogue(scheduleConfig)
  const typeConfig = merged[typeKey]

  return {
    name: typeConfig.label,
    ...typeConfig.serviceTime,
  }
}

/**
 * Resolve service times for all enabled schedule types.
 */
export function resolveAllServiceTimes(
  scheduleConfig: Record<string, any> | undefined
): Partial<Record<ScheduleTypeKey, ServiceTimeDef & { name: string }>> {
  const merged = mergeWithCatalogue(scheduleConfig)
  const result: Partial<Record<ScheduleTypeKey, ServiceTimeDef & { name: string }>> = {}

  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const typeConfig = merged[typeKey]
    if (typeConfig.enabled) {
      result[typeKey] = {
        name: typeConfig.label,
        ...typeConfig.serviceTime,
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
  time: string        // "11:00 AM"
  location: string    // "Main Hall"
  timezone: string    // "America/Toronto"
}

/**
 * Derive a directory-friendly service list from scheduleConfig.
 * Only includes enabled schedule types.
 * Replaces the deprecated EcclesiaData.services[] array.
 */
export function deriveServicesFromScheduleConfig(
  scheduleConfig: Record<string, any> | undefined
): DerivedWorshipService[] {
  const merged = mergeWithCatalogue(scheduleConfig)

  return SCHEDULE_TYPE_KEYS
    .filter(typeKey => merged[typeKey].enabled)
    .map(typeKey => {
      const config = merged[typeKey]
      return {
        id: typeKey,
        name: config.label,
        type: typeKey,
        day: DAY_NAMES[config.serviceTime.expectedDayOfWeek] || 'Unknown',
        time: config.serviceTime.displayTime,
        location: config.serviceTime.location,
        timezone: config.serviceTime.timezone,
      }
    })
}

/**
 * Get the day of week name for a service time definition.
 */
export function getServiceDayName(serviceTime: ServiceTimeDef): string {
  return DAY_NAMES[serviceTime.expectedDayOfWeek] || 'Unknown'
}
