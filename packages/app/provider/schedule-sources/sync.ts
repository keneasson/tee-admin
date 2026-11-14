/**
 * Sync one registry entry (docs/ECCLESIA_SCHEDULES.md §Sources):
 *
 *   readRows → toScheduleRows → ScheduleRepository.replaceSheetSchedules
 *
 * which writes the ecclesia's OWN partition (`schedulePartitionFor`).
 *
 *   - google-sheets: read the entry's tab, map, write (or, dry run, return the
 *     first rows and write nothing)
 *   - env (Toronto East's site configuration): skipped — the webhook writes
 *     those rows, unchanged
 *   - native: skipped — nothing to read
 *
 * Time: rows carry the mapped time (normalised to HH:mm when it can be read)
 * and NO `dateTime` / `sourceTimezone`. Toronto East's service-time config must
 * not be stamped on another ecclesia's rows; readers such as speaker slots fall
 * back to the ecclesia's own configured service time.
 *
 * Refuses (never writes): a sheet that is in Toronto East's site configuration,
 * a google-sheets entry for the home ecclesia (its schedules come from the site
 * configuration this round), an entry without an ecclesia name.
 */
import { HOME_ECCLESIA } from '../../config/home-ecclesia'
import { toScheduleRows } from './mapping'
import { envSpreadsheetIds } from './registry'
import { googleSheetsSource, ScheduleSourceError, type GoogleSheetsConfigShape } from './google-sheets'
import type { LastSync, RegistryEntry, ScheduleRowInput, ScheduleSource } from './types'

export const PREVIEW_ROWS = 5

export type SyncOutcome =
  | { status: 'skipped'; reason: string }
  | { status: 'preview'; rows: ScheduleRowInput[]; total: number }
  | { status: 'ok'; rows: number; written: number; failed: number; errors: string[] }
  | { status: 'error'; code: string; error: string }

export interface SyncDeps {
  sheets: ScheduleSource<GoogleSheetsConfigShape>
  replace: (
    sheetId: string,
    rows: ScheduleRowInput[]
  ) => Promise<{ successful: number; failed: number; errors: string[] }>
  saveEntry: (entry: RegistryEntry) => Promise<void>
  siteSheetIds: () => Set<string>
  now: () => Date
}

/** Lazily bound to the real repositories so importing this module does no I/O. */
export const defaultSyncDeps: SyncDeps = {
  sheets: googleSheetsSource,
  async replace(sheetId, rows) {
    const { scheduleRepo } = await import('../dynamodb')
    return scheduleRepo.replaceSheetSchedules(sheetId, rows as any)
  },
  async saveEntry(entry) {
    const { scheduleRegistryRepository } = await import('../dynamodb/repositories/schedule-registry-repository')
    await scheduleRegistryRepository.putEntry(entry)
  },
  siteSheetIds: envSpreadsheetIds,
  now: () => new Date(),
}

/**
 * The `sheetId` stamped on an entry's rows. Stable per entry (not per sheet),
 * so pointing the entry at a different sheet replaces the old rows instead of
 * leaving them behind.
 */
export function registrySheetId(entry: Pick<RegistryEntry, 'ecclesiaId' | 'scheduleId'>): string {
  return `registry:${entry.ecclesiaId}:${entry.scheduleId}`
}

/** "7:30 PM" / "19:30" / "7pm" → "19:30"; anything else → "09:00" (the default). */
export function normalizeTime(value: string | undefined): string {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?\s*$/i.exec(value ?? '')
  if (!m) return '09:00'
  let h = Number(m[1])
  const min = Number(m[2] ?? '0')
  const ap = m[3]?.toLowerCase()
  if (ap === 'p' && h < 12) h += 12
  if (ap === 'a' && h === 12) h = 0
  if (h > 23 || min > 59 || (!ap && m[2] === undefined)) return '09:00'
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Why an entry may not be synced into the database, or null when it may. */
export function refuseReason(entry: RegistryEntry, siteSheetIds: Set<string>): { code: string; error: string } | null {
  if (entry.source.kind !== 'google-sheets') return null
  if (!entry.source.spreadsheetId || !entry.source.tab) {
    return { code: 'INVALID_ENTRY', error: 'Choose a sheet and a tab first.' }
  }
  if (siteSheetIds.has(entry.source.spreadsheetId)) {
    return { code: 'SITE_SHEET', error: 'That sheet is part of the site configuration and cannot be connected.' }
  }
  if (!entry.ecclesia) return { code: 'INVALID_ENTRY', error: 'This schedule has no ecclesia name.' }
  if (HOME_ECCLESIA.isHomeEcclesia(entry.ecclesia)) {
    return { code: 'HOME_SITE_CONFIG', error: 'Toronto East schedules come from the site configuration.' }
  }
  return null
}

export async function syncEntry(
  entry: RegistryEntry,
  opts: { dryRun?: boolean } = {},
  deps: SyncDeps = defaultSyncDeps
): Promise<SyncOutcome> {
  if (entry.source.kind === 'env') return { status: 'skipped', reason: 'Site-configured schedules sync from the sheet webhook.' }
  if (entry.source.kind === 'native') return { status: 'skipped', reason: 'Entered in TEE Admin; nothing to read.' }

  const refused = refuseReason(entry, deps.siteSheetIds())
  if (refused) return { status: 'error', ...refused }

  let rows: ScheduleRowInput[]
  try {
    const connection = {
      ecclesiaId: entry.ecclesiaId,
      kind: 'google-sheets' as const,
      config: { spreadsheetId: entry.source.spreadsheetId! },
    }
    const raw = await deps.sheets.readRows(connection, { id: entry.source.tab!, name: entry.source.tab! })
    rows = toScheduleRows(entry, entry.ecclesia!)(raw).map((r) => ({ ...r, time: normalizeTime(r.time) }))
  } catch (error) {
    const code = error instanceof ScheduleSourceError ? error.code : 'READ_FAILED'
    const message = error instanceof Error ? error.message : 'Could not read the sheet.'
    if (!opts.dryRun) await recordSync(entry, { status: 'error', rows: 0, error: message }, deps)
    return { status: 'error', code, error: message }
  }

  if (opts.dryRun) return { status: 'preview', rows: rows.slice(0, PREVIEW_ROWS), total: rows.length }

  // Nothing mapped: write nothing. replaceSheetSchedules would no-op anyway, but
  // an empty read must never look like "the schedule was emptied".
  if (rows.length === 0) {
    await recordSync(entry, { status: 'error', rows: 0, error: 'No rows with a date were found.' }, deps)
    return { status: 'error', code: 'NO_ROWS', error: 'No rows with a date were found. Check the date column.' }
  }

  const result = await deps.replace(registrySheetId(entry), rows)
  const ok = result.failed === 0
  await recordSync(
    entry,
    ok ? { status: 'ok', rows: rows.length } : { status: 'error', rows: result.successful, error: result.errors[0] ?? 'Some rows failed.' },
    deps
  )
  return { status: 'ok', rows: rows.length, written: result.successful, failed: result.failed, errors: result.errors }
}

async function recordSync(entry: RegistryEntry, sync: Omit<LastSync, 'at'>, deps: SyncDeps): Promise<void> {
  if (entry.builtIn) return
  try {
    await deps.saveEntry({ ...entry, lastSync: { at: deps.now().toISOString(), ...sync } })
  } catch (error) {
    console.error('[schedule-sources] could not record last sync:', error)
  }
}
