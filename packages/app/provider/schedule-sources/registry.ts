/**
 * The schedule registry read (docs/ECCLESIA_SCHEDULES.md §Registry).
 *
 *   getScheduleRegistry(ecclesia) → the ecclesia's schedule entries
 *
 * Stored entries win. For the HOME ecclesia, every kind configured in the site
 * configuration (`GOOGLE_SERVICE_ACCOUNT_KEY` → `sheet_ids`) that has no stored
 * entry gets a built-in entry derived here at read time — source `env`, the
 * legacy partition, the roster roles below. Nothing is written to migrate
 * Toronto East, and its sheet IDs never leave the env (built-in entries carry
 * the `sheet_ids` key, not the ID).
 *
 * Never throws without the env var (no built-ins then), and nothing runs on import.
 */
import { googleSheetsConfig } from '../../config/google-sheets'
import { HOME_ECCLESIA } from '../../config/home-ecclesia'
import { SCHEDULE_TYPE_CATALOGUE, SCHEDULE_TYPE_KEYS, type ScheduleTypeKey } from '../../config/schedule-fields'
import { scheduleEcclesiaId } from '../dynamodb/repositories/schedule-repository'
import { scheduleRegistryRepository } from '../dynamodb/repositories/schedule-registry-repository'
import type { RegistryEntry } from './types'

/** Catalogue fields that name a person in the home ecclesia's built-in schedules. */
export const BUILT_IN_ROSTER_ROLES: Readonly<Partial<Record<ScheduleTypeKey, readonly string[]>>> = {
  memorial: ['Exhort', 'Preside', 'Reading1', 'Reading2'],
  bibleClass: ['Presider', 'Speaker'],
  cyc: ['speaker'],
}

interface SiteSheet {
  id: string
  type: string
}

/** The site-configured sheets, or [] when the env var is missing or unusable. */
function siteSheets(): SiteSheet[] {
  try {
    return googleSheetsConfig.getAllSheets()
  } catch {
    return []
  }
}

/** Spreadsheet IDs used by the site configuration (a connect must refuse these). */
export function envSpreadsheetIds(): Set<string> {
  return new Set(siteSheets().map((s) => s.id))
}

function isScheduleKind(type: string): type is ScheduleTypeKey {
  return (SCHEDULE_TYPE_KEYS as string[]).includes(type)
}

/** Built-in entries for the home ecclesia, one per configured schedule kind. */
export function builtInScheduleEntries(): RegistryEntry[] {
  const ecclesiaId = scheduleEcclesiaId(HOME_ECCLESIA.canonicalName)
  const kinds = SCHEDULE_TYPE_KEYS.filter((k) => siteSheets().some((s) => s.type === k))
  return kinds.map((kind) => {
    const def = SCHEDULE_TYPE_CATALOGUE[kind]
    const roster = BUILT_IN_ROSTER_ROLES[kind] ?? []
    return {
      ecclesiaId,
      scheduleId: kind,
      name: def.defaultLabel,
      kind,
      active: true,
      source: { kind: 'env', envKey: kind },
      mapping: {
        dateColumn: 'Date',
        fields: def.fields.map((f) => ({
          column: f.key,
          key: f.key,
          label: f.defaultLabel,
          rosterRole: roster.includes(f.key),
        })),
      },
      builtIn: true,
    }
  })
}

export async function getScheduleRegistry(ecclesia: string): Promise<RegistryEntry[]> {
  if (!ecclesia) return []
  const stored = (await scheduleRegistryRepository.listEntries(scheduleEcclesiaId(ecclesia))).filter((e) =>
    isScheduleKind(e.kind)
  )
  if (!HOME_ECCLESIA.isHomeEcclesia(ecclesia)) return stored

  const storedKinds = new Set(stored.map((e) => e.kind))
  const builtIns = builtInScheduleEntries().filter((e) => !storedKinds.has(e.kind))
  return [...stored, ...builtIns].sort(
    (a, b) => SCHEDULE_TYPE_KEYS.indexOf(a.kind) - SCHEDULE_TYPE_KEYS.indexOf(b.kind)
  )
}
