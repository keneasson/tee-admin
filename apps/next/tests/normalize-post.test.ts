import { describe, it, expect } from 'vitest'
import { normalizePost } from '@my/app/utils/normalize-post'
import { blocksToDocState } from '@my/app/features/post-editor/doc-serialization'
import type { Post, TextBlock } from '@my/app/types/post'

/**
 * Regression guard for #214 — the doc canvas white-screened on every post with
 * an untouched text block.
 *
 * The shared DynamoDB client sets `convertEmptyValues: true`, which rewrites a
 * stored `''` to `NULL`. So `makeTextBlock()`'s `{ body: '' }` reads back as
 * `{ body: null }`, violating `TextBlock.body: string`, and `body.split(...)`
 * threw during render. The fixture below is the EXACT record that crashed
 * production.
 */
const CRASHING_BLOCK = {
  id: 'blk_msdcg9fd_p06zurm0',
  body: null,
  kind: 'text',
  containsPii: false,
} as unknown as TextBlock

const postWith = (blocks: unknown[]): Post =>
  ({
    id: '29c343f6-f613-4cf7-81c4-6b232b8811f4',
    tenant: 'Toronto East Ecclesia',
    authorId: 'author',
    title: 'Test Post',
    occasion: ['general', 'news'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    blocks,
    status: 'draft',
    createdAt: '2026-08-03T14:48:00.000Z',
    updatedAt: '2026-08-03T14:48:00.000Z',
  }) as unknown as Post

describe('normalizePost — repairs convertEmptyValues damage', () => {
  it('restores a null text body to the empty string it was saved as', () => {
    const [block] = normalizePost(postWith([CRASHING_BLOCK])).blocks as TextBlock[]
    expect(block.body).toBe('')
  })

  it('preserves a real body untouched', () => {
    const real = { ...CRASHING_BLOCK, body: '# Heading\n\nSome prose.' } as TextBlock
    const [block] = normalizePost(postWith([real])).blocks as TextBlock[]
    expect(block.body).toBe('# Heading\n\nSome prose.')
  })

  it('drops nulls on optional fields rather than turning them into empty strings', () => {
    const withNullOptional = {
      id: 'l1',
      kind: 'location',
      mode: 'plain',
      venueName: null,
      city: 'Toronto',
    } as unknown as TextBlock
    const [block] = normalizePost(postWith([withNullOptional])).blocks
    expect('venueName' in block).toBe(false)
    expect((block as unknown as { city: string }).city).toBe('Toronto')
  })

  it('restores a required firstName inside a person block', () => {
    const person = {
      id: 'p1',
      kind: 'person',
      role: 'speaker',
      people: [{ id: 'x', firstName: null, lastName: 'Easson' }],
    } as unknown as TextBlock
    const [block] = normalizePost(postWith([person])).blocks
    const people = (block as unknown as { people: Array<{ firstName: string }> }).people
    expect(people[0].firstName).toBe('')
  })

  it('tolerates a missing blocks array', () => {
    const broken = { ...postWith([]), blocks: undefined } as unknown as Post
    expect(normalizePost(broken).blocks).toEqual([])
  })
})

describe('doc canvas survives the crashing record', () => {
  it('serializes a null-bodied block instead of throwing (the actual crash)', () => {
    expect(() => blocksToDocState([CRASHING_BLOCK])).not.toThrow()
  })

  it('and after normalization produces a normal empty document', () => {
    const normalized = normalizePost(postWith([CRASHING_BLOCK]))
    expect(() => blocksToDocState(normalized.blocks)).not.toThrow()
  })
})
