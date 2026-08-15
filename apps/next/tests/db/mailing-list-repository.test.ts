import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DynamoDB document client (same pattern as post-repository.test.ts).
const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }))

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  QueryCommand: vi.fn().mockImplementation((params) => ({ type: 'QueryCommand', params })),
  PutCommand: vi.fn().mockImplementation((params) => ({ type: 'PutCommand', params })),
  GetCommand: vi.fn().mockImplementation((params) => ({ type: 'GetCommand', params })),
  UpdateCommand: vi.fn().mockImplementation((params) => ({ type: 'UpdateCommand', params })),
  DeleteCommand: vi.fn().mockImplementation((params) => ({ type: 'DeleteCommand', params })),
  ScanCommand: vi.fn().mockImplementation((params) => ({ type: 'ScanCommand', params })),
  BatchWriteCommand: vi.fn().mockImplementation((params) => ({ type: 'BatchWriteCommand', params })),
}))

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn() }))

vi.mock('uuid', () => ({ v4: vi.fn(() => 'test-list-uuid') }))

import { MailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import type { MailingListRecord, ListSubscriptionRecord } from '@my/app/provider/dynamodb/types'

/** A stored MailingListRecord as DynamoDB would return it. */
function storedList(overrides: Partial<MailingListRecord> = {}): MailingListRecord {
  const listId = overrides.listId || 'l1'
  const scope = overrides.scope || 'ecclesia'
  const scopeValue = overrides.scopeValue ?? 'Toronto East Ecclesia'
  const ownerName = overrides.ownerName || 'Toronto East Ecclesia'
  const name = overrides.name || 'Newsletter'
  return {
    pkey: `LIST#${listId}`,
    skey: 'DETAILS',
    gsi1pk: `TENANT#ecclesia#${ownerName}`,
    gsi1sk: `${scope}#${name}`,
    gsi2pk: `SCOPE#${scope}#${scopeValue}`,
    gsi2sk: `${ownerName}#${name}`,
    listId,
    ownerType: 'ecclesia',
    ownerName,
    scope,
    scopeValue,
    category: 'newsletters',
    key: 'newsletter',
    name,
    description: 'desc',
    defaultOptIn: false,
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    lastUpdated: '2026-08-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  }
}

describe('MailingListRepository', () => {
  let repo: MailingListRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new MailingListRepository()
  })

  describe('createList', () => {
    it('writes ONE item with the LIST# key scheme + tenant/scope GSIs', async () => {
      mockSend.mockResolvedValueOnce({}) // put

      const result = await repo.createList({
        ownerType: 'ecclesia',
        ownerName: 'Toronto East Ecclesia',
        scope: 'ecclesia',
        scopeValue: 'Toronto East Ecclesia',
        category: 'newsletters',
        key: 'newsletter',
        name: 'Newsletter',
        description: 'Weekly newsletter.',
        sesTopic: 'newsletter',
      })

      expect(mockSend).toHaveBeenCalledTimes(1)
      const put = mockSend.mock.calls[0][0]
      expect(put.type).toBe('PutCommand')
      expect(put.params.TableName).toBe('tee-admin')
      expect(put.params.Item).toMatchObject({
        pkey: 'LIST#test-list-uuid',
        skey: 'DETAILS',
        gsi1pk: 'TENANT#ecclesia#Toronto East Ecclesia',
        gsi1sk: 'ecclesia#Newsletter',
        gsi2pk: 'SCOPE#ecclesia#Toronto East Ecclesia',
        gsi2sk: 'Toronto East Ecclesia#Newsletter',
        listId: 'test-list-uuid',
        category: 'newsletters',
        status: 'active',
        defaultOptIn: false,
        sesTopic: 'newsletter',
      })
      expect(result.listId).toBe('test-list-uuid')
    })

    it('global scope uses an empty scopeValue and omits sesTopic when absent', async () => {
      mockSend.mockResolvedValueOnce({})
      await repo.createList({
        ownerType: 'organization',
        ownerName: 'Some Org',
        scope: 'global',
        scopeValue: '',
        category: 'newsletters',
        key: 'digest',
        name: 'Global Digest',
        description: 'x',
      })
      const item = mockSend.mock.calls[0][0].params.Item
      expect(item.gsi2pk).toBe('SCOPE#global#')
      expect(item).not.toHaveProperty('sesTopic')
    })
  })

  describe('getList', () => {
    it('reads by LIST# key', async () => {
      mockSend.mockResolvedValueOnce({ Item: storedList() })
      const result = await repo.getList('l1')
      const get = mockSend.mock.calls[0][0]
      expect(get.type).toBe('GetCommand')
      expect(get.params.Key).toEqual({ pkey: 'LIST#l1', skey: 'DETAILS' })
      expect(result?.listId).toBe('l1')
    })
  })

  describe('listByTenant', () => {
    it('queries gsi1 by TENANT# key', async () => {
      mockSend.mockResolvedValueOnce({ Items: [storedList()] })
      await repo.listByTenant('ecclesia', 'Toronto East Ecclesia')
      const q = mockSend.mock.calls[0][0]
      expect(q.params.IndexName).toBe('gsi1')
      expect(q.params.ExpressionAttributeValues).toMatchObject({
        ':gsi1pk': 'TENANT#ecclesia#Toronto East Ecclesia',
      })
    })
  })

  describe('listByScope', () => {
    it('queries gsi2 by SCOPE# key and drops archived lists', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          storedList({ listId: 'a', status: 'active' }),
          storedList({ listId: 'b', status: 'archived' }),
        ],
      })
      const lists = await repo.listByScope('ecclesia', 'Toronto East Ecclesia')
      const q = mockSend.mock.calls[0][0]
      expect(q.params.IndexName).toBe('gsi2')
      expect(q.params.ExpressionAttributeValues).toMatchObject({
        ':gsi2pk': 'SCOPE#ecclesia#Toronto East Ecclesia',
      })
      expect(lists.map((l) => l.listId)).toEqual(['a'])
    })
  })

  describe('getOfferedListsForPerson', () => {
    it('unions ecclesia/region/continent/global and dedupes by listId', async () => {
      // Queries fire in order: ecclesia, region, continent, global.
      mockSend
        .mockResolvedValueOnce({ Items: [storedList({ listId: 'ecc' })] }) // ecclesia
        .mockResolvedValueOnce({ Items: [storedList({ listId: 'reg', scope: 'region' })] }) // region
        .mockResolvedValueOnce({ Items: [storedList({ listId: 'con', scope: 'continent' })] }) // continent
        .mockResolvedValueOnce({
          Items: [
            storedList({ listId: 'glob', scope: 'global' }),
            storedList({ listId: 'ecc' }), // duplicate across scopes
          ],
        }) // global

      const lists = await repo.getOfferedListsForPerson(
        { ecclesia: 'Toronto East Ecclesia' },
        'canada_east'
      )

      expect(mockSend).toHaveBeenCalledTimes(4)
      // canada_east rolls up to the 'canada' continent.
      const continentQuery = mockSend.mock.calls[2][0]
      expect(continentQuery.params.ExpressionAttributeValues[':gsi2pk']).toBe(
        'SCOPE#continent#canada'
      )
      // Global query uses the empty scopeValue.
      expect(mockSend.mock.calls[3][0].params.ExpressionAttributeValues[':gsi2pk']).toBe(
        'SCOPE#global#'
      )
      expect(lists.map((l) => l.listId).sort()).toEqual(['con', 'ecc', 'glob', 'reg'])
    })

    it('skips region/continent scopes when region is unknown (ecclesia + global only)', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [storedList({ listId: 'ecc' })] }) // ecclesia
        .mockResolvedValueOnce({ Items: [] }) // global

      await repo.getOfferedListsForPerson({ ecclesia: 'Toronto East Ecclesia' }, null)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })
  })

  describe('subscribe', () => {
    it('upserts an opt_in row keyed PERSON#/SUB# with the LISTSUB# GSI', async () => {
      mockSend.mockResolvedValueOnce({}) // put
      const result = await repo.subscribe({
        personId: 'p1',
        listId: 'l1',
        emailId: 'e1',
        email: 'Test@Example.com',
        source: 'self',
        basis: 'express',
      })
      const put = mockSend.mock.calls[0][0]
      expect(put.type).toBe('PutCommand')
      expect(put.params.Item).toMatchObject({
        pkey: 'PERSON#p1',
        skey: 'SUB#l1#e1',
        gsi1pk: 'LISTSUB#l1',
        gsi1sk: 'test@example.com', // lowercased
        status: 'opt_in',
        source: 'self',
        basis: 'express',
      })
      expect(result.email).toBe('test@example.com')
    })
  })

  describe('unsubscribe', () => {
    it('flips status to opt_out via update (keeps the row — no delete)', async () => {
      mockSend.mockResolvedValueOnce({
        Attributes: { pkey: 'PERSON#p1', skey: 'SUB#l1#e1', status: 'opt_out' },
      })
      const result = await repo.unsubscribe({ personId: 'p1', listId: 'l1', emailId: 'e1' })
      const call = mockSend.mock.calls[0][0]
      expect(call.type).toBe('UpdateCommand')
      expect(call.params.Key).toEqual({ pkey: 'PERSON#p1', skey: 'SUB#l1#e1' })
      expect(Object.values(call.params.ExpressionAttributeValues)).toContain('opt_out')
      expect((result as ListSubscriptionRecord).status).toBe('opt_out')
      // Never a delete.
      expect(mockSend.mock.calls.every((c) => c[0].type !== 'DeleteCommand')).toBe(true)
    })
  })

  describe('getPersonSubscriptions', () => {
    it('queries the base table for SUB# rows under the person', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [{ pkey: 'PERSON#p1', skey: 'SUB#l1#e1', status: 'opt_in' }],
      })
      await repo.getPersonSubscriptions('p1')
      const q = mockSend.mock.calls[0][0]
      expect(q.type).toBe('QueryCommand')
      expect(q.params.ExpressionAttributeValues).toMatchObject({
        ':pk': 'PERSON#p1',
        ':skPrefix': 'SUB#',
      })
    })
  })

  describe('listSubscribers', () => {
    it('queries the LISTSUB# GSI and returns only opt_in rows', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { pkey: 'PERSON#a', skey: 'SUB#l1#e', listId: 'l1', status: 'opt_in', email: 'a@x.com' },
          { pkey: 'PERSON#b', skey: 'SUB#l1#e', listId: 'l1', status: 'opt_out', email: 'b@x.com' },
        ],
      })
      const subs = await repo.listSubscribers('l1')
      const q = mockSend.mock.calls[0][0]
      expect(q.params.IndexName).toBe('gsi1')
      expect(q.params.ExpressionAttributeValues).toMatchObject({ ':gsi1pk': 'LISTSUB#l1' })
      expect(subs.map((s) => s.email)).toEqual(['a@x.com'])
    })
  })
})
