import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Create mock functions first
const mockPut = vi.fn()
const mockGet = vi.fn()
const mockQuery = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

// Mock the DynamoDB client
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocument: {
    from: vi.fn(() => ({
      put: mockPut,
      get: mockGet,
      query: mockQuery,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: vi.fn(),
}))

vi.mock('../../utils/email/sesClient', () => ({
  getAwsDbConfig: vi.fn(() => ({})),
}))

vi.mock('../../utils/email/send-verification-email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

// Import functions after mocking
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  resetPassword,
  findCredentialsUserByEmail,
} from '../utils/dynamodb/credentials-users'
import { sendPasswordResetEmail } from '../utils/email/send-verification-email'

describe('Password Reset Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('createPasswordResetToken', () => {
    it('should create a password reset token successfully', async () => {
      mockPut.mockResolvedValue({})

      const email = 'test@example.com'
      const token = await createPasswordResetToken(email)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)

      expect(mockPut).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Item: expect.objectContaining({
          pkey: `RESET_TOKEN#${token}`,
          skey: `RESET_TOKEN#${token}`,
          type: 'PASSWORD_RESET_TOKEN',
          token,
          email,
          tokenType: 'password_reset',
          createdAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      })
    })

    it('should set correct expiration time (7 days)', async () => {
      mockPut.mockResolvedValue({})

      const email = 'test@example.com'
      await createPasswordResetToken(email)

      const putCall = mockPut.mock.calls[0][0]
      const createdAt = putCall.Item.createdAt
      const expiresAt = putCall.Item.expiresAt

      const expectedExpiry = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      expect(expiresAt.getTime()).toBe(expectedExpiry.getTime())
    })

    it('should handle database errors gracefully', async () => {
      mockPut.mockRejectedValue(new Error('Database error'))

      const email = 'test@example.com'

      await expect(createPasswordResetToken(email)).rejects.toThrow('Database error')
    })
  })

  describe('validatePasswordResetToken', () => {
    it('should validate a valid token successfully', async () => {
      const validToken = 'valid-token-123'
      const email = 'test@example.com'
      const now = new Date()

      mockGet.mockResolvedValue({
        Item: {
          pkey: `RESET_TOKEN#${validToken}`,
          skey: `RESET_TOKEN#${validToken}`,
          type: 'PASSWORD_RESET_TOKEN',
          token: validToken,
          email,
          tokenType: 'password_reset',
          createdAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      const result = await validatePasswordResetToken(validToken)

      expect(result).toEqual({ email })
      expect(mockGet).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: `RESET_TOKEN#${validToken}`,
          skey: `RESET_TOKEN#${validToken}`,
        },
      })
    })

    it('should return null for non-existent token', async () => {
      mockGet.mockResolvedValue({})

      const result = await validatePasswordResetToken('non-existent-token')

      expect(result).toBeNull()
    })

    it('should return null for expired token', async () => {
      const expiredToken = 'expired-token-123'
      const pastDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // 8 days ago

      mockGet.mockResolvedValue({
        Item: {
          pkey: `RESET_TOKEN#${expiredToken}`,
          skey: `RESET_TOKEN#${expiredToken}`,
          type: 'PASSWORD_RESET_TOKEN',
          token: expiredToken,
          email: 'test@example.com',
          tokenType: 'password_reset',
          createdAt: pastDate,
          expiresAt: new Date(pastDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      const result = await validatePasswordResetToken(expiredToken)

      expect(result).toBeNull()
    })

    it('should return null for wrong token type', async () => {
      const wrongTypeToken = 'wrong-type-token-123'
      const now = new Date()

      mockGet.mockResolvedValue({
        Item: {
          pkey: `RESET_TOKEN#${wrongTypeToken}`,
          skey: `RESET_TOKEN#${wrongTypeToken}`,
          type: 'PASSWORD_RESET_TOKEN',
          token: wrongTypeToken,
          email: 'test@example.com',
          tokenType: 'email_verification', // Wrong type
          createdAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      const result = await validatePasswordResetToken(wrongTypeToken)

      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      mockGet.mockRejectedValue(new Error('Database error'))

      const result = await validatePasswordResetToken('test-token')

      expect(result).toBeNull()
    })
  })

  describe('resetPassword', () => {
    const validToken = 'valid-token-123'
    const email = 'test@example.com'
    const userId = 'user-123'
    const newPassword = 'NewSecurePassword123!'

    beforeEach(() => {
      // Mock successful token validation
      const now = new Date()
      mockGet.mockResolvedValue({
        Item: {
          pkey: `RESET_TOKEN#${validToken}`,
          skey: `RESET_TOKEN#${validToken}`,
          type: 'PASSWORD_RESET_TOKEN',
          token: validToken,
          email,
          tokenType: 'password_reset',
          createdAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Mock user lookup
      mockQuery.mockResolvedValue({
        Items: [
          {
            id: userId,
            email,
            provider: 'credentials',
          },
        ],
      })

      // Mock successful operations
      mockUpdate.mockResolvedValue({})
      mockDelete.mockResolvedValue({})
    })

    it('should reset password successfully', async () => {
      const result = await resetPassword(validToken, newPassword)

      expect(result).toBe(true)

      // Should validate token
      expect(mockGet).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: `RESET_TOKEN#${validToken}`,
          skey: `RESET_TOKEN#${validToken}`,
        },
      })

      // Should find user by email
      expect(mockQuery).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
        },
      })

      // Should update password
      expect(mockUpdate).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: `USER#${userId}`,
          skey: `USER#${userId}`,
        },
        UpdateExpression: 'SET password = :password',
        ConditionExpression: 'provider = :provider',
        ExpressionAttributeValues: expect.objectContaining({
          ':password': expect.any(String), // Hashed password
          ':provider': 'credentials',
        }),
      })

      // Should delete the token
      expect(mockDelete).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: `RESET_TOKEN#${validToken}`,
          skey: `RESET_TOKEN#${validToken}`,
        },
      })
    })

    it('should return false for invalid token', async () => {
      mockGet.mockResolvedValue({}) // No token found

      const result = await resetPassword('invalid-token', newPassword)

      expect(result).toBe(false)
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('should return false if user not found', async () => {
      mockQuery.mockResolvedValue({ Items: [] }) // No user found

      const result = await resetPassword(validToken, newPassword)

      expect(result).toBe(false)
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      mockUpdate.mockRejectedValue(new Error('Database error'))

      const result = await resetPassword(validToken, newPassword)

      expect(result).toBe(false)
    })
  })

  describe('Integration with findCredentialsUserByEmail', () => {
    it('should work together for complete password reset flow', async () => {
      const email = 'integration@example.com'
      const userId = 'integration-user-123'

      // Mock user exists
      mockQuery.mockResolvedValue({
        Items: [
          {
            id: userId,
            email,
            provider: 'credentials',
            name: 'Integration User',
            emailVerified: new Date(),
          },
        ],
      })

      // Test user lookup
      const user = await findCredentialsUserByEmail(email)
      expect(user).toBeTruthy()
      expect(user?.email).toBe(email)

      // Mock token creation
      mockPut.mockResolvedValue({})

      // Test token creation
      const token = await createPasswordResetToken(email)
      expect(token).toBeDefined()

      // Mock token validation
      const now = new Date()
      mockGet.mockResolvedValue({
        Item: {
          pkey: `RESET_TOKEN#${token}`,
          skey: `RESET_TOKEN#${token}`,
          type: 'PASSWORD_RESET_TOKEN',
          token,
          email,
          tokenType: 'password_reset',
          createdAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Test token validation
      const tokenData = await validatePasswordResetToken(token)
      expect(tokenData).toEqual({ email })

      // Mock successful password reset
      mockUpdate.mockResolvedValue({})
      mockDelete.mockResolvedValue({})

      // Test password reset
      const resetResult = await resetPassword(token, 'NewPassword123!')
      expect(resetResult).toBe(true)
    })
  })

  describe('Email sending integration', () => {
    it('should call sendPasswordResetEmail with correct parameters', async () => {
      const email = 'email-test@example.com'
      const userName = 'Email Test User'

      mockPut.mockResolvedValue({})
      const token = await createPasswordResetToken(email)

      await sendPasswordResetEmail(email, token, userName)

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(email, token, userName)
    })
  })
})
