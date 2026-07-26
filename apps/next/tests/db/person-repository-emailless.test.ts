import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DynamoDB — use vi.hoisted so mockSend exists when vi.mock runs.
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}))

// Import after mocking.
import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/** Collect the item from every PutCommand the repo issued. */
function putItems(): any[] {
  return mockSend.mock.calls
    .map((call) => call[0])
    .filter((cmd) => cmd?.type === 'PutCommand')
    .map((cmd) => cmd.params.Item)
}

describe('PersonRepository.create — emailless visitor path (issue #109)', () => {
  let repository: PersonRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockResolvedValue({})
    repository = new PersonRepository()
  })

  it('creates a visitor with NO email: no EMAIL# item, NOEMAIL# GSI1 sentinel', async () => {
    const record = await repository.create({
      firstName: 'Alan',
      lastName: 'Markwith',
      ecclesia: 'Greenaway Hamilton',
      memberStatus: 'visitor',
      role: 'guest',
      source: 'schedule-import',
      sourceRef: 'visiting-speakers:sheet-123',
    })

    const items = putItems()
    // Exactly ONE put — the PROFILE. No secondary EMAIL# item.
    expect(items).toHaveLength(1)
    const profile = items[0]

    expect(profile.skey).toBe('PROFILE')
    // GSI1 uses a NOEMAIL# sentinel keyed by personId — never EMAIL#.
    expect(profile.gsi1pk).toBe(`NOEMAIL#${record.personId}`)
    expect(profile.gsi1pk.startsWith('EMAIL#')).toBe(false)
    expect(profile.gsi1sk).toBe('PERSON')
    // No fake email pollutes the record / SES.
    expect(profile.primaryEmail).toBe('')
    expect(profile.memberStatus).toBe('visitor')
    expect(profile.role).toBe('guest')
    // Provenance is persisted.
    expect(profile.source).toBe('schedule-import')
    expect(profile.sourceRef).toBe('visiting-speakers:sheet-123')

    // No EMAIL# item was ever written.
    expect(items.some((i) => typeof i.skey === 'string' && i.skey.startsWith('EMAIL#'))).toBe(false)

    // Returned record matches what was persisted.
    expect(record.gsi1pk).toBe(`NOEMAIL#${record.personId}`)
    expect(record.primaryEmail).toBe('')
  })

  it('rejects an emailless create when memberStatus is not "visitor"', async () => {
    await expect(
      repository.create({
        firstName: 'Alan',
        lastName: 'Markwith',
        ecclesia: 'Greenaway Hamilton',
        memberStatus: 'member',
      })
    ).rejects.toThrow(/requires an email unless memberStatus is "visitor"/)

    // Defaulting memberStatus (→ 'member') must also reject.
    await expect(
      repository.create({
        firstName: 'No',
        lastName: 'Email',
        ecclesia: 'Toronto East',
      })
    ).rejects.toThrow(/requires an email/)

    expect(putItems()).toHaveLength(0)
  })

  it('keeps the existing email path unchanged: writes PROFILE + EMAIL# with EMAIL# GSI1', async () => {
    const record = await repository.create({
      email: 'Test.Person@Example.com',
      firstName: 'Test',
      lastName: 'Person',
      ecclesia: 'Toronto East',
    })

    const items = putItems()
    // PROFILE + primary EMAIL# item.
    expect(items).toHaveLength(2)

    const profile = items.find((i) => i.skey === 'PROFILE')
    expect(profile.gsi1pk).toBe('EMAIL#test.person@example.com')
    expect(profile.primaryEmail).toBe('test.person@example.com')
    expect(profile.memberStatus).toBe('member')

    const emailItem = items.find((i) => typeof i.skey === 'string' && i.skey.startsWith('EMAIL#'))
    expect(emailItem).toBeTruthy()
    expect(emailItem.email).toBe('test.person@example.com')
    expect(emailItem.emailType).toBe('primary')

    expect(record.primaryEmail).toBe('test.person@example.com')
  })
})
