/**
 * Test personas and test ecclesias (#349) appear in no list, count, search or
 * picker. One test per path. Placeholder data only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  DynamoDBDocument: { from: vi.fn(() => ({ send: mockSend, query: vi.fn(), put: vi.fn() })) },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchWriteCommand', params })),
  BatchGetCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchGetCommand', params })),
  TransactWriteCommand: vi.fn(),
}))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn(), DynamoDB: vi.fn() }))

const ecc = vi.hoisted(() => ({ entries: [] as any[], items: [] as any[] }))
vi.mock('@my/app/provider/dynamodb/people-index', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  listEcclesiaDirectory: vi.fn(async () => ecc.entries),
  getEcclesiaItems: vi.fn(async () => ecc.items),
}))

import { PersonRepository, withoutTestPersonas } from '@my/app/provider/dynamodb/repositories/person-repository'
import { derivePersonProjections } from '@my/app/provider/dynamodb/people-index/keys'
import { getAllEcclesia, withoutTestEcclesias, getEcclesiaByCountry } from '../utils/dynamodb/locations'

const real = { personId: 'real-1', firstName: 'Real', lastName: 'Person', isRecordingBrother: true, isInterEcclesiaRep: true }
const test = { personId: 'test-1', firstName: 'Test', lastName: 'Owner', isTestPersona: true, isRecordingBrother: true, isInterEcclesiaRep: true }

let repo: PersonRepository
beforeEach(() => {
  vi.clearAllMocks()
  repo = new PersonRepository()
  repo.setProjectionSync(null)
})

describe('people: no CARD / name tokens are projected for a test persona', () => {
  const base = { emails: [], phones: [], ecclesiaId: 'toronto-east' }
  it('a test persona gets no projection items (so no directory, roster, typeahead, count or email-search entry)', () => {
    expect(derivePersonProjections({ ...base, profile: { pkey: 'PERSON#test-1', skey: 'PROFILE', ...test } })).toEqual([])
  })
  it('a real person still gets a card and name tokens', () => {
    const items = derivePersonProjections({ ...base, profile: { pkey: 'PERSON#real-1', skey: 'PROFILE', ...real } })
    expect(items.map((i) => i.skey)).toContain('CARD')
    expect(items.some((i) => i.skey.startsWith('NAMETOK#'))).toBe(true)
  })
})

describe('people: list queries on the repository drop test personas', () => {
  it('withoutTestPersonas', () => {
    expect(withoutTestPersonas([real, test] as any)).toEqual([real])
  })
  it('listByEcclesia (GSI2: ecclesia lists, mailing-list opt-in defaults, merge)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [real, test] })
    expect((await repo.listByEcclesia('Any')).items.map((p: any) => p.personId)).toEqual(['real-1'])
  })
  it('searchByName (GSI3: speaker slots, name search)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [real, test] })
    expect((await repo.searchByName('x')).items.map((p: any) => p.personId)).toEqual(['real-1'])
  })
  it('countByEcclesia (member counts) filters them out of the COUNT', async () => {
    mockSend.mockResolvedValueOnce({ Count: 3 })
    await repo.countByEcclesia('Any')
    expect((mockSend.mock.calls[0][0] as any).params.FilterExpression).toBe('attribute_not_exists(isTestPersona)')
  })
  it('listAll (everyone, name resolution, heads-up)', async () => {
    vi.spyOn(repo as any, 'query').mockResolvedValue({ items: [{ personId: 'real-1' }, { personId: 'test-1' }] })
    vi.spyOn(repo as any, 'profilesInOrder').mockResolvedValue([real, test])
    expect((await repo.listAll()).items.map((p: any) => p.personId)).toEqual(['real-1'])
  })
  it('listRecordingBrothers and listInterEcclesiaReps (offices, inter-ecclesia sends)', async () => {
    vi.spyOn(repo as any, 'queryPattern').mockResolvedValue([{ personId: 'real-1' }, { personId: 'test-1' }])
    vi.spyOn(repo as any, 'profilesInOrder').mockResolvedValue([real, test])
    expect((await repo.listRecordingBrothers()).map((p) => p.personId)).toEqual(['real-1'])
    expect((await repo.listInterEcclesiaReps()).map((p) => p.personId)).toEqual(['real-1'])
  })
  it('a point lookup by email still finds a test persona (sign-in needs it)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ ...test, primaryEmail: 'owner@test-personas.invalid', gsi1sk: 'PERSON' }] })
    const found = await repo.getByEmail('owner@test-personas.invalid')
    expect(found?.personId).toBe('test-1')
  })
  it('create() stores the flag on the PROFILE', async () => {
    mockSend.mockResolvedValue({})
    await repo.create({
      email: 'guest@test-personas.invalid',
      firstName: 'Test',
      lastName: 'Guest',
      ecclesia: '',
      memberStatus: 'visitor',
      isTestPersona: true,
    })
    const put = mockSend.mock.calls.map((c) => (c[0] as any).params).find((p) => p?.Item?.skey === 'PROFILE')
    expect(put.Item.isTestPersona).toBe(true)
  })
})

describe('ecclesias: a test ecclesia is in no list, picker, search, sharing or send', () => {
  const entry = (name: string, id: string) => ({ ecclesiaId: id, name, country: 'CA', province: 'ON', city: 'Placeville', ecclesiaPkey: `ECCLESIA#${id}`, ecclesiaSkey: name })
  beforeEach(() => {
    ecc.entries = [entry('Real Ecclesia', 'real'), entry('Test Ecclesia (preview)', 'test-ecclesia-preview')]
    ecc.items = [
      { type: 'ECCLESIA', name: 'Real Ecclesia', ecclesiaId: 'real', country: 'CA', province: 'ON', city: 'Placeville' },
      { type: 'ECCLESIA', name: 'Test Ecclesia (preview)', ecclesiaId: 'test-ecclesia-preview', country: 'CA', province: 'ON', city: 'Placeville', isTest: true },
    ]
  })
  it('withoutTestEcclesias', () => {
    expect(withoutTestEcclesias([{ isTest: true }, {}, { isTest: false }])).toEqual([{}, { isTest: false }])
  })
  it('getAllEcclesia (directory list, nearby/sharing, RB/office pickers, mailing-list owners)', async () => {
    expect((await getAllEcclesia()).map((e) => e.name)).toEqual(['Real Ecclesia'])
  })
  it('getEcclesiaByCountry (same index) drops it too', async () => {
    expect((await getEcclesiaByCountry('CA')).map((e) => e.name)).toEqual(['Real Ecclesia'])
  })
})
