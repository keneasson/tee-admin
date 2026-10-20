import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn(() => ({ send: mockSend })) },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchWriteCommand', params })),
  TransactWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'TransactWriteCommand', params })),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

import {
  RelationshipRepository,
  INVERSE_RELATIONSHIP,
  RELATIONSHIP_TYPES,
  buildRelationshipPair,
} from '@my/app/provider/dynamodb/repositories/relationship-repository'

const row = (source: string, target: string, type: string, status = 'active') => ({
  pkey: `PERSON#${source}`,
  skey: `REL#${target}#${type}`,
  sourcePersonId: source,
  targetPersonId: target,
  relationshipType: type,
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
})

describe('RelationshipRepository (person-keyed)', () => {
  let repository: RelationshipRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new RelationshipRepository()
  })

  describe('createRelationship', () => {
    it('writes BOTH directions in ONE transaction, the inverse carrying the inverse type', async () => {
      mockSend.mockResolvedValue({})
      await repository.createRelationship('p-parent', 'p-child', 'parent')

      expect(mockSend).toHaveBeenCalledTimes(1)
      const cmd = mockSend.mock.calls[0][0]
      expect(cmd.type).toBe('TransactWriteCommand')
      const [forward, inverse] = cmd.params.TransactItems.map((t: any) => t.Put.Item)
      expect(forward).toMatchObject({
        pkey: 'PERSON#p-parent',
        skey: 'REL#p-child#parent',
        sourcePersonId: 'p-parent',
        targetPersonId: 'p-child',
        relationshipType: 'parent',
        status: 'active',
      })
      expect(inverse).toMatchObject({
        pkey: 'PERSON#p-child',
        skey: 'REL#p-parent#child',
        relationshipType: 'child',
      })
    })

    it('never keys a row by email', async () => {
      mockSend.mockResolvedValue({})
      await repository.createRelationship('p-a', 'p-b', 'spouse')
      const items = mockSend.mock.calls[0][0].params.TransactItems.map((t: any) => t.Put.Item)
      for (const item of items) {
        expect(item.pkey).toMatch(/^PERSON#/)
        expect(item.skey).toMatch(/^REL#/)
        expect(JSON.stringify(item)).not.toMatch(/@/)
      }
    })

    it('refuses a relationship with oneself', async () => {
      await expect(repository.createRelationship('p-a', 'p-a', 'sibling')).rejects.toThrow(/themselves/)
      expect(mockSend).not.toHaveBeenCalled()
    })
  })

  describe('reads by personId', () => {
    it('queries the person partition for REL# rows, across pages', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [row('p-a', 'p-b', 'spouse')], LastEvaluatedKey: { k: 1 } })
        .mockResolvedValueOnce({ Items: [row('p-a', 'p-c', 'child', 'removed')] })

      const rels = await repository.getRelationships('p-a')

      expect(rels).toHaveLength(2)
      const q = mockSend.mock.calls[0][0].params
      expect(q.KeyConditionExpression).toContain('begins_with(skey, :skPrefix)')
      expect(q.ExpressionAttributeValues).toEqual({ ':pk': 'PERSON#p-a', ':skPrefix': 'REL#' })
      expect(mockSend.mock.calls[1][0].params.ExclusiveStartKey).toEqual({ k: 1 })
    })

    it('getFamilyMembers returns active relationships only', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [row('p-a', 'p-b', 'spouse'), row('p-a', 'p-c', 'child', 'removed')],
      })
      const family = await repository.getFamilyMembers('p-a')
      expect(family.map((r) => r.targetPersonId)).toEqual(['p-b'])
    })

    it('hasRelationship matches on target personId and type', async () => {
      mockSend.mockResolvedValue({ Items: [row('p-a', 'p-b', 'spouse')] })
      expect(await repository.hasRelationship('p-a', 'p-b', 'spouse')).toBe(true)
      expect(await repository.hasRelationship('p-a', 'p-b', 'sibling')).toBe(false)
      expect(await repository.hasRelationship('p-a', 'p-x')).toBe(false)
    })
  })

  describe('removeRelationship', () => {
    it('marks both directions removed in one conditional transaction', async () => {
      mockSend.mockResolvedValue({})
      await repository.removeRelationship('p-gp', 'p-gc', 'grandparent')

      const cmd = mockSend.mock.calls[0][0]
      expect(cmd.type).toBe('TransactWriteCommand')
      const [a, b] = cmd.params.TransactItems.map((t: any) => t.Update)
      expect(a.Key).toEqual({ pkey: 'PERSON#p-gp', skey: 'REL#p-gc#grandparent' })
      expect(b.Key).toEqual({ pkey: 'PERSON#p-gc', skey: 'REL#p-gp#grandchild' })
      expect(a.ExpressionAttributeValues[':removed']).toBe('removed')
      expect(a.ConditionExpression).toBe('attribute_exists(pkey)')
    })
  })

  describe('inverse types', () => {
    it('every type has an inverse whose inverse is itself', () => {
      for (const type of RELATIONSHIP_TYPES) {
        expect(INVERSE_RELATIONSHIP[INVERSE_RELATIONSHIP[type]]).toBe(type)
      }
    })

    it('buildRelationshipPair keeps status and createdAt on both rows', () => {
      const [f, i] = buildRelationshipPair('p-a', 'p-b', 'child', 'removed', 'NOW', 'THEN')
      expect(f).toMatchObject({ status: 'removed', createdAt: 'THEN', lastUpdated: 'NOW', relationshipType: 'child' })
      expect(i).toMatchObject({ status: 'removed', createdAt: 'THEN', relationshipType: 'parent' })
    })
  })
})
