import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getUserFromDynamoDB } from '../../utils/dynamodb/get-user'

// Mock the DynamoDB client
const mockScan = vi.fn()
const mockSend = vi.fn()

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  ScanCommand: vi.fn((params) => ({ params })),
}))

describe('DynamoDB User Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSend.mockReset()
  })

  describe('getUserFromDynamoDB', () => {
    it('should find user with owner role', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            id: 'user-123',
            email: 'ken.easson@gmail.com',
            name: 'Ken Easson',
            role: 'owner',
            ecclesia: 'TEE',
            profile: {
              fname: 'Ken',
              lname: 'Easson',
              phone: '647-393-3153',
              address: '28 Plumridge Crt',
              children: 'Krystal, Zaiden',
            },
          },
        ],
      })

      const user = await getUserFromDynamoDB('ken.easson@gmail.com')

      expect(user).toBeTruthy()
      expect(user?.email).toBe('ken.easson@gmail.com')
      expect(user?.role).toBe('owner')
      expect(user?.profile?.fname).toBe('Ken')
    })

    it('should return null when user not found', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
      })

      const user = await getUserFromDynamoDB('nonexistent@example.com')

      expect(user).toBeNull()
    })

    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB connection error'))

      const user = await getUserFromDynamoDB('test@example.com')

      expect(user).toBeNull()
    })

    it('should return first user when multiple records exist', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          {
            id: 'user-123',
            email: 'test@example.com',
            role: 'owner',
            provider: 'google',
          },
          {
            id: 'user-456',
            email: 'test@example.com',
            role: 'guest',
            provider: 'credentials',
          },
        ],
      })

      const user = await getUserFromDynamoDB('test@example.com')

      expect(user).toBeTruthy()
      expect(user?.id).toBe('user-123')
      expect(user?.role).toBe('owner')
    })

    it('should properly scan with correct filter expression', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [],
      })

      await getUserFromDynamoDB('test@example.com')

      expect(mockSend).toHaveBeenCalledWith({
        params: {
          TableName: 'tee-admin',
          FilterExpression: 'email = :email',
          ExpressionAttributeValues: {
            ':email': 'test@example.com',
          },
        },
      })
    })
  })
})
