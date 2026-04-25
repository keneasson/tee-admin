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

import { RelationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import type { RelationshipType } from '@my/app/provider/dynamodb/types'

describe('RelationshipRepository', () => {
  let repository: RelationshipRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new RelationshipRepository()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createRelationship', () => {
    it('should create bidirectional relationship records', async () => {
      mockSend.mockResolvedValue({})

      await repository.createRelationship(
        'parent@example.com',
        'child@example.com',
        'parent'
      )

      // Should create 2 records (forward and inverse)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should create spouse relationship with same inverse type', async () => {
      mockSend.mockResolvedValue({})

      await repository.createRelationship(
        'person1@example.com',
        'person2@example.com',
        'spouse'
      )

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should create sibling relationship with same inverse type', async () => {
      mockSend.mockResolvedValue({})

      await repository.createRelationship(
        'sibling1@example.com',
        'sibling2@example.com',
        'sibling'
      )

      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('should handle grandparent/grandchild inverse correctly', async () => {
      mockSend.mockResolvedValue({})

      await repository.createRelationship(
        'grandparent@example.com',
        'grandchild@example.com',
        'grandparent'
      )

      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('getRelationships', () => {
    it('should query all relationships for a user', async () => {
      const mockRelationships = [
        {
          pkey: 'USER#test@example.com',
          skey: 'RELATIONSHIP#spouse@example.com#spouse',
          targetEmail: 'spouse@example.com',
          relationshipType: 'spouse',
          status: 'active',
        },
        {
          pkey: 'USER#test@example.com',
          skey: 'RELATIONSHIP#child@example.com#parent',
          targetEmail: 'child@example.com',
          relationshipType: 'parent',
          status: 'active',
        },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRelationships })

      const result = await repository.getRelationships('test@example.com')

      expect(result.items).toEqual(mockRelationships)
      expect(mockSend).toHaveBeenCalledTimes(1)
    })

    it('should return empty array when no relationships', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.getRelationships('lonely@example.com')

      expect(result.items).toEqual([])
    })
  })

  describe('getRelationshipsByType', () => {
    it('should filter relationships by type', async () => {
      const mockRelationships = [
        { targetEmail: 'spouse@example.com', relationshipType: 'spouse', status: 'active' },
        { targetEmail: 'child1@example.com', relationshipType: 'parent', status: 'active' },
        { targetEmail: 'child2@example.com', relationshipType: 'parent', status: 'active' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRelationships })

      const result = await repository.getRelationshipsByType('test@example.com', 'parent')

      expect(result.items).toHaveLength(2)
      expect(result.items.every(r => r.relationshipType === 'parent')).toBe(true)
    })
  })

  describe('hasRelationship', () => {
    it('should return true when relationship exists', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { targetEmail: 'spouse@example.com', relationshipType: 'spouse', status: 'active' },
        ],
      })

      const result = await repository.hasRelationship(
        'test@example.com',
        'spouse@example.com',
        'spouse'
      )

      expect(result).toBe(true)
    })

    it('should return false when relationship does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })

      const result = await repository.hasRelationship(
        'test@example.com',
        'stranger@example.com',
        'spouse'
      )

      expect(result).toBe(false)
    })

    it('should return true for any relationship type when type not specified', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { targetEmail: 'friend@example.com', relationshipType: 'sibling', status: 'active' },
        ],
      })

      const result = await repository.hasRelationship(
        'test@example.com',
        'friend@example.com'
      )

      expect(result).toBe(true)
    })
  })

  describe('removeRelationship', () => {
    it('should soft delete both relationship records', async () => {
      mockSend.mockResolvedValue({ Attributes: {} })

      await repository.removeRelationship(
        'parent@example.com',
        'child@example.com',
        'parent'
      )

      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('deleteRelationship', () => {
    it('should permanently delete both relationship records', async () => {
      mockSend.mockResolvedValue({})

      await repository.deleteRelationship(
        'person1@example.com',
        'person2@example.com',
        'spouse'
      )

      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('getFamilyMembers', () => {
    it('should return only active relationships', async () => {
      const mockRelationships = [
        { targetEmail: 'active@example.com', status: 'active' },
        { targetEmail: 'removed@example.com', status: 'removed' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRelationships })

      const result = await repository.getFamilyMembers('test@example.com')

      expect(result).toHaveLength(1)
      expect(result[0].targetEmail).toBe('active@example.com')
    })
  })

  describe('getImmediateFamily', () => {
    it('should return only spouse, parent, and child relationships', async () => {
      const mockRelationships = [
        { targetEmail: 'spouse@example.com', relationshipType: 'spouse', status: 'active' },
        { targetEmail: 'child@example.com', relationshipType: 'parent', status: 'active' },
        { targetEmail: 'grandchild@example.com', relationshipType: 'grandparent', status: 'active' },
        { targetEmail: 'sibling@example.com', relationshipType: 'sibling', status: 'active' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRelationships })

      const result = await repository.getImmediateFamily('test@example.com')

      expect(result).toHaveLength(2)
      expect(result.map(r => r.targetEmail)).toContain('spouse@example.com')
      expect(result.map(r => r.targetEmail)).toContain('child@example.com')
    })
  })

  describe('getHouseholdMembers', () => {
    it('should return spouse and household_member relationships', async () => {
      const mockRelationships = [
        { targetEmail: 'spouse@example.com', relationshipType: 'spouse', status: 'active' },
        { targetEmail: 'roommate@example.com', relationshipType: 'household_member', status: 'active' },
        { targetEmail: 'child@example.com', relationshipType: 'parent', status: 'active' },
      ]
      mockSend.mockResolvedValueOnce({ Items: mockRelationships })

      const result = await repository.getHouseholdMembers('test@example.com')

      expect(result).toHaveLength(2)
      expect(result.map(r => r.targetEmail)).toContain('spouse@example.com')
      expect(result.map(r => r.targetEmail)).toContain('roommate@example.com')
    })
  })
})
