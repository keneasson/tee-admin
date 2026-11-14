/**
 * Each ecclesia's schedule rows get their own partition (docs/ECCLESIA_SCHEDULES.md
 * §Storage). Before this, every ecclesia wrote into `SCHEDULE#<TYPE>`, so another
 * ecclesia's manual row on the same date overwrote Toronto East's.
 *
 * Mocked DynamoDB client only. Placeholder ecclesia names.
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

import {
  ScheduleRepository,
  scheduleEcclesiaId,
  schedulePartitionFor,
} from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'

const HOME = 'Toronto East Ecclesia'
const OTHER = 'Example Ecclesia'

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockResolvedValue({})
})

describe('schedulePartitionFor', () => {
  it('home ecclesia (any spelling) keeps the legacy SCHEDULE#<TYPE> partition', () => {
    expect(schedulePartitionFor(HOME, 'memorial')).toBe('SCHEDULE#MEMORIAL')
    expect(schedulePartitionFor('Toronto East', 'bibleClass')).toBe('SCHEDULE#BIBLECLASS')
    expect(schedulePartitionFor('TEE', 'cyc')).toBe('SCHEDULE#CYC')
  })

  it('every other ecclesia gets SCHEDULE#<ecclesiaId>#<kind>', () => {
    expect(schedulePartitionFor(OTHER, 'memorial')).toBe('SCHEDULE#example-ecclesia#memorial')
    expect(schedulePartitionFor(OTHER, 'bibleClass')).toBe('SCHEDULE#example-ecclesia#bibleClass')
    expect(schedulePartitionFor(OTHER, 'memorial')).not.toBe(schedulePartitionFor(HOME, 'memorial'))
  })

  it('the ecclesia id is the slug of the home-normalized name', () => {
    expect(scheduleEcclesiaId(OTHER)).toBe('example-ecclesia')
    expect(scheduleEcclesiaId('TEE')).toBe(scheduleEcclesiaId(HOME))
  })
})

describe('ScheduleRepository writers go through schedulePartitionFor', () => {
  const repo = new ScheduleRepository()

  it('createScheduleRecord: other ecclesia → its own partition; home → legacy', async () => {
    const other = await repo.createScheduleRecord('manual-x', OTHER, 'memorial', '2026-11-15', { Exhort: 'Ann Example' } as any)
    expect(other.PK).toBe('SCHEDULE#example-ecclesia#memorial')
    expect(mockSend.mock.calls[0][0].params.Item.PK).toBe('SCHEDULE#example-ecclesia#memorial')
    expect(mockSend.mock.calls[0][0].params.Item.GSI1PK).toBe(`ECCLESIA#${OTHER}`)

    const home = await repo.createScheduleRecord('manual-h', HOME, 'memorial', '2026-11-15', {} as any)
    expect(home.PK).toBe('SCHEDULE#MEMORIAL')
    expect(home.SK).toBe(other.SK)
  })

  it('deleteScheduleEvent: other ecclesia never deletes from the legacy partition', async () => {
    await repo.deleteScheduleEvent('2026-11-15', OTHER, 'memorial')
    expect(mockSend.mock.calls[0][0].params.Key).toEqual({
      PK: 'SCHEDULE#example-ecclesia#memorial',
      SK: `DATE#${new Date('2026-11-15').toISOString()}#0`,
    })
  })

  it('replaceSheetSchedules: other ecclesia reads and writes only its own partition', async () => {
    mockSend.mockImplementation(async (c: any) => (c.type === 'QueryCommand' ? { Items: [] } : {}))
    await repo.replaceSheetSchedules('sheet-x', [
      { ecclesia: OTHER, date: '2026-11-15', type: 'memorial', scheduleData: {} as any },
    ])
    const query = mockSend.mock.calls.find((c) => c[0].type === 'QueryCommand')![0].params
    expect(query.ExpressionAttributeValues[':apPk']).toBe('SCHEDULE#example-ecclesia#memorial')
    const batch = mockSend.mock.calls.find((c) => c[0].type === 'BatchWriteCommand')![0].params
    const pks = batch.RequestItems['tee-schedules'].map((r: any) => r.PutRequest.Item.PK)
    expect(pks).toEqual(['SCHEDULE#example-ecclesia#memorial'])
  })

  it('replaceSheetSchedules: home query is unchanged (legacy type partition + sheetId filter)', async () => {
    mockSend.mockImplementation(async (c: any) => (c.type === 'QueryCommand' ? { Items: [] } : {}))
    await repo.replaceSheetSchedules('sheet-h', [
      { ecclesia: HOME, date: '2026-11-15', type: 'memorial', scheduleData: {} as any },
    ])
    const query = mockSend.mock.calls.find((c) => c[0].type === 'QueryCommand')![0].params
    expect(query).toMatchObject({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :apPk',
      FilterExpression: 'sheetId = :sheetId',
      ExpressionAttributeValues: { ':apPk': 'SCHEDULE#MEMORIAL', ':sheetId': 'sheet-h' },
    })
    expect(query.IndexName).toBeUndefined()
  })

  it('replaceSheetSchedules refuses rows of mixed ecclesias (writes nothing)', async () => {
    const result = await repo.replaceSheetSchedules('sheet-x', [
      { ecclesia: HOME, date: '2026-11-15', type: 'memorial', scheduleData: {} as any },
      { ecclesia: OTHER, date: '2026-11-22', type: 'memorial', scheduleData: {} as any },
    ])
    expect(result.successful).toBe(0)
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('ScheduleService.getScheduleData (newsletter read path) is unchanged', () => {
  it('Queries the legacy SCHEDULE#<TYPE> partition with the same input', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] })
    await new ScheduleService().getScheduleData('memorial')
    expect(mockSend.mock.calls[0][0].type).toBe('QueryCommand')
    expect(mockSend.mock.calls[0][0].params).toEqual({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'SCHEDULE#MEMORIAL' },
      ScanIndexForward: true,
    })
  })
})
