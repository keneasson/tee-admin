import { serviceOverrideRepository } from '@my/app/provider/dynamodb/repositories/service-override-repository'
import type {
  ServiceOccurrenceOverrideRecord,
  ServiceOverrideType,
} from '@my/app/provider/dynamodb/service-override-types'

/**
 * Shared, server-safe merge layer for per-occurrence service overrides.
 *
 * Both the web transform (`/api/upcoming-program` route) and the email transform
 * (`get_upcoming_program`) call into here so the newsletter and the scheduled
 * email always agree. NO `next` imports — this runs in both contexts.
 */

/**
 * Normalize a raw schedule date to a UTC YYYY-MM-DD key.
 *
 * IMPORTANT: must use UTC components. The web route formats display dates with
 * `timeZone: 'UTC'`, so the override key has to be derived the same way in every
 * path (transform AND admin listing), or an override silently fails to match.
 *
 * Returns '' when the input can't be parsed (caller treats that as "no match").
 */
export function normalizeToISODate(raw: Date | string | undefined | null): string {
  if (!raw) return ''

  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? '' : toUTCDateString(raw)
  }

  // Already an ISO-ish string starting with YYYY-MM-DD — take the date part as-is.
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  if (isoMatch) return isoMatch[1]

  const parsed = new Date(raw)
  return isNaN(parsed.getTime()) ? '' : toUTCDateString(parsed)
}

function toUTCDateString(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Map key for an override: identical to the record's skey. */
export function overrideKey(serviceType: string, isoDate: string): string {
  return `${serviceType}#${isoDate}`
}

/**
 * Fetch all overrides for an ecclesia in a date range, keyed by `serviceType#date`.
 * `serviceTypes` is accepted for symmetry/future filtering but the repo query is a
 * single cheap partition read, so we return everything in range.
 */
export async function fetchServiceOverrides(
  ecclesia: string,
  _serviceTypes: ServiceOverrideType[],
  fromISO: string,
  toISO: string
): Promise<Map<string, ServiceOccurrenceOverrideRecord>> {
  const map = new Map<string, ServiceOccurrenceOverrideRecord>()
  if (!fromISO || !toISO) return map

  try {
    const overrides = await serviceOverrideRepository.listByDateRange(ecclesia, fromISO, toISO)
    for (const o of overrides) {
      map.set(overrideKey(o.serviceType, o.date), o)
    }
  } catch (err) {
    // Overrides are additive — never let a lookup failure break the schedule.
    console.error('[service-overrides] failed to fetch overrides:', err)
  }

  return map
}

/**
 * Annotate a program item with override fields (non-destructive: synced roster
 * fields are left intact; render components decide precedence).
 */
export function applyOverrideToProgramItem<T extends Record<string, any>>(
  item: T,
  override: ServiceOccurrenceOverrideRecord | undefined
): T {
  if (!override) return item

  const target = item as Record<string, any>
  if (override.status !== undefined) target.overrideStatus = override.status
  if (override.message !== undefined) target.overrideMessage = override.message
  if (override.note !== undefined) target.overrideNote = override.note
  if (override.attendOptions !== undefined) target.attendOptions = override.attendOptions

  // Slice A (#110): per-ROLE field overlay. Each key is a catalogue field
  // (Exhort/Preside/Speaker/… — see SCHEDULE_TYPE_CATALOGUE) that maps directly to
  // the program item's role column, so we write the overridden value straight onto
  // the matching column. Only keys PRESENT in the override are touched — absent
  // roster fields keep their synced Sheets value. Values stay first-name redacted
  // downstream because the role column names live in redact-schedule's PERSON_KEYS
  // and redaction runs AFTER this merge on the anon read path.
  if (override.roleFields) {
    for (const [key, value] of Object.entries(override.roleFields)) {
      target[key] = value
    }
  }

  return item
}
