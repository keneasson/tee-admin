/**
 * Sync of one registry entry (docs/ECCLESIA_SCHEDULES.md §Sources; behaviour
 * docs/behavior/ecclesia-schedules.md). Fake source + mocked DynamoDB client.
 * Placeholder names and sheet IDs only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => {
  const cmd = (type: string) => vi.fn().mockImplementation((params) => ({ type, params }))
  return {
    DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
    QueryCommand: cmd('QueryCommand'),
    PutCommand: cmd('PutCommand'),
    GetCommand: cmd('GetCommand'),
    UpdateCommand: cmd('UpdateCommand'),
    DeleteCommand: cmd('DeleteCommand'),
    ScanCommand: cmd('ScanCommand'),
    BatchWriteCommand: cmd('BatchWriteCommand'),
    BatchGetCommand: cmd('BatchGetCommand'),
  }
})
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import { normalizeTime, registrySheetId, syncEntry, type SyncDeps } from '@my/app/provider/schedule-sources/sync'
import { ScheduleSourceError } from '@my/app/provider/schedule-sources/google-sheets'
import { ScheduleRepository } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import type { RegistryEntry } from '@my/app/provider/schedule-sources/types'

const OTHER = 'Example Ecclesia'
const SHEET = 'placeholderSheetId_0123456789abcdef'

const entry = (over: Partial<RegistryEntry> = {}): RegistryEntry => ({
  ecclesiaId: 'example-ecclesia',
  ecclesia: OTHER,
  scheduleId: 'bibleClass',
  name: 'Bible Class',
  kind: 'bibleClass',
  active: true,
  source: { kind: 'google-sheets', spreadsheetId: SHEET, tab: 'Classes' },
  mapping: {
    dateColumn: 'When',
    timeColumn: 'Start',
    fields: [
      { column: 'Who', key: 'Speaker', label: 'Speaker', rosterRole: true },
      { column: 'Subject', key: 'Topic', label: 'Topic', rosterRole: false },
    ],
  },
  ...over,
})

const RAW = [
  { When: '2030-01-08', Start: '7:30 PM', Who: 'Ann Example', Subject: 'Genesis 1', Notes: 'unmapped' },
  { When: '', Start: '', Who: 'No date', Subject: '' },
  { When: '2030-01-15', Start: '', Who: 'Bo Example', Subject: '' },
]

function deps(over: Partial<SyncDeps> = {}): SyncDeps & { replace: any; saveEntry: any; readRows: any } {
  const readRows = vi.fn(async () => RAW)
  const d = {
    sheets: { kind: 'google-sheets', connect: vi.fn(), listTables: vi.fn(), readRows } as any,
    replace: vi.fn(async (_id: string, rows: any[]) => ({ successful: rows.length, failed: 0, errors: [] })),
    saveEntry: vi.fn(async () => {}),
    siteSheetIds: () => new Set(['placeholder-memorial-sheet']),
    now: () => new Date('2030-01-01T05:00:00.000Z'),
    readRows,
    ...over,
  }
  return d as any
}

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockImplementation(async (c: any) => (c.type === 'QueryCommand' ? { Items: [] } : {}))
})

describe('syncEntry', () => {
  it('ECSCHED-06: maps rows to catalogue keys and writes them with a stable per-entry sheetId', async () => {
    const d = deps()
    const out = await syncEntry(entry(), {}, d)
    expect(out).toEqual({ status: 'ok', rows: 2, written: 2, failed: 0, errors: [] })
    expect(d.readRows.mock.calls[0][1]).toEqual({ id: 'Classes', name: 'Classes' })
    const [sheetId, rows] = d.replace.mock.calls[0]
    expect(sheetId).toBe('registry:example-ecclesia:bibleClass')
    expect(rows).toEqual([
      {
        ecclesia: OTHER,
        date: '2030-01-08',
        type: 'bibleClass',
        time: '19:30',
        scheduleData: { Date: '2030-01-08', Speaker: 'Ann Example', Topic: 'Genesis 1' },
      },
      { ecclesia: OTHER, date: '2030-01-15', type: 'bibleClass', time: '09:00', scheduleData: { Date: '2030-01-15', Speaker: 'Bo Example' } },
    ])
    expect(d.saveEntry.mock.calls[0][0].lastSync).toEqual({ at: '2030-01-01T05:00:00.000Z', status: 'ok', rows: 2 })
  })

  it("ECSCHED-07: other ecclesias' rows carry no dateTime/sourceTimezone (Toronto East's service times are never stamped on them)", async () => {
    const d = deps()
    await syncEntry(entry(), {}, d)
    for (const r of d.replace.mock.calls[0][1]) {
      expect(r).not.toHaveProperty('dateTime')
      expect(r).not.toHaveProperty('sourceTimezone')
    }
  })

  it('ECSCHED-08: dry run returns the first 5 mapped rows and writes NOTHING (no rows, no lastSync)', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ When: `2030-02-0${i + 1}`, Who: 'Ann Example' }))
    const d = deps({ sheets: { kind: 'google-sheets', readRows: vi.fn(async () => many) } as any })
    const out = await syncEntry(entry(), { dryRun: true }, d)
    expect(out.status).toBe('preview')
    expect(out.status === 'preview' ? [out.rows.length, out.total] : null).toEqual([5, 8])
    expect(d.replace).not.toHaveBeenCalled()
    expect(d.saveEntry).not.toHaveBeenCalled()
  })

  it("ECSCHED-09: refuses a sheet from Toronto East's site configuration — reads and writes nothing", async () => {
    const d = deps()
    const out = await syncEntry(entry({ source: { kind: 'google-sheets', spreadsheetId: 'placeholder-memorial-sheet', tab: 'T' } }), {}, d)
    expect(out).toMatchObject({ status: 'error', code: 'SITE_SHEET' })
    expect(d.readRows).not.toHaveBeenCalled()
    expect(d.replace).not.toHaveBeenCalled()
  })

  it('ECSCHED-10: site-configured (env) and native entries are skipped; the home ecclesia never syncs a connected sheet', async () => {
    const d = deps()
    expect((await syncEntry(entry({ source: { kind: 'env', envKey: 'memorial' }, builtIn: true }), {}, d)).status).toBe('skipped')
    expect((await syncEntry(entry({ source: { kind: 'native' } }), {}, d)).status).toBe('skipped')
    expect(await syncEntry(entry({ ecclesia: 'Toronto East Ecclesia' }), {}, d)).toMatchObject({ status: 'error', code: 'HOME_SITE_CONFIG' })
    expect(d.readRows).not.toHaveBeenCalled()
    expect(d.replace).not.toHaveBeenCalled()
  })

  it('ECSCHED-04: a sheet no longer shared → NOT_SHARED, nothing written, lastSync records the error', async () => {
    const d = deps({
      sheets: { kind: 'google-sheets', readRows: vi.fn(async () => Promise.reject(new ScheduleSourceError('NOT_SHARED', 'not shared'))) } as any,
    })
    const out = await syncEntry(entry(), {}, d)
    expect(out).toMatchObject({ status: 'error', code: 'NOT_SHARED' })
    expect(d.replace).not.toHaveBeenCalled()
    expect(d.saveEntry.mock.calls[0][0].lastSync).toMatchObject({ status: 'error', rows: 0 })
  })

  it('ECSCHED-11: a read with no dated rows writes nothing (an empty read never empties the schedule)', async () => {
    const d = deps({ sheets: { kind: 'google-sheets', readRows: vi.fn(async () => [{ When: 'soon', Who: 'Ann Example' }]) } as any })
    expect(await syncEntry(entry(), {}, d)).toMatchObject({ status: 'error', code: 'NO_ROWS' })
    expect(d.replace).not.toHaveBeenCalled()
  })

  it("ECSCHED-12: the real repository writes the rows into the ecclesia's OWN partition, never SCHEDULE#<TYPE>", async () => {
    const repo = new ScheduleRepository()
    const d = deps({ replace: (id, rows) => repo.replaceSheetSchedules(id, rows as any) })
    await syncEntry(entry(), {}, d)
    const query = mockSend.mock.calls.find((c) => c[0].type === 'QueryCommand')![0].params
    expect(query.ExpressionAttributeValues[':pk'] ?? JSON.stringify(query)).toContain('SCHEDULE#example-ecclesia#bibleClass')
    const batch = mockSend.mock.calls.find((c) => c[0].type === 'BatchWriteCommand')![0].params
    const items = Object.values(batch.RequestItems)[0] as any[]
    expect(items.map((i) => i.PutRequest.Item.PK)).toEqual(['SCHEDULE#example-ecclesia#bibleClass', 'SCHEDULE#example-ecclesia#bibleClass'])
    expect(items[0].PutRequest.Item).toMatchObject({ GSI1PK: `ECCLESIA#${OTHER}`, GSI1SK: '2030-01-08#bibleClass#19:30', sheetId: registrySheetId(entry()) })
    for (const c of mockSend.mock.calls) expect(JSON.stringify(c[0].params)).not.toContain('"SCHEDULE#BIBLECLASS"')
  })
})

describe('normalizeTime', () => {
  it('reads common time formats; anything else is the 09:00 default', () => {
    expect(normalizeTime('7:30 PM')).toBe('19:30')
    expect(normalizeTime('7pm')).toBe('19:00')
    expect(normalizeTime('12:15 am')).toBe('00:15')
    expect(normalizeTime('19:30')).toBe('19:30')
    expect(normalizeTime('11:00')).toBe('11:00')
    expect(normalizeTime('7')).toBe('09:00')
    expect(normalizeTime('evening')).toBe('09:00')
    expect(normalizeTime(undefined)).toBe('09:00')
  })
})
