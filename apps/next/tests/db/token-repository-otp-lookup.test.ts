import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Typed login codes must be found wherever they sit in the table.
 *
 * Incident 2026-10-13: a valid OTP (unexpired, unused, 0 attempts) was
 * rejected as "No verification code found" because findActiveOtpByEmail read
 * ONE scan page (~1 MB, 3,899 of 7,519 items) and the code was on page two.
 */
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchWriteCommand', params })),
}))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import { TokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'

const EMAIL = 'ken.easson+hacker@gmail.com'
const otp = (id: string, createdAt: string) => ({
  pkey: `PERSON#${id}`,
  skey: `TOKEN#otp#${id}`,
  email: EMAIL,
  createdAt,
  expiresAt: '2999-01-01T00:00:00.000Z',
  attempts: 0,
})

let repo: TokenRepository
beforeEach(() => {
  mockSend.mockReset()
  repo = new TokenRepository()
})

describe('findActiveOtpByEmail', () => {
  it('finds a code that sits on a LATER scan page (the 2026-10-13 incident)', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { pkey: 'x', skey: 'y' } }) // page 1: 3,899 items, no match
      .mockResolvedValueOnce({ Items: [otp('a', '2026-10-13T20:03:21.704Z')] }) // page 2: the code

    const token = await repo.findActiveOtpByEmail(EMAIL)

    expect(token?.skey).toBe('TOKEN#otp#a')
    expect(mockSend).toHaveBeenCalledTimes(2)
    // page 2 continued from where page 1 stopped
    expect(mockSend.mock.calls[1][0].params.ExclusiveStartKey).toEqual({ pkey: 'x', skey: 'y' })
  })

  it('returns the NEWEST live code when several exist (no-account resends)', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [otp('new', '2026-10-13T20:03:00.000Z')], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [otp('old', '2026-10-13T19:16:55.000Z')] })

    expect((await repo.findActiveOtpByEmail(EMAIL))?.skey).toBe('TOKEN#otp#new')
  })

  it('returns null only after reading every page', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [] })

    expect(await repo.findActiveOtpByEmail(EMAIL)).toBeNull()
    expect(mockSend).toHaveBeenCalledTimes(2)
  })

  it('verifyOtp no longer reports not_found for a code on page two', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [{ ...otp('a', '2026-10-13T20:03:21.704Z'), otpCode: '123456' }] })
      .mockResolvedValue({}) // any follow-up writes (attempt count / consume)

    const result = await repo.verifyOtp(EMAIL, '000000')
    expect(result.error).not.toBe('not_found')
  })
})
