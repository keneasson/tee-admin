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

export interface ScheduleTypeDef {
  defaultLabel: string           // Default tab name
  fields: ScheduleFieldDef[]     // All possible fields in display order
}

/**
 * Complete field catalogue.
 * Order matters — it determines default column order in the table.
 * This is the menu of what's available, NOT what's turned on.
 */
export const SCHEDULE_TYPE_CATALOGUE: Record<ScheduleTypeKey, ScheduleTypeDef> = {
  memorial: {
    defaultLabel: 'Memorial Service',
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
    fields: [
      { key: 'Presider', defaultLabel: 'Presider' },
      { key: 'Speaker', defaultLabel: 'Speaker' },
      { key: 'Topic', defaultLabel: 'Topic' },
      { key: 'Host', defaultLabel: 'Host Ecclesia' },
    ],
  },
  sundaySchool: {
    defaultLabel: 'Sunday School',
    fields: [
      { key: 'Refreshments', defaultLabel: 'Refreshments' },
      { key: 'Holidays and Special Events', defaultLabel: 'Holidays & Special Events' },
    ],
  },
  cyc: {
    defaultLabel: 'CYC',
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

/**
 * Build a default config for an ecclesia with NO saved config.
 * MVP approach: only Memorial Service is enabled, with only Exhort on.
 * Everything else is available in the catalogue but turned off.
 */
export function buildDefaultScheduleConfig(): Record<ScheduleTypeKey, {
  enabled: boolean
  label: string
  fields: Array<{ key: string; label: string; enabled: boolean }>
}> {
  const config = {} as Record<ScheduleTypeKey, {
    enabled: boolean
    label: string
    fields: Array<{ key: string; label: string; enabled: boolean }>
  }>
  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const typeDef = SCHEDULE_TYPE_CATALOGUE[typeKey]
    const isMemorial = typeKey === 'memorial'
    config[typeKey] = {
      enabled: isMemorial,  // Only Memorial enabled by default
      label: typeDef.defaultLabel,
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
 * - Preserves saved labels and enabled state for all existing fields
 * - Adds any new fields from the catalogue that aren't in the saved config
 *   (defaults to disabled — admin must opt in)
 * - Removes fields that are no longer in the catalogue
 */
export function mergeWithCatalogue(
  saved: Record<string, any> | undefined
): Record<ScheduleTypeKey, {
  enabled: boolean
  label: string
  fields: Array<{ key: string; label: string; enabled: boolean }>
}> {
  const defaults = buildDefaultScheduleConfig()
  if (!saved) return defaults

  const merged = { ...defaults }
  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const savedType = saved[typeKey]
    if (!savedType) continue

    merged[typeKey] = {
      enabled: savedType.enabled ?? defaults[typeKey].enabled,
      label: savedType.label || defaults[typeKey].label,
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
