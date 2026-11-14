/**
 * The schedule registry read + repository (docs/ECCLESIA_SCHEDULES.md §Registry,
 * §Data). Mocked client; placeholder sheet IDs and names only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

const HOME = 'Toronto East Ecclesia'
const OTHER = 'Example Ecclesia'

/** Placeholder site configuration: memorial, bibleClass and cyc configured, plus a non-schedule sheet. */
const SITE_FIXTURE = {
  type: 'service_account',
  sheet_ids: {
    memorial: { name: 'Memorial', startTime: '11:00', key: 'placeholder-memorial-sheet' },
    bibleClass: { name: 'Bible Class', startTime: '19:30', key: 'placeholder-bibleclass-sheet' },
    cyc: { name: 'CYC', startTime: '19:00', key: 'placeholder-cyc-sheet' },
    directory: { name: 'Directory', key: 'placeholder-directory-sheet' },
  },
}

const savedEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY

async function loadRegistry() {
  vi.resetModules()
  return import('@my/app/provider/schedule-sources/registry')
}

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockImplementation(async (c: any) => (c.type === 'QueryCommand' ? { Items: [] } : {}))
})
afterEach(() => {
  if (savedEnv === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  else process.env.GOOGLE_SERVICE_ACCOUNT_KEY = savedEnv
})

describe('getScheduleRegistry without the site env', () => {
  it('imports without throwing and without any I/O; other ecclesia with nothing stored → []', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    const { getScheduleRegistry } = await loadRegistry()
    expect(mockSend).not.toHaveBeenCalled()
    await expect(getScheduleRegistry(OTHER)).resolves.toEqual([])
    const q = mockSend.mock.calls[0][0]
    expect(q.type).toBe('QueryCommand')
    expect(q.params).toMatchObject({
      TableName: 'tee-admin',
      KeyConditionExpression: 'pkey = :apPk AND begins_with(skey, :apSk)',
      ExpressionAttributeValues: { ':apPk': 'ECCLESIA_SCHEDULES#example-ecclesia', ':apSk': 'SCHEDULE#' },
    })
  })

  it('home ecclesia has no built-ins when the env is missing, and does not throw', async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    const { getScheduleRegistry } = await loadRegistry()
    await expect(getScheduleRegistry(HOME)).resolves.toEqual([])
  })

  it('an empty ecclesia name reads nothing', async () => {
    const { getScheduleRegistry } = await loadRegistry()
    await expect(getScheduleRegistry('')).resolves.toEqual([])
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('home ecclesia built-in entries (no database write)', () => {
  it('equal the placeholder sheet_ids fixture: source env, roster roles per plan, no sheet IDs', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify(SITE_FIXTURE)
    const { getScheduleRegistry } = await loadRegistry()
    const entries = await getScheduleRegistry(HOME)

    expect(entries.map((e) => e.kind)).toEqual(['memorial', 'bibleClass', 'cyc'])
    for (const e of entries) {
      expect(e).toMatchObject({
        ecclesiaId: 'toronto-east-ecclesia',
        scheduleId: e.kind,
        active: true,
        builtIn: true,
        source: { kind: 'env', envKey: e.kind },
        mapping: { dateColumn: 'Date' },
      })
    }
    const roster = Object.fromEntries(
      entries.map((e) => [e.kind, e.mapping.fields.filter((f) => f.rosterRole).map((f) => f.key)])
    )
    expect(roster).toEqual({
      memorial: ['Exhort', 'Preside', 'Reading1', 'Reading2'],
      bibleClass: ['Presider', 'Speaker'],
      cyc: ['speaker'],
    })
    expect(JSON.stringify(entries)).not.toContain('placeholder-')
    expect(mockSend.mock.calls.every((c) => c[0].type === 'QueryCommand')).toBe(true)
  })

  it('a stored entry for a kind replaces only that kind’s built-in', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify(SITE_FIXTURE)
    mockSend.mockImplementation(async () => ({
      Items: [
        {
          pkey: 'ECCLESIA_SCHEDULES#toronto-east-ecclesia',
          skey: 'SCHEDULE#memorial',
          gsi4pk: 'SCHEDULE_SOURCES',
          gsi4sk: 'toronto-east-ecclesia#memorial',
          ecclesiaId: 'toronto-east-ecclesia',
          scheduleId: 'memorial',
          name: 'Memorial Service',
          kind: 'memorial',
          active: true,
          source: { kind: 'env', envKey: 'memorial' },
          mapping: { dateColumn: 'Date', fields: [{ column: 'Exhort', key: 'Exhort', label: 'Exhort', rosterRole: true }] },
        },
      ],
    }))
    const { getScheduleRegistry } = await loadRegistry()
    const entries = await getScheduleRegistry(HOME)
    expect(entries.map((e) => [e.kind, e.builtIn === true])).toEqual([
      ['memorial', false],
      ['bibleClass', true],
      ['cyc', true],
    ])
    expect(entries[0]).not.toHaveProperty('pkey')
    expect(entries[0]).not.toHaveProperty('gsi4pk')
  })

  it('a non-home ecclesia never gets built-ins, even with the site env set', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify(SITE_FIXTURE)
    const { getScheduleRegistry, envSpreadsheetIds } = await loadRegistry()
    await expect(getScheduleRegistry(OTHER)).resolves.toEqual([])
    expect([...envSpreadsheetIds()].sort()).toEqual([
      'placeholder-bibleclass-sheet',
      'placeholder-cyc-sheet',
      'placeholder-directory-sheet',
      'placeholder-memorial-sheet',
    ])
  })
})

describe('ScheduleRegistryRepository', () => {
  it('stores an entry under ECCLESIA_SCHEDULES#/SCHEDULE# with the SCHEDULE_SOURCES gsi4 entry', async () => {
    const { ScheduleRegistryRepository } = await import(
      '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
    )
    const repo = new ScheduleRegistryRepository()
    await repo.putEntry({
      ecclesiaId: 'example-ecclesia',
      scheduleId: 'cyc',
      name: 'CYC',
      kind: 'cyc',
      active: true,
      source: { kind: 'google-sheets', spreadsheetId: 'placeholder-sheet', tab: 'Rota' },
      mapping: { dateColumn: 'Date', fields: [] },
    })
    expect(mockSend.mock.calls[0][0].params.Item).toMatchObject({
      pkey: 'ECCLESIA_SCHEDULES#example-ecclesia',
      skey: 'SCHEDULE#cyc',
      gsi4pk: 'SCHEDULE_SOURCES',
      gsi4sk: 'example-ecclesia#cyc',
    })
    await expect(
      repo.putEntry({ builtIn: true } as any)
    ).rejects.toThrow(/never stored/)

    mockSend.mockClear()
    await repo.listAllEntries()
    expect(mockSend.mock.calls[0][0].params).toMatchObject({
      IndexName: 'gsi4',
      KeyConditionExpression: 'gsi4pk = :apPk',
      ExpressionAttributeValues: { ':apPk': 'SCHEDULE_SOURCES' },
    })
  })

  it('a sheet claim is a conditional put: one sheet → one ecclesia', async () => {
    const { ScheduleRegistryRepository } = await import(
      '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
    )
    const repo = new ScheduleRegistryRepository()
    expect(await repo.claimSheet('placeholder-sheet', 'example-ecclesia', 'memorial')).toBe(true)
    expect(mockSend.mock.calls[0][0].params).toMatchObject({
      Item: { pkey: 'SCHEDULE_SHEET_CLAIM#placeholder-sheet', skey: 'CLAIM', ecclesiaId: 'example-ecclesia' },
      ConditionExpression: 'attribute_not_exists(pkey) OR ecclesiaId = :eid',
      ExpressionAttributeValues: { ':eid': 'example-ecclesia' },
    })

    mockSend.mockRejectedValueOnce(Object.assign(new Error('taken'), { name: 'ConditionalCheckFailedException' }))
    expect(await repo.claimSheet('placeholder-sheet', 'another-ecclesia', 'memorial')).toBe(false)

    mockSend.mockRejectedValueOnce(Object.assign(new Error('boom'), { name: 'InternalServerError' }))
    await expect(repo.claimSheet('placeholder-sheet', 'example-ecclesia', 'memorial')).rejects.toThrow('boom')
  })
})

describe('registered access patterns', () => {
  it('scheduleRegistryByEcclesia, scheduleSourcesAll, schedulesBySource build Queries (never Scan)', async () => {
    const { PATTERNS, patternQuery } = await import('@my/app/provider/dynamodb/access-patterns')
    expect(patternQuery(PATTERNS.scheduleRegistryByEcclesia, { ecclesiaId: 'x' })).toEqual({
      TableName: 'tee-admin',
      KeyConditionExpression: 'pkey = :apPk AND begins_with(skey, :apSk)',
      ExpressionAttributeValues: { ':apPk': 'ECCLESIA_SCHEDULES#x', ':apSk': 'SCHEDULE#' },
    })
    expect(patternQuery(PATTERNS.scheduleSourcesAll, undefined)).toEqual({
      TableName: 'tee-admin',
      IndexName: 'gsi4',
      KeyConditionExpression: 'gsi4pk = :apPk',
      ExpressionAttributeValues: { ':apPk': 'SCHEDULE_SOURCES' },
    })
    expect(patternQuery(PATTERNS.schedulesBySource, { ecclesiaId: 'x', kind: 'memorial' })).toEqual({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :apPk',
      ExpressionAttributeValues: { ':apPk': 'SCHEDULE#x#memorial' },
    })
  })
})
