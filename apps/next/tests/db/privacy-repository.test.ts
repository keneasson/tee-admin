import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock DynamoDB and connection repository - use vi.hoisted for all mocks
const { mockSend, mockIsConnected } = vi.hoisted(() => {
  return {
    mockSend: vi.fn(),
    mockIsConnected: vi.fn(),
  }
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
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}))

// Mock connection repository for canViewField tests
vi.mock('@my/app/provider/dynamodb/repositories/connection-repository', () => ({
  connectionRepository: {
    isConnected: mockIsConnected,
  },
}))

import { PrivacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import type { VisibilityLevel } from '@my/app/provider/dynamodb/types'

describe('PrivacyRepository', () => {
  let repository: PrivacyRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new PrivacyRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getPrivacySettings', () => {
    it('should return existing privacy settings', async () => {
      const mockSettings = {
        pkey: 'USER#test@example.com',
        skey: 'PRIVACY_SETTINGS',
        showName: 'authenticated',
        showPhone: 'private',
        showAddress: 'private',
        showEmail: 'ecclesia_and_connections',
        showFamily: 'connections_only',
        allowContactRequests: true,
      }
      mockSend.mockResolvedValueOnce({ Item: mockSettings })

      const result = await repository.getPrivacySettings('test@example.com')

      expect(result).toEqual(mockSettings)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return default settings when none exist', async () => {
      mockSend.mockResolvedValueOnce({ Item: null })

      const result = await repository.getPrivacySettings('new@example.com')

      expect((result as any).pkey ?? (result as any).PK).toBe('USER#new@example.com')
      expect((result as any).skey ?? (result as any).SK).toBe('PRIVACY_SETTINGS')
      expect(result.showName).toBe('authenticated')
      expect(result.showPhone).toBe('private')
      expect(result.showAddress).toBe('private')
      expect(result.showEmail).toBe('ecclesia_and_connections')
      expect(result.showFamily).toBe('connections_only')
      expect(result.allowContactRequests).toBe(true)
    })
  })

  describe('updatePrivacySettings', () => {
    it('should update existing privacy settings', async () => {
      const existingSettings = {
        pkey: 'USER#test@example.com',
        skey: 'PRIVACY_SETTINGS',
        showPhone: 'private',
      }
      const updates = { showPhone: 'authenticated' as VisibilityLevel }

      mockSend.mockResolvedValueOnce({ Item: existingSettings })
      mockSend.mockResolvedValueOnce({ Attributes: { ...existingSettings, ...updates } })

      const result = await repository.updatePrivacySettings('test@example.com', updates)

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should create new settings if none exist', async () => {
      const updates = { showPhone: 'authenticated' as VisibilityLevel }

      mockSend.mockResolvedValueOnce({ Item: null }) // No existing settings
      mockSend.mockResolvedValueOnce({}) // Put

      const result = await repository.updatePrivacySettings('new@example.com', updates)

      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('createPrivacySettings', () => {
    it('should create privacy settings with defaults', async () => {
      mockSend.mockResolvedValueOnce({})

      await repository.createPrivacySettings('new@example.com')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should create privacy settings with custom values', async () => {
      mockSend.mockResolvedValueOnce({})

      await repository.createPrivacySettings('new@example.com', {
        showPhone: 'authenticated',
        allowContactRequests: false,
      })

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('canViewField', () => {
    it('should always allow user to view their own data', async () => {
      const result = await repository.canViewField(
        'user@example.com',
        'user@example.com',
        'showPhone'
      )

      expect(result).toBe(true)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('should allow authenticated users to view "authenticated" fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          pkey: 'USER#target@example.com',
          skey: 'PRIVACY_SETTINGS',
          showName: 'authenticated',
        },
      })

      const result = await repository.canViewField(
        'viewer@example.com',
        'target@example.com',
        'showName'
      )

      expect(result).toBe(true)
    })

    it('should allow same ecclesia members to view "ecclesia_and_connections" fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          pkey: 'USER#target@example.com',
          skey: 'PRIVACY_SETTINGS',
          showEmail: 'ecclesia_and_connections',
        },
      })

      const result = await repository.canViewField(
        'viewer@example.com',
        'target@example.com',
        'showEmail',
        'Toronto East',
        'Toronto East'
      )

      expect(result).toBe(true)
    })

    it('should allow connections to view "ecclesia_and_connections" fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          pkey: 'USER#target@example.com',
          skey: 'PRIVACY_SETTINGS',
          showEmail: 'ecclesia_and_connections',
        },
      })
      mockIsConnected.mockResolvedValueOnce(true)

      const result = await repository.canViewField(
        'viewer@example.com',
        'target@example.com',
        'showEmail',
        'Different Ecclesia',
        'Toronto East'
      )

      expect(result).toBe(true)
      expect(mockIsConnected).toHaveBeenCalledWith('target@example.com', 'viewer@example.com')
    })

    it('should only allow connections to view "connections_only" fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          pkey: 'USER#target@example.com',
          skey: 'PRIVACY_SETTINGS',
          showFamily: 'connections_only',
        },
      })
      mockIsConnected.mockResolvedValueOnce(true)

      const result = await repository.canViewField(
        'viewer@example.com',
        'target@example.com',
        'showFamily'
      )

      expect(result).toBe(true)
    })

    it('should deny access to "private" fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          pkey: 'USER#target@example.com',
          skey: 'PRIVACY_SETTINGS',
          showPhone: 'private',
        },
      })

      const result = await repository.canViewField(
        'viewer@example.com',
        'target@example.com',
        'showPhone'
      )

      expect(result).toBe(false)
    })

    it('should deny non-connections for "connections_only" fields', async () => {
      mockSend.mockResolvedValueOnce({
        Item: {
          pkey: 'USER#target@example.com',
          skey: 'PRIVACY_SETTINGS',
          showFamily: 'connections_only',
        },
      })
      mockIsConnected.mockResolvedValueOnce(false)

      const result = await repository.canViewField(
        'stranger@example.com',
        'target@example.com',
        'showFamily'
      )

      expect(result).toBe(false)
    })
  })

  describe('getVisibleFields', () => {
    it('should return all true for user viewing own profile', async () => {
      const result = await repository.getVisibleFields(
        'user@example.com',
        'user@example.com'
      )

      expect(result).toEqual({
        canViewName: true,
        canViewPhone: true,
        canViewAddress: true,
        canViewEmail: true,
        canViewFamily: true,
        canRequestContact: false, // Can't request contact from yourself
      })
    })

    it('should check visibility for each field', async () => {
      // Mock getPrivacySettings call for each canViewField
      const mockSettings = {
        pkey: 'USER#target@example.com',
        skey: 'PRIVACY_SETTINGS',
        showName: 'authenticated',
        showPhone: 'private',
        showAddress: 'private',
        showEmail: 'ecclesia_and_connections',
        showFamily: 'connections_only',
        allowContactRequests: true,
      }

      // Called multiple times for canViewField
      mockSend.mockResolvedValue({ Item: mockSettings })
      mockIsConnected.mockResolvedValue(false)

      const result = await repository.getVisibleFields(
        'viewer@example.com',
        'target@example.com',
        'Different Ecclesia',
        'Toronto East'
      )

      expect(result.canViewName).toBe(true) // authenticated
      expect(result.canViewPhone).toBe(false) // private
      expect(result.canViewAddress).toBe(false) // private
      expect(result.canViewEmail).toBe(false) // different ecclesia, not connected
      expect(result.canViewFamily).toBe(false) // not connected
      expect(result.canRequestContact).toBe(true)
    })
  })
})
