/**
 * Golden test: Toronto East's webhook path (docs/ECCLESIA_SCHEDULES.md §Registry,
 * "The webhook … stay[s] byte-identical"; plan "Regression proofs — PR2").
 *
 * The plan allowed routing the webhook through `envSource → toScheduleRows`
 * only if that produced deep-equal batchWrite items. It does not — the second
 * describe below shows why — so `webhook-sync-service.ts` is UNCHANGED and still
 * uses `SheetTransformer`. This file pins that path's exact output (PK/SK/GSI1,
 * data with raw headers and cell types, dateTime, YouTube preservation) so any
 * later refactor has to reproduce it.
 *
 * Mocked DynamoDB client; placeholder sheet IDs and names; fixed clock.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'

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

const SITE_FIXTURE = {
  type: 'service_account',
  client_email: 'sa@example.iam.gserviceaccount.com',
  sheet_ids: {
    memorial: { name: 'Memorial', startTime: '11:00', key: 'placeholder-memorial-sheet' },
  },
}

/** Sheet values as the webhook's GoogleSheetsService returns them (UNFORMATTED_VALUE: numbers stay numbers). */
const SHEET_VALUES: any[][] = [
  ['Date', 'Preside', 'Exhort', 'Hymn-opening', 'YouTube', 'Notes'],
  ['1/6/2030', 'Ann Example', 'Bo Example', 123, '', 'Fellowship lunch'],
  ['1/13/2030', 'Cy Example', 'Di Example', 45, '', ''],
]

const savedEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
beforeAll(() => {
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify(SITE_FIXTURE)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2030-01-01T12:00:00.000Z'))
})
afterAll(() => {
  vi.useRealTimers()
  if (savedEnv === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  else process.env.GOOGLE_SERVICE_ACCOUNT_KEY = savedEnv
})

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockImplementation(async (c: any) => {
    if (c.type === 'QueryCommand') {
      // An existing row whose YouTube link was added by the YouTube sync.
      return {
        Items: [
          {
            PK: 'SCHEDULE#MEMORIAL',
            SK: `DATE#${new Date('2030-01-06').toISOString()}#0`,
            sheetId: 'placeholder-memorial-sheet',
            data: { YouTube: 'https://example.org/watch/placeholder' },
          },
        ],
      }
    }
    return {}
  })
})

async function legacyBatchItems() {
  const { SheetTransformer } = await import('@my/app/provider/sync/sheet-transformer')
  const { ScheduleRepository } = await import('@my/app/provider/dynamodb/repositories/schedule-repository')
  const records = new SheetTransformer().transformScheduleData(SHEET_VALUES, 'placeholder-memorial-sheet')
  await new ScheduleRepository().replaceSheetSchedules('placeholder-memorial-sheet', records)
  const batch = mockSend.mock.calls.find((c) => c[0].type === 'BatchWriteCommand')![0].params
  return (Object.values(batch.RequestItems)[0] as any[]).map((r) => r.PutRequest.Item)
}

describe("Toronto East's webhook path is pinned (ECSCHED-01)", () => {
  it('ECSCHED-01: SheetTransformer + replaceSheetSchedules write exactly these items to SCHEDULE#MEMORIAL', async () => {
    const items = await legacyBatchItems()
    expect(items).toMatchInlineSnapshot(`
      [
        {
          "GSI1PK": "ECCLESIA#Toronto East Ecclesia",
          "GSI1SK": "2030-01-06#memorial#09:00",
          "PK": "SCHEDULE#MEMORIAL",
          "SK": "DATE#2030-01-06T00:00:00.000Z#0",
          "data": {
            "Date": "1/6/2030",
            "Exhort": "Bo Example",
            "Hymn-opening": 123,
            "Notes": "Fellowship lunch",
            "Preside": "Ann Example",
            "YouTube": "https://example.org/watch/placeholder",
          },
          "date": "2030-01-06",
          "dateTime": "2030-01-06T16:00:00.000Z",
          "ecclesia": "Toronto East Ecclesia",
          "lastUpdated": "2030-01-01T12:00:00.000Z",
          "sheetId": "placeholder-memorial-sheet",
          "sheetType": "memorial",
          "sourceTimezone": "America/Toronto",
          "type": "memorial",
          "version": "2",
        },
        {
          "GSI1PK": "ECCLESIA#Toronto East Ecclesia",
          "GSI1SK": "2030-01-13#memorial#09:00",
          "PK": "SCHEDULE#MEMORIAL",
          "SK": "DATE#2030-01-13T00:00:00.000Z#1",
          "data": {
            "Date": "1/13/2030",
            "Exhort": "Di Example",
            "Hymn-opening": 45,
            "Preside": "Cy Example",
          },
          "date": "2030-01-13",
          "dateTime": "2030-01-13T16:00:00.000Z",
          "ecclesia": "Toronto East Ecclesia",
          "lastUpdated": "2030-01-01T12:00:00.000Z",
          "sheetId": "placeholder-memorial-sheet",
          "sheetType": "memorial",
          "sourceTimezone": "America/Toronto",
          "type": "memorial",
          "version": "2",
        },
      ]
    `)
  })
})

describe('why the webhook is not routed through envSource → toScheduleRows (ECSCHED-01)', () => {
  it('ECSCHED-01: the catalogue mapping cannot reproduce the webhook rows byte for byte', async () => {
    const { builtInScheduleEntries } = await import('@my/app/provider/schedule-sources/registry')
    const { toScheduleRows } = await import('@my/app/provider/schedule-sources/mapping')
    const { createEnvSource, envConnection } = await import('@my/app/provider/schedule-sources/env')
    const { SheetTransformer } = await import('@my/app/provider/sync/sheet-transformer')

    const memorial = builtInScheduleEntries().find((e) => e.kind === 'memorial')!
    const env = createEnvSource({ readSheet: async () => SHEET_VALUES, sheetIdFor: () => 'placeholder-memorial-sheet' })
    const raw = await env.readRows(envConnection(memorial.ecclesiaId, 'memorial'), { id: 'memorial', name: 'memorial' })
    const mapped = toScheduleRows(memorial, 'Toronto East Ecclesia')(raw)
    const legacy = new SheetTransformer().transformScheduleData(SHEET_VALUES, 'placeholder-memorial-sheet')

    expect(mapped).not.toEqual(legacy)
    // Unmapped columns (Notes) are dropped by the mapping; the webhook keeps every header.
    expect(legacy[0].scheduleData).toHaveProperty('Notes')
    expect(mapped[0].scheduleData).not.toHaveProperty('Notes')
    // Cell types: the webhook keeps numbers as numbers; the mapping stores strings.
    expect(legacy[0].scheduleData['Hymn-opening']).toBe(123)
    expect(mapped[0].scheduleData['Hymn-opening']).toBe('123')
    // Service time: the webhook stamps dateTime/sourceTimezone; the mapping does not.
    expect(legacy[0].dateTime).toBeTruthy()
    expect(mapped[0]).not.toHaveProperty('dateTime')
  })
})
