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
  const scopeValue = overrides.scopeValue ?? 'toronto-east-ecclesia'
  const ownerId = overrides.ownerId || 'toronto-east-ecclesia'
  const name = overrides.name || 'Newsletter'
  return {
    pkey: `LIST#${listId}`,
    skey: 'DETAILS',
    gsi1pk: `TENANT#ecclesia#${ownerId}`,
    gsi1sk: `${scope}#${name}`,
    gsi2pk: `SCOPE#${scope}#${scopeValue}`,
    gsi2sk: `${ownerId}#${name}`,
    gsi4pk: 'MAILING_LISTS',
    gsi4sk: `ecclesia#${ownerId}#${name}`,
    listId,
    ownerType: 'ecclesia',
    ownerId,
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
    it('writes ONE item keyed by owner ID (never name) with tenant/scope/all-lists GSIs', async () => {
      mockSend.mockResolvedValueOnce({}) // put

      const result = await repo.createList({
        ownerType: 'ecclesia',
        ownerId: 'toronto-east-ecclesia',
        scope: 'ecclesia',
        scopeValue: 'toronto-east-ecclesia',
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
        gsi1pk: 'TENANT#ecclesia#toronto-east-ecclesia',
        gsi1sk: 'ecclesia#Newsletter',
        gsi2pk: 'SCOPE#ecclesia#toronto-east-ecclesia',
        gsi2sk: 'toronto-east-ecclesia#Newsletter',
        gsi4pk: 'MAILING_LISTS',
        gsi4sk: 'ecclesia#toronto-east-ecclesia#Newsletter',
        listId: 'test-list-uuid',
        ownerId: 'toronto-east-ecclesia',
        category: 'newsletters',
        status: 'active',
        defaultOptIn: false,
        sesTopic: 'newsletter',
      })
      expect(result.listId).toBe('test-list-uuid')
      expect(put.params.Item).not.toHaveProperty('ownerName')
      expect(put.params.Item).not.toHaveProperty('sendFromRegistry') // cutover default OFF
    })

    it('refuses a list with no owner id', async () => {
      await expect(
        repo.createList({
          ownerType: 'ecclesia',
          ownerId: '',
          scope: 'global',
          scopeValue: '',
          category: 'newsletters',
          key: 'x',
          name: 'X',
          description: '',
        })
      ).rejects.toThrow(/ownerId/)
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('global scope uses an empty scopeValue and omits sesTopic when absent', async () => {
      mockSend.mockResolvedValueOnce({})
      await repo.createList({
        ownerType: 'organization',
        ownerId: 'some-org',
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
      await repo.listByTenant('ecclesia', 'toronto-east-ecclesia')
      const q = mockSend.mock.calls[0][0]
      expect(q.params.IndexName).toBe('gsi1')
      expect(q.params.ExpressionAttributeValues).toMatchObject({
        ':gsi1pk': 'TENANT#ecclesia#toronto-east-ecclesia',
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
      const lists = await repo.listByScope('ecclesia', 'toronto-east-ecclesia')
      const q = mockSend.mock.calls[0][0]
      expect(q.params.IndexName).toBe('gsi2')
      expect(q.params.ExpressionAttributeValues).toMatchObject({
        ':gsi2pk': 'SCOPE#ecclesia#toronto-east-ecclesia',
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
        { ecclesiaId: 'toronto-east-ecclesia' },
        'canada_east'
      )

      expect(mockSend).toHaveBeenCalledTimes(4)
      expect(mockSend.mock.calls[0][0].params.ExpressionAttributeValues[':gsi2pk']).toBe(
        'SCOPE#ecclesia#toronto-east-ecclesia'
      )
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

      await repo.getOfferedListsForPerson({ ecclesiaId: 'toronto-east-ecclesia' }, null)
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
        email: 'Test@Example.org',
        source: 'self',
        basis: 'express',
      })
      const put = mockSend.mock.calls[0][0]
      expect(put.type).toBe('PutCommand')
      expect(put.params.Item).toMatchObject({
        pkey: 'PERSON#p1',
        skey: 'SUB#l1#e1',
        gsi1pk: 'LISTSUB#l1',
        gsi1sk: 'test@example.org', // lowercased
        status: 'opt_in',
        source: 'self',
        basis: 'express',
      })
      expect(result.email).toBe('test@example.org')
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
          { pkey: 'PERSON#a', skey: 'SUB#l1#e', listId: 'l1', status: 'opt_in', email: 'a@example.org' },
          { pkey: 'PERSON#b', skey: 'SUB#l1#e', listId: 'l1', status: 'opt_out', email: 'b@example.org' },
        ],
      })
      const subs = await repo.listSubscribers('l1')
      const q = mockSend.mock.calls[0][0]
      expect(q.params.IndexName).toBe('gsi1')
      expect(q.params.ExpressionAttributeValues).toMatchObject({ ':gsi1pk': 'LISTSUB#l1' })
      expect(subs.map((s) => s.email)).toEqual(['a@example.org'])
    })
  })

  describe('pagination (a send audience must never be truncated)', () => {
    it('listSubscribers follows LastEvaluatedKey across pages', async () => {
      mockSend
        .mockResolvedValueOnce({
          Items: [{ pkey: 'PERSON#a', skey: 'SUB#l1#e', status: 'opt_in', email: 'a@example.org' }],
          LastEvaluatedKey: { k: 1 },
        })
        .mockResolvedValueOnce({
          Items: [{ pkey: 'PERSON#b', skey: 'SUB#l1#e', status: 'opt_in', email: 'b@example.org' }],
        })
      const subs = await repo.listSubscribers('l1')
      expect(mockSend).toHaveBeenCalledTimes(2)
      expect(mockSend.mock.calls[1][0].params.ExclusiveStartKey).toEqual({ k: 1 })
      expect(subs.map((s) => s.email)).toEqual(['a@example.org', 'b@example.org'])
    })
  })

  describe('listAllLists / findBySesTopic', () => {
    it('reads every list from the sparse gsi4 entry (no Scan)', async () => {
      mockSend.mockResolvedValueOnce({ Items: [storedList()] })
      await repo.listAllLists()
      const q = mockSend.mock.calls[0][0]
      expect(q.type).toBe('QueryCommand')
      expect(q.params.IndexName).toBe('gsi4')
      expect(q.params.ExpressionAttributeValues).toEqual({ ':pk': 'MAILING_LISTS' })
    })

    it('finds the single ACTIVE list bridging a topic', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          storedList({ listId: 'old', sesTopic: 'bibleClass', status: 'archived' }),
          storedList({ listId: 'bc', sesTopic: 'bibleClass' }),
          storedList({ listId: 'nl', sesTopic: 'newsletter' }),
        ],
      })
      expect((await repo.findBySesTopic('bibleClass'))?.listId).toBe('bc')
    })

    it('returns null when two active lists claim one topic (caller keeps the SES path)', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [storedList({ listId: 'a', sesTopic: 'newsletter' }), storedList({ listId: 'b', sesTopic: 'newsletter' })],
      })
      expect(await repo.findBySesTopic('newsletter')).toBeNull()
    })
  })

  describe('setSendFromRegistry', () => {
    it('updates only the cutover flag on the list item', async () => {
      mockSend.mockResolvedValueOnce({ Attributes: storedList({ sendFromRegistry: true }) })
      await repo.setSendFromRegistry('l1', true)
      const call = mockSend.mock.calls[0][0]
      expect(call.type).toBe('UpdateCommand')
      expect(call.params.Key).toEqual({ pkey: 'LIST#l1', skey: 'DETAILS' })
      expect(Object.values(call.params.ExpressionAttributeValues)).toContain(true)
    })
  })

  describe('getListSubscriptionsForEmail', () => {
    it('queries LISTSUB#<list> with the lower-cased address as the sort key', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      await repo.getListSubscriptionsForEmail('l1', 'Reader@Example.org')
      expect(mockSend.mock.calls[0][0].params.ExpressionAttributeValues).toEqual({
        ':gsi1pk': 'LISTSUB#l1',
        ':email': 'reader@example.org',
      })
    })
  })
})
