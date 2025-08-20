import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock DynamoDBDocument before importing
const mockPut = vi.fn()
const mockGet = vi.fn()
const mockQuery = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

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

// Now import after mocking
import {
  createCredentialsUser,
  findCredentialsUserByEmail,
  verifyCredentialsUser,
  createEmailVerificationToken,
  verifyEmailToken,
  createInvitationCode,
  validateInvitationCode,
  markInvitationCodeAsUsed,
} from '../../utils/dynamodb/credentials-users'
import { ROLES } from '@my/app/provider/auth/auth-roles'

describe('Credentials Users Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createCredentialsUser', () => {
    it('should create a new user with correct data structure', async () => {
      mockQuery.mockResolvedValueOnce({ Items: [] }) // No existing user
      mockPut.mockResolvedValueOnce({})

      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      }

      const result = await createCredentialsUser(userData)

      expect(result).toMatchObject({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        ecclesia: userData.ecclesia,
        role: ROLES.GUEST,
        provider: 'credentials',
      })

      expect(result.id).toBeDefined()
      expect(result.hashedPassword).toBeDefined()
      expect(result.createdAt).toBeInstanceOf(Date)

      // Verify DynamoDB put was called with correct structure
      expect(mockPut).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Item: expect.objectContaining({
          pkey: `USER#${result.id}`,
          skey: `USER#${result.id}`,
          gsi1pk: `USER#${userData.email}`,
          gsi1sk: `USER#${userData.email}`,
          type: 'USER',
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
        }),
        ConditionExpression: 'attribute_not_exists(pkey)',
      })
    })

    it('should throw error if user already exists', async () => {
      const existingUser = {
        id: '123',
        email: 'test@example.com',
        provider: 'credentials',
      }
      mockQuery.mockResolvedValueOnce({ Items: [existingUser] })

      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
      }

      await expect(createCredentialsUser(userData)).rejects.toThrow(
        'User with this email already exists'
      )
    })

    it('should use invitation code details when provided', async () => {
      mockQuery.mockResolvedValueOnce({ Items: [] }) // No existing user
      mockPut.mockResolvedValueOnce({})
      mockUpdate.mockResolvedValueOnce({}) // For marking invitation as used

      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'TEE',
        role: ROLES.ADMIN,
        invitationCode: 'ABCD1234',
      }

      const result = await createCredentialsUser(userData)

      expect(result.role).toBe(ROLES.ADMIN)
      expect(mockUpdate).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: 'INVITE_CODE#ABCD1234',
          skey: 'INVITE_CODE#ABCD1234',
        },
        UpdateExpression: 'SET used = :used, usedBy = :userId, usedAt = :now',
        ExpressionAttributeValues: expect.objectContaining({
          ':used': true,
          ':userId': result.id,
        }),
      })
    })
  })

  describe('findCredentialsUserByEmail', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        provider: 'credentials',
        firstName: 'John',
        lastName: 'Doe',
      }

      mockQuery.mockResolvedValueOnce({ Items: [mockUser] })

      const result = await findCredentialsUserByEmail('test@example.com')

      expect(result).toEqual(mockUser)
      expect(mockQuery).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        IndexName: 'gsi1',
        KeyConditionExpression: 'gsi1pk = :pk',
        ExpressionAttributeValues: {
          ':pk': 'USER#test@example.com',
        },
      })
    })

    it('should return null when user not found', async () => {
      mockQuery.mockResolvedValueOnce({ Items: [] })

      const result = await findCredentialsUserByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })

    it('should return null when user has different provider', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        provider: 'google',
      }

      mockQuery.mockResolvedValueOnce({ Items: [mockUser] })

      const result = await findCredentialsUserByEmail('test@example.com')

      expect(result).toBeNull()
    })
  })

  describe('verifyCredentialsUser', () => {
    it('should return user when credentials are valid and email is verified', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        hashedPassword: '$2b$10$hashedpassword',
        provider: 'credentials',
        emailVerified: new Date(),
      }

      mockQuery.mockResolvedValueOnce({ Items: [mockUser] })

      // Mock bcryptjs.compare to return true
      vi.doMock('bcryptjs', () => ({
        compare: vi.fn().mockResolvedValue(true),
      }))

      const result = await verifyCredentialsUser('test@example.com', 'password')

      expect(result).toEqual(mockUser)
    })

    it('should return null when email is not verified', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        hashedPassword: '$2b$10$hashedpassword',
        provider: 'credentials',
        emailVerified: null,
      }

      mockQuery.mockResolvedValueOnce({ Items: [mockUser] })

      vi.doMock('bcryptjs', () => ({
        compare: vi.fn().mockResolvedValue(true),
      }))

      const result = await verifyCredentialsUser('test@example.com', 'password')

      expect(result).toBeNull()
    })
  })

  describe('createEmailVerificationToken', () => {
    it('should create verification token with correct structure', async () => {
      mockPut.mockResolvedValueOnce({})

      const email = 'test@example.com'
      const result = await createEmailVerificationToken(email)

      expect(result).toMatch(/^[a-f0-9]{64}$/) // Should be 64-character hex string

      expect(mockPut).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Item: expect.objectContaining({
          pkey: `VERIFY_TOKEN#${result}`,
          skey: `VERIFY_TOKEN#${result}`,
          type: 'VERIFICATION_TOKEN',
          token: result,
          email,
          tokenType: 'email_verification',
          createdAt: expect.any(Date),
          expiresAt: expect.any(Date),
        }),
      })
    })
  })

  describe('verifyEmailToken', () => {
    it('should verify email and update user when token is valid', async () => {
      const token = 'validtoken123'
      const email = 'test@example.com'
      const userId = 'user123'

      // Mock token lookup
      mockGet.mockResolvedValueOnce({
        Item: {
          token,
          email,
          tokenType: 'email_verification',
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
          expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        },
      })

      // Mock user lookup
      mockQuery.mockResolvedValueOnce({
        Items: [{ id: userId, email }],
      })

      // Mock update and delete operations
      mockUpdate.mockResolvedValueOnce({})
      mockDelete.mockResolvedValueOnce({})

      const result = await verifyEmailToken(token)

      expect(result).toEqual({ email })

      // Verify user was updated
      expect(mockUpdate).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: `USER#${userId}`,
          skey: `USER#${userId}`,
        },
        UpdateExpression: 'SET emailVerified = :now',
        ExpressionAttributeValues: {
          ':now': expect.any(Date),
        },
      })

      // Verify token was deleted
      expect(mockDelete).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        Key: {
          pkey: `VERIFY_TOKEN#${token}`,
          skey: `VERIFY_TOKEN#${token}`,
        },
      })
    })

    it('should return null for invalid token', async () => {
      mockGet.mockResolvedValueOnce({ Item: null })

      const result = await verifyEmailToken('invalidtoken')

      expect(result).toBeNull()
    })

    it('should return null for wrong token type', async () => {
      mockGet.mockResolvedValueOnce({
        Item: {
          token: 'token123',
          email: 'test@example.com',
          tokenType: 'password_reset',
          createdAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() + 86400000),
        },
      })

      const result = await verifyEmailToken('token123')

      expect(result).toBeNull()
    })
  })

  describe('invitation codes', () => {
    describe('createInvitationCode', () => {
      it('should create invitation code with correct structure', async () => {
        mockPut.mockResolvedValueOnce({})

        const inviteData = {
          firstName: 'John',
          lastName: 'Doe',
          ecclesia: 'TEE',
          role: ROLES.MEMBER,
          createdBy: 'admin123',
        }

        const result = await createInvitationCode(inviteData)

        expect(result).toMatch(/^[A-Z0-9]{8}$/) // Should be 8-character code

        expect(mockPut).toHaveBeenCalledWith({
          TableName: 'tee-admin',
          Item: expect.objectContaining({
            pkey: `INVITE_CODE#${result}`,
            skey: `INVITE_CODE#${result}`,
            type: 'INVITATION_CODE',
            code: result,
            ...inviteData,
            createdAt: expect.any(Date),
            expiresAt: expect.any(Date),
            used: false,
          }),
        })
      })
    })

    describe('validateInvitationCode', () => {
      it('should return invitation when valid', async () => {
        const mockInvitation = {
          code: 'ABCD1234',
          firstName: 'John',
          lastName: 'Doe',
          role: ROLES.MEMBER,
          createdAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() + 86400000),
          used: false,
        }

        mockGet.mockResolvedValueOnce({ Item: mockInvitation })

        const result = await validateInvitationCode('ABCD1234')

        expect(result).toEqual(mockInvitation)
      })

      it('should return null for used invitation', async () => {
        const mockInvitation = {
          code: 'ABCD1234',
          used: true,
          createdAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() + 86400000),
        }

        mockGet.mockResolvedValueOnce({ Item: mockInvitation })

        const result = await validateInvitationCode('ABCD1234')

        expect(result).toBeNull()
      })
    })
  })
})
