import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock DynamoDB
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
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(),
}))

import { ConnectionRepository } from '@my/app/provider/dynamodb/repositories/connection-repository'

describe('ConnectionRepository', () => {
  let repository: ConnectionRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new ConnectionRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addConnection', () => {
    it('should create connection record', async () => {
      mockSend.mockResolvedValueOnce({})

      await repository.addConnection('user@example.com', 'friend@example.com')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('removeConnection', () => {
    it('should delete connection by target email', async () => {
      mockSend.mockResolvedValueOnce({})

      await repository.removeConnection('user@example.com', 'friend@example.com')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('getConnections', () => {
    it('should query all connections for a user', async () => {
      const mockConnections = [
        { targetEmail: 'friend1@example.com', status: 'active' },
        { targetEmail: 'friend2@example.com', status: 'active' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockConnections })

      const result = await repository.getConnections('user@example.com')

      expect(result.items).toEqual(mockConnections)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('getActiveConnections', () => {
    it('should return only active connections', async () => {
      const mockConnections = [
        { targetEmail: 'active@example.com', status: 'active' },
        { targetEmail: 'blocked@example.com', status: 'blocked' },
        { targetEmail: 'pending@example.com', status: 'pending' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockConnections })

      const result = await repository.getActiveConnections('user@example.com')

      expect(result).toHaveLength(1)
      expect(result[0].targetEmail).toBe('active@example.com')
    })
  })

  describe('isConnected', () => {
    it('should return true when active connection exists', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { targetEmail: 'friend@example.com', status: 'active' },
      })

      const result = await repository.isConnected('user@example.com', 'friend@example.com')

      expect(result).toBe(true)
    })

    it('should return false when connection is blocked', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { targetEmail: 'blocked@example.com', status: 'blocked' },
      })

      const result = await repository.isConnected('user@example.com', 'blocked@example.com')

      expect(result).toBe(false)
    })

    it('should return false when no connection exists', async () => {
      mockSend.mockResolvedValueOnce({ Item: null })

      const result = await repository.isConnected('user@example.com', 'stranger@example.com')

      expect(result).toBe(false)
    })
  })

  describe('getConnection', () => {
    it('should get specific connection', async () => {
      const mockConnection = {
        pkey: 'USER#user@example.com',
        skey: 'CONNECTION#friend@example.com',
        targetEmail: 'friend@example.com',
        status: 'active',
      }
      mockSend.mockResolvedValueOnce({ Item: mockConnection })

      const result = await repository.getConnection('user@example.com', 'friend@example.com')

      expect(result).toEqual(mockConnection)
    })

    it('should return null when connection not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: null })

      const result = await repository.getConnection('user@example.com', 'stranger@example.com')

      expect(result).toBeNull()
    })
  })

  describe('blockConnection', () => {
    it('should update existing connection to blocked', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { targetEmail: 'friend@example.com', status: 'active' },
      })
      mockSend.mockResolvedValueOnce({ Attributes: {} })

      await repository.blockConnection('user@example.com', 'friend@example.com')

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should create blocked connection if none exists', async () => {
      mockSend.mockResolvedValueOnce({ Item: null }) // getConnection returns null
      mockSend.mockResolvedValueOnce({}) // put

      await repository.blockConnection('user@example.com', 'enemy@example.com')

      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('unblockConnection', () => {
    it('should delete blocked connection', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { targetEmail: 'blocked@example.com', status: 'blocked' },
      })
      mockSend.mockResolvedValueOnce({})

      await repository.unblockConnection('user@example.com', 'blocked@example.com')

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should not delete non-blocked connection', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { targetEmail: 'friend@example.com', status: 'active' },
      })

      await repository.unblockConnection('user@example.com', 'friend@example.com')

      expect(mockSend).toHaveBeenCalledTimes(1) // Only the get, no delete
    })
  })

  describe('isBlocked', () => {
    it('should return true when connection is blocked', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { status: 'blocked' },
      })

      const result = await repository.isBlocked('user@example.com', 'enemy@example.com')

      expect(result).toBe(true)
    })

    it('should return false when connection is not blocked', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { status: 'active' },
      })

      const result = await repository.isBlocked('user@example.com', 'friend@example.com')

      expect(result).toBe(false)
    })

    it('should return false when no connection exists', async () => {
      mockSend.mockResolvedValueOnce({ Item: null })

      const result = await repository.isBlocked('user@example.com', 'stranger@example.com')

      expect(result).toBe(false)
    })
  })

  describe('getBlockedUsers', () => {
    it('should return list of blocked user emails', async () => {
      const mockConnections = [
        { targetEmail: 'blocked1@example.com', status: 'blocked' },
        { targetEmail: 'friend@example.com', status: 'active' },
        { targetEmail: 'blocked2@example.com', status: 'blocked' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockConnections })

      const result = await repository.getBlockedUsers('user@example.com')

      expect(result).toEqual(['blocked1@example.com', 'blocked2@example.com'])
    })
  })

  describe('updateConnectionStatus', () => {
    it('should update connection status', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { targetEmail: 'friend@example.com', status: 'pending' },
      })

      const result = await repository.updateConnectionStatus(
        'user@example.com',
        'friend@example.com',
        'pending'
      )

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })
})
