import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'

// Import the actual functions to test them directly
import { 
  createCredentialsUser as actualCreateCredentialsUser,
  findAnyUserByEmail as actualFindAnyUserByEmail 
} from '../../utils/dynamodb/credentials-users'

describe('Credentials Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Account Linking Prevention', () => {
    it('should prevent creating credentials account when Google OAuth user exists', async () => {
      // Mock existing Google OAuth user
      mockScan.mockResolvedValueOnce({
        Items: [{
          id: 'existing-user-id',
          email: 'ken.easson@gmail.com',
          provider: 'google',
          role: 'owner'
        }]
      })

      await expect(createCredentialsUser({
        email: 'ken.easson@gmail.com',
        password: 'password123',
        firstName: 'Ken',
        lastName: 'Easson',
        ecclesia: 'TEE'
      })).rejects.toThrow('User with this email already exists. Please sign in with your existing account or use a different email.')
    })

    it('should prevent creating credentials account when credentials user exists', async () => {
      // Mock no user found in scan (any provider)
      mockScan.mockResolvedValueOnce({
        Items: []
      })

      // Mock existing credentials user found in query
      mockQuery.mockResolvedValueOnce({
        Items: [{
          id: 'existing-cred-user-id',
          email: 'test@example.com',
          provider: 'credentials',
          role: 'member'
        }]
      })

      await expect(createCredentialsUser({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        ecclesia: 'TEE'
      })).rejects.toThrow('User with this email already exists')
    })

    it('should allow creating credentials account for new email', async () => {
      // Mock no existing user (any provider)
      mockScan.mockResolvedValueOnce({
        Items: []
      })

      // Mock no credentials user
      mockQuery.mockResolvedValueOnce({
        Items: []
      })

      // Mock successful put
      mockPut.mockResolvedValueOnce({})

      const user = await createCredentialsUser({
        email: 'new.user@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        ecclesia: 'TEE'
      })

      expect(user.email).toBe('new.user@example.com')
      expect(user.name).toBe('New User')
      expect(user.role).toBe(ROLES.GUEST) // Default role
      expect(user.provider).toBe('credentials')
      expect(mockPut).toHaveBeenCalledOnce()
    })
  })

  describe('findAnyUserByEmail', () => {
    it('should find Google OAuth user', async () => {
      mockScan.mockResolvedValueOnce({
        Items: [{
          id: 'google-user-id',
          email: 'test@example.com',
          provider: 'google',
          role: 'member',
          type: 'USER'
        }]
      })

      const user = await findAnyUserByEmail('test@example.com')
      
      expect(user).toBeTruthy()
      expect(user.provider).toBe('google')
      expect(user.email).toBe('test@example.com')
      expect(mockScan).toHaveBeenCalledWith({
        TableName: 'tee-admin',
        FilterExpression: 'email = :email AND #type = :userType',
        ExpressionAttributeValues: {
          ':email': 'test@example.com',
          ':userType': 'USER'
        },
        ExpressionAttributeNames: {
          '#type': 'type'
        }
      })
    })

    it('should find credentials user', async () => {
      mockScan.mockResolvedValueOnce({
        Items: [{
          id: 'cred-user-id',
          email: 'test@example.com',
          provider: 'credentials',
          role: 'member',
          type: 'USER'
        }]
      })

      const user = await findAnyUserByEmail('test@example.com')
      
      expect(user).toBeTruthy()
      expect(user.provider).toBe('credentials')
      expect(user.email).toBe('test@example.com')
    })

    it('should return null when no user found', async () => {
      mockScan.mockResolvedValueOnce({
        Items: []
      })

      const user = await findAnyUserByEmail('nonexistent@example.com')
      
      expect(user).toBeNull()
    })

    it('should handle scan errors gracefully', async () => {
      mockScan.mockRejectedValueOnce(new Error('DynamoDB error'))

      const user = await findAnyUserByEmail('test@example.com')
      
      expect(user).toBeNull()
    })
  })
})