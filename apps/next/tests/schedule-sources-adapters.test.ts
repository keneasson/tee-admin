/**
 * Schedule source adapters (docs/ECCLESIA_SCHEDULES.md §Sources; behaviour
 * docs/behavior/ecclesia-schedules.md). Fake Sheets client only — nothing here
 * reaches Google. Placeholder sheet IDs and names.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createGoogleSheetsSource,
  parseSpreadsheetId,
  rowsFromValues,
  SHEETS_READONLY_SCOPE,
  ScheduleSourceError,
  serviceAccountEmail,
  tabRange,
  type SheetsClient,
} from '@my/app/provider/schedule-sources/google-sheets'
import { createEnvSource, envConnection } from '@my/app/provider/schedule-sources/env'
import { nativeSource } from '@my/app/provider/schedule-sources/native'

const SHEET = 'placeholderSheetId_0123456789abcdef'

function fakeClient(over: Partial<{ get: any; valuesGet: any; batchGet: any }> = {}): SheetsClient {
  return {
    spreadsheets: {
      get: over.get ?? vi.fn(async () => ({ data: { properties: { title: 'Example schedule' } } })),
      values: {
        get: over.valuesGet ?? vi.fn(async () => ({ data: { values: [] } })),
        batchGet: over.batchGet ?? vi.fn(async () => ({ data: { valueRanges: [] } })),
      },
    },
  }
}

describe('parseSpreadsheetId', () => {
  it('ECSCHED-02: takes the ID from a pasted link or a bare ID; rejects anything else', () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${SHEET}/edit#gid=0`)).toBe(SHEET)
    expect(parseSpreadsheetId(`  ${SHEET}  `)).toBe(SHEET)
    expect(parseSpreadsheetId('https://example.org/not-a-sheet')).toBeNull()
    expect(parseSpreadsheetId('')).toBeNull()
  })

  it('quotes tab names in A1 ranges', () => {
    expect(tabRange("Ann's tab")).toBe("'Ann''s tab'!A:Z")
    expect(tabRange('Memorial', '1:1')).toBe("'Memorial'!1:1")
  })
})

describe('googleSheetsSource', () => {
  it('reads with the read-only scope only', () => {
    expect(SHEETS_READONLY_SCOPE).toBe('https://www.googleapis.com/auth/spreadsheets.readonly')
  })

  it('ECSCHED-03: connect verifies access and returns the sheet title', async () => {
    const client = fakeClient()
    const src = createGoogleSheetsSource({ client: async () => client })
    const c = await src.connect('example-ecclesia', { mode: 'service-account-share', spreadsheetId: SHEET })
    expect(c).toEqual({ ecclesiaId: 'example-ecclesia', kind: 'google-sheets', config: { spreadsheetId: SHEET, title: 'Example schedule' } })
  })

  it('ECSCHED-04: a sheet not shared with us (403) → NOT_SHARED; 404 → NOT_FOUND', async () => {
    const denied = createGoogleSheetsSource({
      client: async () => fakeClient({ get: vi.fn(async () => Promise.reject(Object.assign(new Error('denied'), { code: 403 }))) }),
    })
    await expect(denied.connect('e', { mode: 'service-account-share', spreadsheetId: SHEET })).rejects.toMatchObject({
      code: 'NOT_SHARED',
    })
    const missing = createGoogleSheetsSource({
      client: async () => fakeClient({ get: vi.fn(async () => Promise.reject(Object.assign(new Error('gone'), { code: 404 }))) }),
    })
    const err = await missing.connect('e', { mode: 'service-account-share', spreadsheetId: SHEET }).catch((e) => e)
    expect(err).toBeInstanceOf(ScheduleSourceError)
    expect(err.code).toBe('NOT_FOUND')
  })

  it('ECSCHED-05: listTables returns every tab with its header row', async () => {
    const batchGet = vi.fn(async (_p: any) => ({
      data: { valueRanges: [{ values: [['Date', 'Speaker', '', 'Topic']] }, { values: [] }] },
    }))
    const client = fakeClient({
      get: vi.fn(async () => ({ data: { sheets: [{ properties: { title: 'Bible Class' } }, { properties: { title: 'Notes' } }] } })),
      batchGet,
    })
    const src = createGoogleSheetsSource({ client: async () => client })
    const tabs = await src.listTables({ ecclesiaId: 'e', kind: 'google-sheets', config: { spreadsheetId: SHEET } })
    expect(tabs).toEqual([
      { id: 'Bible Class', name: 'Bible Class', headers: ['Date', 'Speaker', 'Topic'] },
      { id: 'Notes', name: 'Notes', headers: [] },
    ])
    expect(batchGet.mock.calls[0][0]).toMatchObject({ spreadsheetId: SHEET, ranges: ["'Bible Class'!1:1", "'Notes'!1:1"] })
  })

  it('readRows keys rows by header and drops blank rows', async () => {
    const valuesGet = vi.fn(async (_p: any) => ({
      data: { values: [['Date', 'Speaker'], ['2030-01-05', ' Ann Example '], [], ['', ''], ['2030-01-12']] },
    }))
    const src = createGoogleSheetsSource({ client: async () => fakeClient({ valuesGet }) })
    const rows = await src.readRows({ ecclesiaId: 'e', kind: 'google-sheets', config: { spreadsheetId: SHEET } }, { id: 'T', name: 'T' })
    expect(rows).toEqual([
      { Date: '2030-01-05', Speaker: 'Ann Example' },
      { Date: '2030-01-12', Speaker: '' },
    ])
    expect(valuesGet.mock.calls[0][0]).toMatchObject({ range: "'T'!A:Z", valueRenderOption: 'FORMATTED_VALUE' })
  })

  it('rowsFromValues of nothing is []', () => {
    expect(rowsFromValues([])).toEqual([])
  })

  it('serviceAccountEmail comes from the configured service account; null without it', () => {
    const saved = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({ client_email: 'sa@example.iam.gserviceaccount.com', sheet_ids: {} })
    expect(serviceAccountEmail()).toBe('sa@example.iam.gserviceaccount.com')
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    expect(serviceAccountEmail()).toBeNull()
    if (saved !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_KEY = saved
  })
})

describe('envSource and nativeSource', () => {
  it('envSource reads a site sheet by its sheet_ids key; the ID never leaves the source', async () => {
    const readSheet = vi.fn(async () => [['Date', 'Exhort'], ['2030-01-06', 'Ann Example']])
    const src = createEnvSource({ readSheet, sheetIdFor: (k) => (k === 'memorial' ? 'placeholder-memorial-sheet' : null) })
    const conn = envConnection('toronto-east', 'memorial')
    expect(await src.listTables(conn)).toEqual([{ id: 'memorial', name: 'memorial' }])
    expect(await src.readRows(conn, { id: 'memorial', name: 'memorial' })).toEqual([{ Date: '2030-01-06', Exhort: 'Ann Example' }])
    expect(readSheet).toHaveBeenCalledWith('placeholder-memorial-sheet')
    await expect(src.connect('x', { mode: 'service-account-share', spreadsheetId: SHEET })).rejects.toMatchObject({ code: 'UNSUPPORTED' })
    await expect(src.readRows(envConnection('t', 'cyc'), { id: 'cyc', name: 'cyc' })).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })

  it('nativeSource has nothing to read', async () => {
    const c = await nativeSource.connect('e', { mode: 'service-account-share', spreadsheetId: SHEET })
    expect(await nativeSource.listTables(c)).toEqual([])
    expect(await nativeSource.readRows(c, { id: 'x', name: 'x' })).toEqual([])
  })
})
