/**
 * Google Sheets source (docs/ECCLESIA_SCHEDULES.md §Sources).
 *
 * First connection mode: the ecclesia shares its sheet with our service-account
 * address (read-only is enough). We read it with that service account, scope
 * `spreadsheets.readonly` — never write.
 *
 * A record of functions, built by `createGoogleSheetsSource(deps)` so tests can
 * hand in a fake Sheets client. Nothing runs on import.
 */
import type { Connection, ConnectInput, RawRow, ScheduleSource, TableRef } from './types'

export const SHEETS_READONLY_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

/** What the adapter needs from the Sheets API (a subset of googleapis' sheets_v4). */
export interface SheetsClient {
  spreadsheets: {
    get(params: { spreadsheetId: string; fields?: string }): Promise<{ data: any }>
    values: {
      get(params: { spreadsheetId: string; range: string; valueRenderOption?: string }): Promise<{ data: any }>
      batchGet(params: { spreadsheetId: string; ranges: string[]; valueRenderOption?: string }): Promise<{ data: any }>
    }
  }
}

export interface GoogleSheetsConfigShape {
  spreadsheetId: string
  title?: string
}

export type SourceErrorCode = 'NOT_SHARED' | 'NOT_FOUND' | 'NOT_CONFIGURED' | 'READ_FAILED' | 'UNSUPPORTED'

/** A source failure a route can turn into a plain answer. */
export class ScheduleSourceError extends Error {
  constructor(
    readonly code: SourceErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ScheduleSourceError'
  }
}

/** The service-account credentials from `GOOGLE_SERVICE_ACCOUNT_KEY`, or null. */
function serviceAccountCredentials(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.client_email !== 'string' || !parsed.client_email) return null
    return { client_email: parsed.client_email, private_key: String(parsed.private_key ?? '') }
  } catch {
    return null
  }
}

/** The address an ecclesia shares its sheet with, or null when not configured. */
export function serviceAccountEmail(): string | null {
  return serviceAccountCredentials()?.client_email ?? null
}

/** The real Sheets client: service-account JWT, read-only scope. Loaded lazily. */
export async function defaultSheetsClient(): Promise<SheetsClient> {
  const creds = serviceAccountCredentials()
  if (!creds) throw new ScheduleSourceError('NOT_CONFIGURED', 'The Google service account is not configured.')
  const { google } = await import('googleapis')
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: [SHEETS_READONLY_SCOPE],
  })
  return google.sheets({ version: 'v4', auth }) as unknown as SheetsClient
}

/**
 * The spreadsheet ID from a pasted link (`…/spreadsheets/d/<id>/edit…`) or a
 * bare ID. Null when it is neither.
 */
export function parseSpreadsheetId(input: string): string | null {
  const text = (input ?? '').trim()
  if (!text) return null
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{10,})/.exec(text)
  if (fromUrl) return fromUrl[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) return text
  return null
}

/** A1 range for a whole tab, quoting the title so spaces and quotes are safe. */
export function tabRange(tab: string, cells = 'A:Z'): string {
  return `'${tab.replace(/'/g, "''")}'!${cells}`
}

function httpStatus(error: any): number | undefined {
  const s = error?.code ?? error?.status ?? error?.response?.status
  return typeof s === 'number' ? s : undefined
}

function toSourceError(error: unknown, what: string): ScheduleSourceError {
  if (error instanceof ScheduleSourceError) return error
  const status = httpStatus(error)
  if (status === 403 || status === 401) {
    return new ScheduleSourceError('NOT_SHARED', 'This sheet has not been shared with us yet.')
  }
  if (status === 404) return new ScheduleSourceError('NOT_FOUND', 'We could not find a sheet at that link.')
  return new ScheduleSourceError('READ_FAILED', `Could not read ${what}.`)
}

const cellText = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())

/** Header row + data rows → rows keyed by header. Blank headers and blank rows are dropped. */
export function rowsFromValues(values: unknown[][]): RawRow[] {
  if (!Array.isArray(values) || values.length === 0) return []
  const headers = (values[0] ?? []).map(cellText)
  const out: RawRow[] = []
  for (const line of values.slice(1)) {
    if (!Array.isArray(line)) continue
    const row: RawRow = {}
    let filled = false
    headers.forEach((h, i) => {
      if (!h) return
      const v = cellText(line[i])
      if (v !== '') filled = true
      row[h] = v
    })
    if (filled) out.push(row)
  }
  return out
}

export interface GoogleSheetsSourceDeps {
  client: () => Promise<SheetsClient>
}

export function createGoogleSheetsSource(
  deps: GoogleSheetsSourceDeps = { client: defaultSheetsClient }
): ScheduleSource<GoogleSheetsConfigShape> {
  return {
    kind: 'google-sheets',

    /** Verifies we can open the sheet. NOT_SHARED when it is not shared with the service account. */
    async connect(ecclesiaId: string, input: ConnectInput): Promise<Connection<GoogleSheetsConfigShape>> {
      if (input.mode !== 'service-account-share') {
        throw new ScheduleSourceError('UNSUPPORTED', 'Only sharing with our service account is supported.')
      }
      const sheets = await deps.client()
      try {
        const res = await sheets.spreadsheets.get({ spreadsheetId: input.spreadsheetId, fields: 'properties.title' })
        return {
          ecclesiaId,
          kind: 'google-sheets',
          config: { spreadsheetId: input.spreadsheetId, title: res.data?.properties?.title ?? undefined },
        }
      } catch (error) {
        throw toSourceError(error, 'the sheet')
      }
    },

    /** Every tab, with its header row (first row). */
    async listTables(connection: Connection<GoogleSheetsConfigShape>): Promise<TableRef[]> {
      const { spreadsheetId } = connection.config
      const sheets = await deps.client()
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' })
        const titles: string[] = (meta.data?.sheets ?? [])
          .map((s: any) => s?.properties?.title)
          .filter((t: unknown): t is string => typeof t === 'string' && t !== '')
        if (titles.length === 0) return []
        const heads = await sheets.spreadsheets.values.batchGet({
          spreadsheetId,
          ranges: titles.map((t) => tabRange(t, '1:1')),
          valueRenderOption: 'FORMATTED_VALUE',
        })
        const ranges: any[] = heads.data?.valueRanges ?? []
        return titles.map((name, i) => ({
          id: name,
          name,
          headers: ((ranges[i]?.values?.[0] ?? []) as unknown[]).map(cellText).filter((h) => h !== ''),
        }))
      } catch (error) {
        throw toSourceError(error, 'the sheet tabs')
      }
    },

    /** The tab's rows keyed by header, as displayed in the sheet (dates as written). */
    async readRows(connection: Connection<GoogleSheetsConfigShape>, table: TableRef): Promise<RawRow[]> {
      const sheets = await deps.client()
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: connection.config.spreadsheetId,
          range: tabRange(table.name),
          valueRenderOption: 'FORMATTED_VALUE',
        })
        return rowsFromValues(res.data?.values ?? [])
      } catch (error) {
        throw toSourceError(error, 'the sheet rows')
      }
    },
  }
}

export const googleSheetsSource = createGoogleSheetsSource()
