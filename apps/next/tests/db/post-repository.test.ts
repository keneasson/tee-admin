import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DynamoDB document client (same pattern as person-repository.test.ts).
// Use vi.hoisted so mockSend exists when vi.mock runs.
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
  v4: vi.fn(() => 'test-post-uuid'),
}))

import {
  PostRepository,
  type CreatePostInput,
} from '@my/app/provider/dynamodb/repositories/post-repository'
import type { Post } from '@my/app/types/post'

/** A stored PostRecord as DynamoDB would return it (keys + gsi + version). */
function storedRecord(overrides: Partial<Post> = {}): Record<string, any> {
  const post: Post = {
    id: 'p1',
    tenant: 'Toronto East',
    authorId: 'author-1',
    title: 'Baptism of Joshua',
    occasion: ['baptism'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: { publishDate: '2026-08-01T00:00:00.000Z' },
    blocks: [{ id: 'b1', kind: 'text', body: 'Rejoice', containsPii: false }],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    status: 'ready',
    ...overrides,
  }
  return {
    pkey: `POST#${post.tenant}`,
    skey: `POST#${post.id}`,
    gsi1pk: `POST#${post.id}`,
    gsi1sk: 'POST',
    gsi2pk: `POSTS#${post.tenant}`,
    gsi2sk: `${post.lifecycle.publishDate}#${post.id}`,
    version: 1,
    lastUpdated: post.updatedAt,
    ...post,
  }
}

describe('PostRepository', () => {
  let repository: PostRepository

  beforeEach(() => {
    // clearAllMocks resets call history but KEEPS the command-constructor
    // mockImplementations (restoreAllMocks would strip them, breaking the
    // command-shape assertions in later tests).
    vi.clearAllMocks()
    repository = new PostRepository()
  })

  describe('createPost', () => {
    it('writes ONE item with the POST# key scheme + overloaded GSIs, blocks embedded', async () => {
      mockSend.mockResolvedValueOnce({}) // put

      const input: CreatePostInput = {
        tenant: 'Toronto East',
        authorId: 'author-1',
        title: 'Baptism of Joshua',
        occasion: ['baptism'],
        visibility: 'public',
        sharingScope: 'own',
        lifecycle: { publishDate: '2026-08-01T00:00:00.000Z' },
        blocks: [{ id: 'b1', kind: 'text', body: 'Rejoice', containsPii: false }],
        status: 'ready',
      }

      const result = await repository.createPost(input)

      // ONE write only.
      expect(mockSend).toHaveBeenCalledTimes(1)

      // Key scheme is asserted on the actual PutCommand item.
      const putCall = mockSend.mock.calls[0][0]
      expect(putCall.type).toBe('PutCommand')
      expect(putCall.params.TableName).toBe('tee-admin')
      expect(putCall.params.Item).toMatchObject({
        pkey: 'POST#Toronto East',
        skey: 'POST#test-post-uuid',
        gsi1pk: 'POST#test-post-uuid',
        gsi1sk: 'POST',
        gsi2pk: 'POSTS#Toronto East',
        gsi2sk: '2026-08-01T00:00:00.000Z#test-post-uuid',
        id: 'test-post-uuid',
        tenant: 'Toronto East',
        status: 'ready',
      })
      // blocks embedded as a native list (not a JSON string).
      expect(Array.isArray(putCall.params.Item.blocks)).toBe(true)
      expect(putCall.params.Item.blocks[0]).toMatchObject({ id: 'b1', kind: 'text' })

      // Returned value is a clean domain Post (no storage keys leaked).
      expect(result).toMatchObject({ id: 'test-post-uuid', tenant: 'Toronto East', status: 'ready' })
      expect(result).not.toHaveProperty('pkey')
      expect(result).not.toHaveProperty('gsi1pk')
      expect(result.createdAt).toBe(result.updatedAt)
    })

    it('defaults status to draft, lifecycle/blocks to empty, sorts by createdAt when no publishDate', async () => {
      mockSend.mockResolvedValueOnce({})

      const result = await repository.createPost({
        tenant: 'Ecclesia B',
        authorId: 'a2',
        title: 'Draft news',
        occasion: ['news'],
        visibility: 'public',
        sharingScope: 'own',
      })

      expect(result.status).toBe('draft')
      expect(result.blocks).toEqual([])
      expect(result.lifecycle).toEqual({})

      const item = mockSend.mock.calls[0][0].params.Item
      // No publishDate → gsi2sk falls back to createdAt.
      expect(item.gsi2sk).toBe(`${result.createdAt}#test-post-uuid`)
    })
  })

  describe('getPost', () => {
    it('looks up by id via gsi1 and returns a clean Post', async () => {
      mockSend.mockResolvedValueOnce({ Items: [storedRecord()] })

      const result = await repository.getPost('p1')

      const queryCall = mockSend.mock.calls[0][0]
      expect(queryCall.type).toBe('QueryCommand')
      expect(queryCall.params.IndexName).toBe('gsi1')
      expect(queryCall.params.ExpressionAttributeValues).toMatchObject({
        ':gsi1pk': 'POST#p1',
        ':gsi1sk': 'POST',
      })
      expect(result?.id).toBe('p1')
      expect(result).not.toHaveProperty('pkey')
      expect(result).not.toHaveProperty('gsi2sk')
    })

    it('returns null when not found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] })
      expect(await repository.getPost('missing')).toBeNull()
    })
  })

  describe('listPosts', () => {
    it('queries gsi2 by tenant, newest-first, and filters out archived by default', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          storedRecord({ id: 'p1', status: 'ready' }),
          storedRecord({ id: 'p2', status: 'archived' }),
        ],
      })

      const { posts } = await repository.listPosts({ tenant: 'Toronto East' })

      const queryCall = mockSend.mock.calls[0][0]
      expect(queryCall.params.IndexName).toBe('gsi2')
      expect(queryCall.params.ExpressionAttributeValues).toMatchObject({
        ':gsi2pk': 'POSTS#Toronto East',
      })
      expect(queryCall.params.ScanIndexForward).toBe(false) // newest-first
      expect(posts).toHaveLength(1)
      expect(posts[0].id).toBe('p1')
    })

    it('includes archived when includeArchived is set', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          storedRecord({ id: 'p1', status: 'ready' }),
          storedRecord({ id: 'p2', status: 'archived' }),
        ],
      })

      const { posts } = await repository.listPosts({
        tenant: 'Toronto East',
        includeArchived: true,
      })
      expect(posts).toHaveLength(2)
    })
  })

  describe('updatePost', () => {
    it('loads the post (gsi1), then updates via base keys and recomputes gsi2sk', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [storedRecord({ id: 'p1' })] }) // getPost
        .mockResolvedValueOnce({
          Attributes: storedRecord({ id: 'p1', title: 'Updated title' }),
        }) // update

      const result = await repository.updatePost('p1', {
        title: 'Updated title',
        lifecycle: { publishDate: '2026-09-01T00:00:00.000Z' },
      })

      expect(mockSend).toHaveBeenCalledTimes(2)
      const updateCall = mockSend.mock.calls[1][0]
      expect(updateCall.type).toBe('UpdateCommand')
      // Updates target the base table keys, not the GSI.
      expect(updateCall.params.Key).toEqual({
        pkey: 'POST#Toronto East',
        skey: 'POST#p1',
      })
      // gsi2sk was recomputed from the new publishDate and included in the update.
      expect(Object.values(updateCall.params.ExpressionAttributeValues)).toContain(
        '2026-09-01T00:00:00.000Z#p1'
      )
      expect(result.title).toBe('Updated title')
    })

    it('throws when the post does not exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] }) // getPost → none
      await expect(repository.updatePost('missing', { title: 'x' })).rejects.toThrow(
        /not found/
      )
    })
  })

  describe('archivePost', () => {
    it('sets status to archived', async () => {
      mockSend
        .mockResolvedValueOnce({ Items: [storedRecord({ id: 'p1' })] }) // getPost
        .mockResolvedValueOnce({
          Attributes: storedRecord({ id: 'p1', status: 'archived' }),
        }) // update

      const result = await repository.archivePost('p1')

      const updateCall = mockSend.mock.calls[1][0]
      expect(Object.values(updateCall.params.ExpressionAttributeValues)).toContain('archived')
      expect(result.status).toBe('archived')
    })
  })

  describe('listAllPosts', () => {
    it('scans for POST# items and drops archived by default', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          storedRecord({ id: 'p1', status: 'ready' }),
          storedRecord({ id: 'p2', status: 'archived' }),
        ],
        LastEvaluatedKey: undefined,
      })

      const posts = await repository.listAllPosts()

      const scanCall = mockSend.mock.calls[0][0]
      expect(scanCall.type).toBe('ScanCommand')
      expect(posts.map((p) => p.id)).toEqual(['p1'])
    })
  })
})
