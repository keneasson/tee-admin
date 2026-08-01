import { describe, it, expect } from 'vitest'
import { applyOccasionDefaults } from '@my/ui/src/post-editor/occasion-defaults'
import { createEmptyPost } from '@my/ui/src/post-editor/post-reducer'
import type { Block, LocationBlock, PersonBlock, Post, TextBlock, TimeBlock } from '@my/app/types/post'

/**
 * Occasion → default block set (Consolidated CMS Phase 2c). Pure-module tests
 * — no rendering, mirrors the reducer/registry test convention. See the file
 * header of `occasion-defaults.ts` for why this module avoids importing the
 * icon-bearing `blocks/*-block-editor.tsx` factories.
 */

function draft(occasion: Post['occasion'], blocks: Block[] = []): Post {
  return { ...createEmptyPost('tee', 'author@x.com'), occasion, blocks }
}

function kinds(post: Post): string[] {
  return post.blocks.map((b) => b.kind)
}

function personRoles(post: Post): string[] {
  return post.blocks.filter((b): b is PersonBlock => b.kind === 'person').map((b) => b.role)
}

describe('applyOccasionDefaults', () => {
  it('baptism → candidate person + location + time + members-only testimony text', () => {
    const next = applyOccasionDefaults(draft(['baptism']))
    expect(personRoles(next)).toEqual(['candidate'])
    expect(kinds(next).sort()).toEqual(['location', 'person', 'text', 'time'])
    const text = next.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.visibility).toBe('members')
    expect(text.containsPii).toBe(true)
  })

  it('funeral → deceased person + location + time (no text default)', () => {
    const next = applyOccasionDefaults(draft(['funeral']))
    expect(personRoles(next)).toEqual(['deceased'])
    expect(kinds(next).sort()).toEqual(['location', 'person', 'time'])
  })

  it('wedding → bride + groom person blocks + location + time', () => {
    const next = applyOccasionDefaults(draft(['wedding']))
    expect(personRoles(next).sort()).toEqual(['bride', 'groom'])
    expect(kinds(next).sort()).toEqual(['location', 'person', 'person', 'time'])
  })

  it('news → a single text block', () => {
    const next = applyOccasionDefaults(draft(['news']))
    expect(kinds(next)).toEqual(['text'])
  })

  it('an occasion with no specific mapping falls back to a single text block', () => {
    const next = applyOccasionDefaults(draft(['general']))
    expect(kinds(next)).toEqual(['text'])
  })

  it('a multi-tag post with one mapped tag does NOT also get the generic fallback', () => {
    // 'shower' has no specific mapping; 'wedding' does — should get ONLY
    // wedding's defaults, not wedding's defaults plus a generic text block.
    const next = applyOccasionDefaults(draft(['wedding', 'shower']))
    expect(kinds(next).sort()).toEqual(['location', 'person', 'person', 'time'])
  })

  it('is idempotent — applying twice does not duplicate blocks', () => {
    const once = applyOccasionDefaults(draft(['funeral']))
    const twice = applyOccasionDefaults(once)
    expect(twice.blocks).toEqual(once.blocks)
    expect(twice.blocks).toHaveLength(3)
  })

  it('ADDITIVE: never removes or edits existing author content — only tops up missing slots', () => {
    const authoredLocation: LocationBlock = {
      id: 'loc-authored',
      kind: 'location',
      mode: 'plain',
      venueName: 'Authored Hall', // author-entered content that must survive
    }
    const post = draft(['funeral'], [authoredLocation])
    const next = applyOccasionDefaults(post)

    // The author's location block is untouched (same id, same venueName).
    const loc = next.blocks.find((b): b is LocationBlock => b.kind === 'location')!
    expect(loc).toEqual(authoredLocation)

    // The missing slots (deceased person + time) were added; location was NOT duplicated.
    expect(kinds(next).sort()).toEqual(['location', 'person', 'time'])
    expect(personRoles(next)).toEqual(['deceased'])
  })

  it('ADDITIVE: an existing person block in the same role slot blocks that default, but a different role still gets added', () => {
    const authoredBride: PersonBlock = {
      id: 'person-authored',
      kind: 'person',
      role: 'bride',
      people: [{ id: 'ppl-1', firstName: 'Custom' }],
    }
    const next = applyOccasionDefaults(draft(['wedding'], [authoredBride]))

    const brides = next.blocks.filter((b): b is PersonBlock => b.kind === 'person' && b.role === 'bride')
    expect(brides).toHaveLength(1)
    expect(brides[0]).toEqual(authoredBride) // untouched, not overwritten

    const grooms = next.blocks.filter((b): b is PersonBlock => b.kind === 'person' && b.role === 'groom')
    expect(grooms).toHaveLength(1) // the missing groom default was still added
  })

  it('a fully author-populated post (all slots already occupied) is untouched — same block array', () => {
    const authored: Block[] = [
      { id: 'p1', kind: 'person', role: 'deceased', people: [{ id: 'ppl-1', firstName: 'Tom' }] },
      { id: 'l1', kind: 'location', mode: 'plain' } as LocationBlock,
      { id: 't1', kind: 'time' } as TimeBlock,
    ]
    const post = draft(['funeral'], authored)
    const next = applyOccasionDefaults(post)
    expect(next).toBe(post) // no-op: identical reference, nothing appended
  })

  it('applying defaults never removes blocks unrelated to the occasion (e.g. a link block)', () => {
    const link: Block = { id: 'lk1', kind: 'link', url: 'https://example.com' }
    const next = applyOccasionDefaults(draft(['baptism'], [link]))
    expect(next.blocks.some((b) => b.id === 'lk1')).toBe(true)
    expect(next.blocks.length).toBeGreaterThan(1)
  })
})
