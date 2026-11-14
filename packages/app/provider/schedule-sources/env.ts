/**
 * Site-configuration source (docs/ECCLESIA_SCHEDULES.md §Sources): Toronto
 * East's sheets, named by their `sheet_ids` key in `GOOGLE_SERVICE_ACCOUNT_KEY`.
 * The sheet ID is looked up here at read time and never leaves this module.
 *
 * Toronto East's rows are still written by the webhook
 * (`webhook-sync-service.ts`, unchanged): its transformer keeps every header and
 * the original cell types, which a catalogue mapping cannot reproduce byte for
 * byte. This source lets the setup page and future tools read those sheets
 * through the same interface; the nightly sync skips `env` entries.
 */
import { googleSheetsConfig } from '../../config/google-sheets'
import { rowsFromValues, ScheduleSourceError } from './google-sheets'
import type { Connection, RawRow, ScheduleSource, TableRef } from './types'

export interface EnvConfigShape {
  envKey: string
}

export interface EnvSourceDeps {
  /** Header row + rows of a site sheet (the existing GoogleSheetsService). */
  readSheet: (sheetId: string) => Promise<unknown[][]>
  /** `sheet_ids` key → sheet ID, or null. */
  sheetIdFor: (envKey: string) => string | null
}

const defaultDeps: EnvSourceDeps = {
  async readSheet(sheetId) {
    const { GoogleSheetsService } = await import('../sync/google-sheets-service')
    return new GoogleSheetsService().getSheetData(sheetId)
  },
  sheetIdFor(envKey) {
    try {
      return googleSheetsConfig.getSheetId(envKey) ?? null
    } catch {
      return null
    }
  },
}

/** A connection to one site-configured sheet. */
export function envConnection(ecclesiaId: string, envKey: string): Connection<EnvConfigShape> {
  return { ecclesiaId, kind: 'env', config: { envKey } }
}

export function createEnvSource(deps: EnvSourceDeps = defaultDeps): ScheduleSource<EnvConfigShape> {
  return {
    kind: 'env',

    /** Site sheets are configured, not connected. */
    async connect() {
      throw new ScheduleSourceError('UNSUPPORTED', 'Site-configured schedules are set in the site configuration.')
    },

    async listTables(connection) {
      const table: TableRef = { id: connection.config.envKey, name: connection.config.envKey }
      return deps.sheetIdFor(connection.config.envKey) ? [table] : []
    },

    async readRows(connection): Promise<RawRow[]> {
      const sheetId = deps.sheetIdFor(connection.config.envKey)
      if (!sheetId) throw new ScheduleSourceError('NOT_CONFIGURED', 'This schedule is not in the site configuration.')
      return rowsFromValues(await deps.readSheet(sheetId))
    },
  }
}

export const envSource = createEnvSource()
