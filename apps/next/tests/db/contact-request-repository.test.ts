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

import { ContactRequestRepository } from '@my/app/provider/dynamodb/repositories/contact-request-repository'

describe('ContactRequestRepository', () => {
  let repository: ContactRequestRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new ContactRequestRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createRequest', () => {
    it('should create contact request', async () => {
      mockSend.mockResolvedValueOnce({})

      const result = await repository.createRequest(
        'requester@example.com',
        'recipient@example.com',
        'email',
        'Hi, I would like to connect'
      )

      expect((result as any).pkey).toBe('USER#recipient@example.com')
      expect((result as any).skey).toMatch(/^CONTACT_REQUEST#/)
      expect(result.requestId).toBeDefined()
      expect(result.requesterEmail).toBe('requester@example.com')
      expect(result.recipientEmail).toBe('recipient@example.com')
      expect(result.requestType).toBe('email')
      expect(result.message).toBe('Hi, I would like to connect')
      expect(result.status).toBe('pending')
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should create request without message', async () => {
      mockSend.mockResolvedValueOnce({})

      const result = await repository.createRequest(
        'requester@example.com',
        'recipient@example.com',
        'phone'
      )

      expect(result.message).toBeUndefined()
      expect(result.requestType).toBe('phone')
    })

    it('should include timestamps', async () => {
      mockSend.mockResolvedValueOnce({})

      const result = await repository.createRequest(
        'requester@example.com',
        'recipient@example.com',
        'email'
      )

      expect(result.createdAt).toBeDefined()
      expect(result.lastUpdated).toBeDefined()
    })
  })

  describe('getReceivedRequests', () => {
    it('should query all contact requests for a recipient', async () => {
      const mockRequests = [
        {
          pkey: 'USER#recipient@example.com',
          skey: 'CONTACT_REQUEST#123',
          requesterEmail: 'user1@example.com',
          status: 'pending',
        },
        {
          pkey: 'USER#recipient@example.com',
          skey: 'CONTACT_REQUEST#456',
          requesterEmail: 'user2@example.com',
          status: 'viewed',
        },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRequests })

      const result = await repository.getReceivedRequests('recipient@example.com')

      expect(result.items).toEqual(mockRequests)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('getPendingRequests', () => {
    it('should return only pending requests', async () => {
      const mockRequests = [
        { requesterEmail: 'user1@example.com', status: 'pending' },
        { requesterEmail: 'user2@example.com', status: 'viewed' },
        { requesterEmail: 'user3@example.com', status: 'pending' },
        { requesterEmail: 'user4@example.com', status: 'responded' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRequests })

      const result = await repository.getPendingRequests('recipient@example.com')

      expect(result).toHaveLength(2)
      expect(result.every(r => r.status === 'pending')).toBe(true)
    })
  })

  describe('getRequest', () => {
    it('should get specific contact request', async () => {
      const mockRequest = {
        pkey: 'USER#recipient@example.com',
        skey: 'CONTACT_REQUEST#req-123',
        requestId: 'req-123',
        requesterEmail: 'requester@example.com',
        status: 'pending',
      }
      mockSend.mockResolvedValueOnce({ Item: mockRequest })

      const result = await repository.getRequest('recipient@example.com', 'req-123')

      expect(result).toEqual(mockRequest)
    })

    it('should return null when request not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: null })

      const result = await repository.getRequest('recipient@example.com', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('updateRequestStatus', () => {
    it('should update request status', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { status: 'viewed' },
      })

      const result = await repository.updateRequestStatus(
        'recipient@example.com',
        'req-123',
        'viewed'
      )

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('markAsViewed', () => {
    it('should mark request as viewed', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { status: 'viewed' },
      })

      await repository.markAsViewed('recipient@example.com', 'req-123')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('markAsResponded', () => {
    it('should mark request as responded', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { status: 'responded' },
      })

      await repository.markAsResponded('recipient@example.com', 'req-123')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('declineRequest', () => {
    it('should decline request', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { status: 'declined' },
      })

      await repository.declineRequest('recipient@example.com', 'req-123')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteRequest', () => {
    it('should delete contact request', async () => {
      mockSend.mockResolvedValueOnce({})

      await repository.deleteRequest('recipient@example.com', 'req-123')

      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })

  describe('getUnreadCount', () => {
    it('should return count of pending requests', async () => {
      const mockRequests = [
        { status: 'pending' },
        { status: 'viewed' },
        { status: 'pending' },
        { status: 'responded' },
        { status: 'pending' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRequests })

      const result = await repository.getUnreadCount('recipient@example.com')

      expect(result).toBe(3)
    })

    it('should return 0 when no pending requests', async () => {
      mockSend.mockResolvedValueOnce({ Items: [{ status: 'responded' }] })

      const result = await repository.getUnreadCount('recipient@example.com')

      expect(result).toBe(0)
    })
  })

  describe('hasPendingRequest', () => {
    it('should return true when pending request exists', async () => {
      const mockRequests = [
        { requesterEmail: 'other@example.com', status: 'responded' },
        { requesterEmail: 'requester@example.com', status: 'pending' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRequests })

      const result = await repository.hasPendingRequest(
        'requester@example.com',
        'recipient@example.com'
      )

      expect(result).toBe(true)
    })

    it('should return false when no pending request from requester', async () => {
      const mockRequests = [
        { requesterEmail: 'other@example.com', status: 'pending' },
        { requesterEmail: 'requester@example.com', status: 'responded' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRequests })

      const result = await repository.hasPendingRequest(
        'requester@example.com',
        'recipient@example.com'
      )

      expect(result).toBe(false)
    })

    it('should return false when no requests exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.hasPendingRequest(
        'requester@example.com',
        'recipient@example.com'
      )

      expect(result).toBe(false)
    })
  })

  describe('getSentRequests', () => {
    it('should scan for requests sent by user', async () => {
      const mockRequests = [
        { requesterEmail: 'sender@example.com', recipientEmail: 'user1@example.com' },
        { requesterEmail: 'sender@example.com', recipientEmail: 'user2@example.com' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRequests })

      const result = await repository.getSentRequests('sender@example.com')

      expect(result).toEqual(mockRequests)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })
  })
})
