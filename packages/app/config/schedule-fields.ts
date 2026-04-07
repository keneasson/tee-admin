/**
 * Master catalogue of all known schedule fields per type.
 * DB keys are stable and shared across all ecclesias.
 *
 * The catalogue is the complete set of what's POSSIBLE.
 * Each ecclesia opts in to what they need — nothing is enabled by default
 * except the bare MVP (Memorial Service with Exhort only).
 *
 * This lets admins onboard gradually without being overwhelmed,
 * and supports ecclesias in sensitive locations where naming people
 * may not be appropriate.
 */

export type ScheduleTypeKey = 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'

export interface ScheduleFieldDef {
  key: string           // Stable DB key — never changes
  defaultLabel: string  // Sensible default label
}

/** A single time period for a worship service (supports seasonal schedules) */
export interface ServiceTimePeriod {
  /** Label for this period (e.g. "Regular", "Summer Hours") — optional, for admin display */
  label?: string
  /** Start month (1=January, 12=December). If omitted, this is the default/year-round schedule */
  startMonth?: number
  /** End month (1=January, 12=December). If omitted, this is the default/year-round schedule */
  endMonth?: number
  /** Service time in 24-hour format (HH:mm) */
  defaultTime: string
  /** Display time format (for emails and UI, e.g. "11:00 AM") */
  displayTime: string
  /** Expected day of week (0=Sunday, 1=Monday, ..., 6=Saturday) */
  expectedDayOfWeek: number
}

/** Service time configuration for a worship service type */
export interface ServiceTimeDef {
  /** IANA timezone identifier */
  timezone: string
  /** Default location for the service */
  location: string
  /**
   * Time periods — supports seasonal schedules.
   * The first entry without startMonth/endMonth is the default.
   * Additional entries with month bounds override during that period.
   * Example: [{ displayTime: "11:00 AM", ... }, { label: "Summer", startMonth: 7, endMonth: 8, displayTime: "10:00 AM", ... }]
   */
  schedule: ServiceTimePeriod[]
}

export interface ScheduleTypeDef {
  defaultLabel: string           // Default tab name
  fields: ScheduleFieldDef[]     // All possible fields in display order
  serviceTime: ServiceTimeDef    // Default service time/location
}

/**
 * Complete field catalogue.
 * Order matters — it determines default column order in the table.
 * This is the menu of what's available, NOT what's turned on.
 */
export const SCHEDULE_TYPE_CATALOGUE: Record<ScheduleTypeKey, ScheduleTypeDef> = {
  memorial: {
    defaultLabel: 'Memorial Service',
    serviceTime: {
      timezone: 'America/Toronto',
      location: '',
      schedule: [{ defaultTime: '', displayTime: '', expectedDayOfWeek: 0 }],
    },
    fields: [
      { key: 'Exhort', defaultLabel: 'Exhort' },
      { key: 'Preside', defaultLabel: 'Preside' },
      { key: 'Reading1', defaultLabel: 'First Reading' },
      { key: 'Reading2', defaultLabel: 'Second Reading' },
      { key: 'Organist', defaultLabel: 'Organist' },
      { key: 'Steward', defaultLabel: 'Steward' },
      { key: 'Doorkeeper', defaultLabel: 'Doorkeeper' },
      { key: 'Collection', defaultLabel: 'Collection' },
      { key: 'Hymn-opening', defaultLabel: 'Opening Hymn' },
      { key: 'Hymn-exhortation', defaultLabel: 'Exhortation Hymn' },
      { key: 'Hymn-memorial', defaultLabel: 'Memorial Hymn' },
      { key: 'Hymn-closing', defaultLabel: 'Closing Hymn' },
      { key: 'Lunch', defaultLabel: 'Lunch' },
      { key: 'Activities', defaultLabel: 'Activities' },
    ],
  },
  bibleClass: {
    defaultLabel: 'Bible Class',
    serviceTime: {
      timezone: 'America/Toronto',
      location: '',
      schedule: [{ defaultTime: '', displayTime: '', expectedDayOfWeek: 3 }],
    },
    fields: [
      { key: 'Presider', defaultLabel: 'Presider' },
      { key: 'Speaker', defaultLabel: 'Speaker' },
      { key: 'Topic', defaultLabel: 'Topic' },
      { key: 'Host', defaultLabel: 'Host Ecclesia' },
    ],
  },
  sundaySchool: {
    defaultLabel: 'Sunday School',
    serviceTime: {
      timezone: 'America/Toronto',
      location: '',
      schedule: [{ defaultTime: '', displayTime: '', expectedDayOfWeek: 0 }],
    },
    fields: [
      { key: 'Refreshments', defaultLabel: 'Refreshments' },
      { key: 'Holidays and Special Events', defaultLabel: 'Holidays & Special Events' },
    ],
  },
  cyc: {
    defaultLabel: 'CYC',
    serviceTime: {
      timezone: 'America/Toronto',
      location: '',
      schedule: [{ defaultTime: '', displayTime: '', expectedDayOfWeek: 6 }],
    },
    fields: [
      { key: 'location', defaultLabel: 'Location' },
      { key: 'speaker', defaultLabel: 'Speaker' },
      { key: 'topic', defaultLabel: 'Topic' },
    ],
  },
}

/**
 * All known schedule type keys in default tab order.
 */
export const SCHEDULE_TYPE_KEYS: ScheduleTypeKey[] = ['memorial', 'bibleClass', 'sundaySchool', 'cyc']

/**
 * MVP fields that are enabled by default for Memorial Service.
 * Everything else starts disabled — admins opt in to what they need.
 */
const MVP_MEMORIAL_FIELDS = new Set(['Exhort'])

/** The shape of a single schedule type's per-ecclesia config */
export interface ScheduleTypeConfigState {
  enabled: boolean
  label: string
  fields: Array<{ key: string; label: string; enabled: boolean }>
  serviceTime: ServiceTimeDef
}

/**
 * Build a default config for an ecclesia with NO saved config.
 * MVP approach: only Memorial Service is enabled, with only Exhort on.
 * Everything else is available in the catalogue but turned off.
 */
export function buildDefaultScheduleConfig(): Record<ScheduleTypeKey, ScheduleTypeConfigState> {
  const config = {} as Record<ScheduleTypeKey, ScheduleTypeConfigState>
  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const typeDef = SCHEDULE_TYPE_CATALOGUE[typeKey]
    const isMemorial = typeKey === 'memorial'
    config[typeKey] = {
      enabled: isMemorial,  // Only Memorial enabled by default
      label: typeDef.defaultLabel,
      serviceTime: { ...typeDef.serviceTime, schedule: [...typeDef.serviceTime.schedule] },
      fields: typeDef.fields.map(f => ({
        key: f.key,
        label: f.defaultLabel,
        enabled: isMemorial && MVP_MEMORIAL_FIELDS.has(f.key),
      })),
    }
  }
  return config
}

/**
 * Merge a saved ecclesia config with the master catalogue.
 * - Preserves saved labels, enabled state, and service times for all existing types
 * - Adds any new fields from the catalogue that aren't in the saved config
 *   (defaults to disabled — admin must opt in)
 * - Removes fields that are no longer in the catalogue
 * - Falls back to catalogue service time defaults when not saved
 */
export function mergeWithCatalogue(
  saved: Record<string, any> | undefined
): Record<ScheduleTypeKey, ScheduleTypeConfigState> {
  const defaults = buildDefaultScheduleConfig()
  if (!saved) return defaults

  const merged = { ...defaults }
  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const savedType = saved[typeKey]
    if (!savedType) continue

    // Merge service time: use saved values over catalogue defaults
    const catalogueServiceTime = SCHEDULE_TYPE_CATALOGUE[typeKey].serviceTime
    const savedServiceTime = savedType.serviceTime
    let serviceTime: ServiceTimeDef
    if (savedServiceTime) {
      // Backward compat: if saved config has old flat format (defaultTime at top level), migrate to schedule array
      if (savedServiceTime.defaultTime && !savedServiceTime.schedule) {
        serviceTime = {
          timezone: savedServiceTime.timezone ?? catalogueServiceTime.timezone,
          location: savedServiceTime.location ?? catalogueServiceTime.location,
          schedule: [{
            defaultTime: savedServiceTime.defaultTime,
            displayTime: savedServiceTime.displayTime ?? '',
            expectedDayOfWeek: savedServiceTime.expectedDayOfWeek ?? catalogueServiceTime.schedule[0].expectedDayOfWeek,
          }],
        }
      } else {
        serviceTime = {
          timezone: savedServiceTime.timezone ?? catalogueServiceTime.timezone,
          location: savedServiceTime.location ?? catalogueServiceTime.location,
          schedule: savedServiceTime.schedule?.length
            ? savedServiceTime.schedule
            : catalogueServiceTime.schedule,
        }
      }
    } else {
      serviceTime = { ...catalogueServiceTime, schedule: [...catalogueServiceTime.schedule] }
    }

    merged[typeKey] = {
      enabled: savedType.enabled ?? defaults[typeKey].enabled,
      label: savedType.label || defaults[typeKey].label,
      serviceTime,
      fields: defaults[typeKey].fields.map(defaultField => {
        const savedField = savedType.fields?.find((f: any) => f.key === defaultField.key)
        if (savedField) {
          return {
            key: defaultField.key,
            label: savedField.label || defaultField.label,
            enabled: savedField.enabled ?? false,
          }
        }
        // New catalogue field not in saved config — disabled until admin opts in
        return { ...defaultField, enabled: false }
      }),
    }
  }
  return merged
}
