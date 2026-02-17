import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the DynamoDB document client
// Use vi.hoisted to ensure mockSend is available when vi.mock runs
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

// Mock uuid to return consistent values
let uuidCounter = 0
vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-uuid-${++uuidCounter}`),
}))

// Now import after mocking
import { TokenRepository, type CreateTokenInput } from '@my/app/provider/dynamodb/repositories/token-repository'

describe('TokenRepository', () => {
  let repository: TokenRepository

  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    repository = new TokenRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('create', () => {
    it('should create email verification token with correct structure', async () => {
      mockSend.mockResolvedValueOnce({}) // put

      const input: CreateTokenInput = {
        personId: 'person-123',
        email: 'test@example.com',
        tokenType: 'email_verification',
      }

      const result = await repository.create(input)

      expect(result).toMatchObject({
        pkey: 'PERSON#person-123',
        skey: expect.stringMatching(/^TOKEN#email_verification#test-uuid-/),
        tokenType: 'email_verification',
        email: 'test@example.com',
        personId: 'person-123',
      })

      // Token value should be in gsi4pk
      expect(result.gsi4pk).toMatch(/^TOKEN#/)
      expect(result.tokenValue).toBeDefined()

      // Check expiry is ~24 hours from now
      const expiresAt = new Date(result.expiresAt)
      const now = new Date()
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      expect(diffHours).toBeGreaterThan(23)
      expect(diffHours).toBeLessThan(25)

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        type: 'PutCommand',
        params: expect.objectContaining({
          TableName: 'tee-admin',
          Item: expect.objectContaining({
            pkey: 'PERSON#person-123',
            tokenType: 'email_verification',
          }),
        }),
      }))
    })

    it('should create password reset token with 1-hour expiry', async () => {
      mockSend.mockResolvedValueOnce({})

      const input: CreateTokenInput = {
        personId: 'person-123',
        email: 'test@example.com',
        tokenType: 'password_reset',
      }

      const result = await repository.create(input)

      // Check expiry is ~1 hour from now
      const expiresAt = new Date(result.expiresAt)
      const now = new Date()
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60)
      expect(diffMinutes).toBeGreaterThan(55)
      expect(diffMinutes).toBeLessThan(65)
    })

    it('should create invitation token with 7-day expiry', async () => {
      mockSend.mockResolvedValueOnce({})

      const input: CreateTokenInput = {
        personId: 'person-123',
        email: 'test@example.com',
        tokenType: 'invitation',
        invitedBy: 'admin-123',
        invitedRole: 'member',
      }

      const result = await repository.create(input)

      expect(result.invitedBy).toBe('admin-123')
      expect(result.invitedRole).toBe('member')

      // Check expiry is ~7 days from now
      const expiresAt = new Date(result.expiresAt)
      const now = new Date()
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(6.9)
      expect(diffDays).toBeLessThan(7.1)
    })

    it('should allow custom expiry duration', async () => {
      mockSend.mockResolvedValueOnce({})

      const input: CreateTokenInput = {
        personId: 'person-123',
        email: 'test@example.com',
        tokenType: 'email_verification',
        expiresInMs: 2 * 60 * 60 * 1000, // 2 hours
      }

      const result = await repository.create(input)

      const expiresAt = new Date(result.expiresAt)
      const now = new Date()
      const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
      expect(diffHours).toBeGreaterThan(1.9)
      expect(diffHours).toBeLessThan(2.1)
    })
  })

  describe('getByValue', () => {
    it('should find token by value using GSI4', async () => {
      const mockToken = {
        pkey: 'PERSON#person-123',
        skey: 'TOKEN#email_verification#token-id',
        gsi4pk: 'TOKEN#abcdef123456',
        tokenValue: 'abcdef123456',
        tokenType: 'email_verification',
        email: 'test@example.com',
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.getByValue('abcdef123456')

      expect(result).toEqual(mockToken)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return null when token not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.getByValue('nonexistent-token')

      expect(result).toBeNull()
    })
  })

  describe('verify', () => {
    it('should return valid for unexpired, unused token', async () => {
      const mockToken = {
        tokenValue: 'valid-token',
        tokenType: 'email_verification',
        expiresAt: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
        usedAt: undefined,
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.verify('valid-token')

      expect(result.valid).toBe(true)
      expect(result.token).toEqual(mockToken)
      expect(result.error).toBeUndefined()
    })

    it('should return error for non-existent token', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.verify('nonexistent-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('not_found')
    })

    it('should return error for expired token', async () => {
      const mockToken = {
        tokenValue: 'expired-token',
        tokenType: 'email_verification',
        expiresAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
        usedAt: undefined,
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.verify('expired-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('expired')
    })

    it('should return error for already used token', async () => {
      const mockToken = {
        tokenValue: 'used-token',
        tokenType: 'email_verification',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        usedAt: new Date().toISOString(),
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.verify('used-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('already_used')
    })

    it('should return error for wrong token type', async () => {
      const mockToken = {
        tokenValue: 'valid-token',
        tokenType: 'password_reset',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        usedAt: undefined,
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.verify('valid-token', 'email_verification')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('type_mismatch')
    })
  })

  describe('markUsed', () => {
    it('should mark token as used', async () => {
      const mockToken = {
        pkey: 'PERSON#person-123',
        skey: 'TOKEN#email_verification#token-id',
        tokenValue: 'valid-token',
      }

      mockSend
        .mockResolvedValueOnce({ Items: [mockToken] }) // getByValue
        .mockResolvedValueOnce({ Attributes: { ...mockToken, usedAt: '2024-01-01T00:00:00Z' } }) // update

      const result = await repository.markUsed('valid-token')

      expect(result?.usedAt).toBeDefined()
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should return null if token not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.markUsed('nonexistent-token')

      expect(result).toBeNull()
    })
  })

  describe('verifyAndConsume', () => {
    it('should verify and consume valid token atomically', async () => {
      const mockToken = {
        pkey: 'PERSON#person-123',
        skey: 'TOKEN#email_verification#token-id',
        tokenValue: 'valid-token',
        tokenType: 'email_verification',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        usedAt: undefined,
      }

      const usedAt = new Date().toISOString()
      mockSend
        .mockResolvedValueOnce({ Items: [mockToken] }) // getByValue
        .mockResolvedValueOnce({ Attributes: { ...mockToken, usedAt } }) // atomic update

      const result = await repository.verifyAndConsume('valid-token', 'email_verification')

      expect(result.valid).toBe(true)
      expect(result.token?.usedAt).toBeDefined()
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should not consume invalid token', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.verifyAndConsume('nonexistent-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('not_found')
    })

    it('should return already_used when token was consumed by another process', async () => {
      const mockToken = {
        pkey: 'PERSON#person-123',
        skey: 'TOKEN#email_verification#token-id',
        tokenValue: 'valid-token',
        tokenType: 'email_verification',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        usedAt: undefined,
      }

      const consumedToken = { ...mockToken, usedAt: '2024-01-01T00:00:00Z' }

      // First call: token appears unused
      mockSend.mockResolvedValueOnce({ Items: [mockToken] })
      // Second call: conditional update fails (race condition)
      const conditionError = new Error('Condition check failed')
      conditionError.name = 'ConditionalCheckFailedException'
      mockSend.mockRejectedValueOnce(conditionError)
      // Third call: re-fetch shows token was used
      mockSend.mockResolvedValueOnce({ Items: [consumedToken] })

      const result = await repository.verifyAndConsume('valid-token', 'email_verification')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('already_used')
    })

    it('should return type_mismatch when token type does not match', async () => {
      const mockToken = {
        pkey: 'PERSON#person-123',
        skey: 'TOKEN#password_reset#token-id',
        tokenValue: 'valid-token',
        tokenType: 'password_reset',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        usedAt: undefined,
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.verifyAndConsume('valid-token', 'email_verification')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('type_mismatch')
    })

    it('should return expired when token has expired', async () => {
      const mockToken = {
        pkey: 'PERSON#person-123',
        skey: 'TOKEN#email_verification#token-id',
        tokenValue: 'expired-token',
        tokenType: 'email_verification',
        expiresAt: new Date(Date.now() - 60000).toISOString(), // Expired 1 minute ago
        usedAt: undefined,
      }

      mockSend.mockResolvedValueOnce({ Items: [mockToken] })

      const result = await repository.verifyAndConsume('expired-token', 'email_verification')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('expired')
    })
  })

  describe('Convenience Methods', () => {
    describe('createEmailVerification', () => {
      it('should delete existing tokens and create new one', async () => {
        // Mock getByPersonAndType returning existing tokens
        mockSend.mockResolvedValueOnce({
          Items: [
            { pkey: 'PERSON#person-123', skey: 'TOKEN#email_verification#old-token' },
          ],
        })
        // Mock delete
        mockSend.mockResolvedValueOnce({})
        // Mock create put
        mockSend.mockResolvedValueOnce({})

        const result = await repository.createEmailVerification('person-123', 'test@example.com')

        expect(result.tokenType).toBe('email_verification')
        // Should have called: query, delete, put
        expect(mockSend).toHaveBeenCalledTimes(3)
      })
    })

    describe('createPasswordReset', () => {
      it('should delete existing tokens and create new one', async () => {
        mockSend.mockResolvedValueOnce({ Items: [] }) // No existing tokens
        mockSend.mockResolvedValueOnce({}) // create put

        const result = await repository.createPasswordReset('person-123', 'test@example.com')

        expect(result.tokenType).toBe('password_reset')
      })
    })

    describe('createInvitation', () => {
      it('should create invitation token with inviter info', async () => {
        mockSend.mockResolvedValueOnce({}) // create put

        const result = await repository.createInvitation('person-123', 'test@example.com', 'admin-456', 'member')

        expect(result.tokenType).toBe('invitation')
        expect(result.invitedBy).toBe('admin-456')
        expect(result.invitedRole).toBe('member')
      })
    })
  })

  describe('getByPerson', () => {
    it('should return all tokens for a person', async () => {
      const mockTokens = [
        { pkey: 'PERSON#person-123', skey: 'TOKEN#email_verification#token-1' },
        { pkey: 'PERSON#person-123', skey: 'TOKEN#password_reset#token-2' },
      ]

      mockSend.mockResolvedValueOnce({ Items: mockTokens })

      const result = await repository.getByPerson('person-123')

      expect(result).toEqual(mockTokens)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteAllOfType', () => {
    it('should delete all tokens of a specific type for a person', async () => {
      const mockTokens = [
        { pkey: 'PERSON#person-123', skey: 'TOKEN#email_verification#token-1' },
        { pkey: 'PERSON#person-123', skey: 'TOKEN#email_verification#token-2' },
      ]

      mockSend
        .mockResolvedValueOnce({ Items: mockTokens }) // getByPersonAndType
        .mockResolvedValueOnce({}) // delete 1
        .mockResolvedValueOnce({}) // delete 2

      const result = await repository.deleteAllOfType('person-123', 'email_verification')

      expect(result).toBe(2)
      expect(mockSend).toHaveBeenCalledTimes(3)
    })
  })

  describe('cleanupExpired', () => {
    it('should delete all expired tokens', async () => {
      const mockExpiredTokens = [
        { pkey: 'PERSON#person-1', skey: 'TOKEN#email_verification#token-1' },
        { pkey: 'PERSON#person-2', skey: 'TOKEN#password_reset#token-2' },
      ]

      mockSend
        .mockResolvedValueOnce({ Items: mockExpiredTokens }) // scan
        .mockResolvedValueOnce({}) // delete 1
        .mockResolvedValueOnce({}) // delete 2

      const result = await repository.cleanupExpired()

      expect(result).toBe(2)
    })
  })

  describe('listPendingInvitations', () => {
    it('should list all pending (unused, unexpired) invitations', async () => {
      const mockInvitations = [
        {
          tokenType: 'invitation',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          invitedBy: 'admin-1',
        },
      ]

      mockSend.mockResolvedValueOnce({ Items: mockInvitations })

      const result = await repository.listPendingInvitations()

      expect(result).toEqual(mockInvitations)
    })
  })
})
