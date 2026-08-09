import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the DynamoDB document client (mirror of person-repository.test.ts).
const { mockSend } = vi.hoisted(() => {
  return { mockSend: vi.fn() }
})

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchWriteCommand', params })),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}))

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}))

import { TokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'

const PERSON_ID = 'p1'
const LOCKOUT_SK = 'LOCKOUT#email_change'

// A live, unused email-change code token for PERSON_ID.
function activeToken(overrides: Record<string, any> = {}) {
  return {
    pkey: `PERSON#${PERSON_ID}`,
    skey: 'TOKEN#email_change#t1',
    tokenType: 'email_change',
    otpCode: 'ABC234',
    newEmail: 'new@example.com',
    email: 'new@example.com',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('TokenRepository.verifyEmailChangeCode (lockout integration)', () => {
  let repo: TokenRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new TokenRepository()
  })

  afterEach(() => {
    // clearAllMocks (not restoreAllMocks) so the mocked command constructors keep
    // their { type, params } implementations across tests.
    vi.clearAllMocks()
  })

  it('a wrong code increments the persistent lockout ladder (and does not consume the token)', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: null }) // getEmailChangeLockout → INITIAL
      .mockResolvedValueOnce({ Items: [activeToken()] }) // findActiveEmailChangeToken
      .mockResolvedValueOnce({}) // saveEmailChangeLockout → put

    const result = await repo.verifyEmailChangeCode(PERSON_ID, 'WRONG5')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('invalid_code')
    expect(result.lockout?.failCount).toBe(1)

    // Exactly: read lockout, find token, persist the incremented ladder — no consume.
    expect(mockSend).toHaveBeenCalledTimes(3)
    const calls = mockSend.mock.calls.map((c) => c[0])
    expect(calls[2].type).toBe('PutCommand')
    expect(calls[2].params.Item).toMatchObject({
      skey: LOCKOUT_SK,
      failCount: 1,
      tier: 0,
      permanent: false,
    })
  })

  it('a correct code consumes the token (single-use) and clears the lockout ladder', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: null }) // getEmailChangeLockout → INITIAL
      .mockResolvedValueOnce({ Items: [activeToken()] }) // findActiveEmailChangeToken
      .mockResolvedValueOnce({ Attributes: {} }) // update token usedAt (conditional)
      .mockResolvedValueOnce({}) // clearEmailChangeLockout → delete

    const result = await repo.verifyEmailChangeCode(PERSON_ID, ' abc-234 ') // normalized

    expect(result).toEqual({ valid: true, newEmail: 'new@example.com' })
    expect(mockSend).toHaveBeenCalledTimes(4)

    const calls = mockSend.mock.calls.map((c) => c[0])

    // Consume is a single-use conditional write.
    expect(calls[2].type).toBe('UpdateCommand')
    expect(calls[2].params.Key).toEqual({ pkey: `PERSON#${PERSON_ID}`, skey: 'TOKEN#email_change#t1' })
    expect(calls[2].params.ConditionExpression).toBe('attribute_not_exists(usedAt)')

    // Ladder cleared on success.
    expect(calls[3].type).toBe('DeleteCommand')
    expect(calls[3].params.Key).toEqual({ pkey: `PERSON#${PERSON_ID}`, skey: LOCKOUT_SK })
  })

  it('rejects immediately while locked out — never reads the token', async () => {
    mockSend.mockResolvedValueOnce({
      Item: { failCount: 0, tier: 1, lockedUntil: Date.now() + 10 * 60 * 1000, permanent: false },
    }) // getEmailChangeLockout → currently locked

    const result = await repo.verifyEmailChangeCode(PERSON_ID, 'ABC234')

    expect(result.valid).toBe(false)
    expect(result.error).toBe('locked')
    // Only the lockout read happened; no token lookup, no writes.
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].type).toBe('GetCommand')
  })
})
