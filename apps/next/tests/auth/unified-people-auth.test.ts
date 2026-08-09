import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for Unified People System Auth Integration
 *
 * These tests verify that the auth system correctly uses PersonRecord
 * for O(1) email lookups instead of scan-based USER# lookups.
 */

// Mock environment variable for unified people system
vi.stubEnv('UNIFIED_PEOPLE_AUTH', 'true')

// Mock DynamoDB - use vi.hoisted to ensure mockSend is available when vi.mock runs
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

// Import after mocking
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

describe('Unified People Auth Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Email Lookup Efficiency', () => {
    it('should use GSI1 query instead of scan for email lookup', async () => {
      const mockPerson = {
        personId: 'test-id',
        primaryEmail: 'test@example.com',
        role: 'member',
        provider: 'google',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        ecclesia: 'Toronto East',
      }

      mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

      await personRepository.getByEmail('test@example.com')

      // Verify it used Query (not Scan) with GSI1
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        type: 'QueryCommand',
        params: expect.objectContaining({
          IndexName: 'gsi1',
          KeyConditionExpression: 'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
        }),
      }))

      // Should NOT have used ScanCommand
      const calls = mockSend.mock.calls
      const scanCalls = calls.filter(call => call[0]?.type === 'ScanCommand')
      expect(scanCalls.length).toBe(0)
    })

    it('should normalize email to lowercase for consistent lookups', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] })

      await personRepository.getByEmail('Test@Example.COM')

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        params: expect.objectContaining({
          ExpressionAttributeValues: expect.objectContaining({
            ':gsi1pk': 'EMAIL#test@example.com',
          }),
        }),
      }))
    })
  })

  describe('Auth Data Retrieval', () => {
    it('should return all auth fields needed for sign-in', async () => {
      const mockPerson = {
        personId: 'test-id',
        primaryEmail: 'test@example.com',
        hashedPassword: 'hashed-pw',
        emailVerified: '2024-01-01T00:00:00Z',
        role: 'member',
        provider: 'credentials',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        ecclesia: 'Toronto East',
      }

      mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

      const result = await personRepository.getByEmailForAuth('test@example.com')

      expect(result).toEqual({
        personId: 'test-id',
        email: 'test@example.com',
        hashedPassword: 'hashed-pw',
        emailVerified: '2024-01-01T00:00:00Z',
        role: 'member',
        provider: 'credentials',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John Doe',
        ecclesia: 'Toronto East',
      })
    })
  })

  describe('Credentials User Verification', () => {
    it('should retrieve credentials for password verification', async () => {
      const mockPerson = {
        personId: 'test-id',
        primaryEmail: 'test@example.com',
        hashedPassword: 'hashed-pw-123',
        emailVerified: '2024-01-01T00:00:00Z',
        role: 'member',
        provider: 'credentials',
        displayName: 'John Doe',
      }

      mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

      const result = await personRepository.getCredentialsForVerification('test@example.com')

      expect(result).toEqual({
        personId: 'test-id',
        hashedPassword: 'hashed-pw-123',
        emailVerified: '2024-01-01T00:00:00Z',
        role: 'member',
        displayName: 'John Doe',
      })
    })

    it('should return null for non-credentials provider', async () => {
      const mockPerson = {
        personId: 'test-id',
        primaryEmail: 'test@example.com',
        provider: 'google', // Not credentials
      }

      mockSend.mockResolvedValueOnce({ Items: [mockPerson] })

      const result = await personRepository.getCredentialsForVerification('test@example.com')

      expect(result).toBeNull()
    })
  })

  describe('Email Existence Check', () => {
    it('should check email existence without full record retrieval', async () => {
      mockSend.mockResolvedValueOnce({ Items: [{ personId: 'exists' }] })

      const exists = await personRepository.emailExists('test@example.com')

      expect(exists).toBe(true)
    })

    it('should return false for non-existent email', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({ Items: [] })

      const exists = await personRepository.emailExists('nonexistent@example.com')

      expect(exists).toBe(false)
    })
  })

  describe('OAuth User Creation', () => {
    it('should create PersonRecord from Google OAuth profile', async () => {
      mockSend
        .mockResolvedValueOnce({}) // put PersonRecord
        .mockResolvedValueOnce({}) // put PersonEmailRecord

      const profile = {
        id: 'google-123',
        email: 'user@gmail.com',
        name: 'John Doe',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
      }

      const result = await personRepository.createFromOAuth(profile, {
        ecclesia: 'Toronto East',
        role: 'member',
      })

      expect(result).toMatchObject({
        provider: 'google',
        googleId: 'google-123',
        primaryEmail: 'user@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'Toronto East',
        role: 'member',
        emailVerified: expect.any(String), // OAuth emails are pre-verified
      })
    })
  })

  describe('Credentials User Creation', () => {
    it('should create PersonRecord with hashed password', async () => {
      mockSend
        .mockResolvedValueOnce({}) // put PersonRecord
        .mockResolvedValueOnce({}) // put PersonEmailRecord

      const result = await personRepository.createFromCredentials({
        email: 'test@example.com',
        hashedPassword: 'hashed-password-123',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'Toronto East',
        role: 'member',
      })

      expect(result).toMatchObject({
        provider: 'credentials',
        hashedPassword: 'hashed-password-123',
        primaryEmail: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        ecclesia: 'Toronto East',
        role: 'member',
        emailVerified: undefined, // Not verified until token is used
      })
    })
  })

  describe('Email Verification', () => {
    it('should mark email as verified with timestamp', async () => {
      const mockPerson = {
        pkey: 'PERSON#test-id',
        skey: 'PROFILE',
        personId: 'test-id',
        primaryEmail: 'test@example.com',
      }

      const mockEmail = {
        pkey: 'PERSON#test-id',
        skey: 'EMAIL#email-id',
        emailType: 'primary',
      }

      mockSend
        .mockResolvedValueOnce({ Attributes: { ...mockPerson, emailVerified: expect.any(String) } }) // update PersonRecord
        .mockResolvedValueOnce({ Items: [mockEmail] }) // get emails
        .mockResolvedValueOnce({ Attributes: mockEmail }) // update email record

      const result = await personRepository.markEmailVerified('test-id')

      expect(result.emailVerified).toBeDefined()
    })
  })

  describe('Password Update', () => {
    it('should update password for credentials user', async () => {
      const mockUpdatedPerson = {
        personId: 'test-id',
        hashedPassword: 'new-hashed-password',
      }

      mockSend.mockResolvedValueOnce({ Attributes: mockUpdatedPerson })

      const result = await personRepository.updatePassword('test-id', 'new-hashed-password')

      expect(result.hashedPassword).toBe('new-hashed-password')
    })
  })

  describe('Legacy User Linking', () => {
    it('should link legacy USER# record to PersonRecord', async () => {
      const mockUpdatedPerson = {
        personId: 'person-id',
        userId: 'legacy-user-id',
      }

      mockSend.mockResolvedValueOnce({ Attributes: mockUpdatedPerson })

      const result = await personRepository.linkLegacyUser('person-id', 'legacy-user-id')

      expect(result.userId).toBe('legacy-user-id')
    })
  })
})
