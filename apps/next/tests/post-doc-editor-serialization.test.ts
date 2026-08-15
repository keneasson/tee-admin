import { describe, it, expect } from 'vitest'
import {
  docToBlocks,
  blocksToDocState,
  insertBlockNodeAt,
  POST_BLOCK_TYPE,
  type SerializedTopNode,
} from '../features/post-doc-editor/doc-serialization'
import { makeToolBlock } from '../features/post-doc-editor/tool-blocks'
import type { Block, FlyerBlock, LocationBlock, TextBlock } from '@my/app/types/post'

/**
 * The CRUX of the document-canvas editor (Consolidated CMS Phase 2R-1 keystone):
 * the doc ⇄ `Post.blocks[]` bijection must be a PURE, order-preserving,
 * round-trip-stable transformation. These tests exercise it with NO Lexical /
 * Tamagui in the loop (the full DOM editor can't mount cleanly headless, and
 * `@tamagui/lucide-icons` hangs vitest) — so they cover the pure serialization +
 * insert-position logic, which is where correctness actually lives.
 */

// Compare blocks modulo id (text-run ids are freshly generated on docToBlocks;
// typed-block payloads carry through unchanged, ids included).
const norm = (b: Block): Omit<Block, 'id'> => {
  const { id: _id, ...rest } = b
  return rest
}

const text = (id: string, body: string): TextBlock => ({ id, kind: 'text', body, containsPii: false })

describe('docToBlocks — Lexical editor-state JSON → ordered blocks', () => {
  it('collapses a run of prose nodes into ONE markdown TextBlock', () => {
    const state = {
      root: {
        children: [
          { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'Title', format: 0 }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'Body line.', format: 0 }] },
        ],
      },
    }
    const blocks = docToBlocks(state)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].kind).toBe('text')
    expect((blocks[0] as TextBlock).body).toBe('# Title\n\nBody line.')
  })

  it('yields a typed block for each post-block decorator node and preserves order', () => {
    const location: LocationBlock = { id: 'l1', kind: 'location', mode: 'plain', city: 'Toronto' }
    const state = {
      root: {
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'Before.', format: 0 }] },
          { type: POST_BLOCK_TYPE, block: location },
          { type: 'paragraph', children: [{ type: 'text', text: 'After.', format: 0 }] },
        ],
      },
    }
    const blocks = docToBlocks(state)
    expect(blocks.map((b) => b.kind)).toEqual(['text', 'location', 'text'])
    expect((blocks[0] as TextBlock).body).toBe('Before.')
    expect(blocks[1]).toBe(location) // carried through unchanged
    expect((blocks[2] as TextBlock).body).toBe('After.')
  })

  it('does NOT emit an empty TextBlock between two adjacent decorator nodes', () => {
    const a: LocationBlock = { id: 'a', kind: 'location', mode: 'plain' }
    const b: LocationBlock = { id: 'b', kind: 'location', mode: 'plain' }
    const blocks = docToBlocks({
      root: { children: [{ type: POST_BLOCK_TYPE, block: a }, { type: POST_BLOCK_TYPE, block: b }] },
    })
    expect(blocks.map((x) => x.kind)).toEqual(['location', 'location'])
  })

  it('drops whitespace-only prose (editor spacer paragraphs are not phantom blocks)', () => {
    const blocks = docToBlocks({
      root: { children: [{ type: 'paragraph', children: [{ type: 'text', text: '', format: 0 }] }] },
    })
    expect(blocks).toEqual([])
  })
})

describe('blocksToDocState — ordered blocks → Lexical editor-state JSON', () => {
  it('explodes a TextBlock into paragraph/heading nodes', () => {
    const state = blocksToDocState([text('t', '# Heading\n\nA paragraph.')])
    const kinds = state.root.children.map((c) => c.type)
    expect(kinds).toContain('heading')
    expect(kinds).toContain('paragraph')
  })

  it('turns every non-text block into a post-block decorator node carrying the block', () => {
    const loc: LocationBlock = { id: 'l', kind: 'location', mode: 'plain', label: 'Service' }
    const state = blocksToDocState([loc])
    const node = state.root.children.find((c) => c.type === POST_BLOCK_TYPE)
    expect(node).toBeDefined()
    expect((node as { block: Block }).block).toBe(loc)
  })

  it('appends a trailing empty paragraph when the doc is empty or ends on a decorator', () => {
    expect(blocksToDocState([]).root.children.map((c) => c.type)).toEqual(['paragraph'])
    const loc: LocationBlock = { id: 'l', kind: 'location', mode: 'plain' }
    const ending = blocksToDocState([loc]).root.children
    expect(ending[ending.length - 1].type).toBe('paragraph')
  })
})

describe('round-trip: blocks → doc → blocks (order + content stable)', () => {
  it('round-trips prose interleaved with a Location, order preserved', () => {
    const blocks: Block[] = [
      text('t1', '# Sunday Service\n\nAll welcome. Please **RSVP**.'),
      { id: 'l1', kind: 'location', mode: 'plain', label: 'Service', venueName: 'East Hall', city: 'Toronto' },
      text('t2', 'See you there.'),
    ]
    const round = docToBlocks(blocksToDocState(blocks))
    expect(round.map((b) => b.kind)).toEqual(['text', 'location', 'text'])
    expect(round.map(norm)).toEqual(blocks.map(norm))
  })

  it('round-trips inline marks and headings (bold, italic, h1/h2/h3)', () => {
    const bodies = [
      '## Details',
      'Plain, **bold**, *italic*, and ***both***.',
      '### Notes\n\nA closing paragraph.',
    ]
    for (const body of bodies) {
      const round = docToBlocks(blocksToDocState([text('x', body)]))
      expect(round).toHaveLength(1)
      expect((round[0] as TextBlock).body).toBe(body)
    }
  })

  it('an empty document round-trips to no blocks', () => {
    expect(docToBlocks(blocksToDocState([]))).toEqual([])
  })

  // REGRESSION GUARD (PII leak): a text block authored with a per-block
  // `visibility` override and/or `containsPii` must NOT explode into bare prose
  // (which drops both, silently making a members-only obituary/testimony public).
  // It rides as a `post-block` decorator node and survives the round-trip EXACTLY
  // — id included — not just modulo id like plain prose.
  it('preserves visibility + containsPii + id on a metadata-bearing text block', () => {
    const obituary: TextBlock = {
      id: 'obit-1',
      kind: 'text',
      body: '## In loving memory\n\nA private testimony, **members only**.',
      visibility: 'members',
      containsPii: true,
    }
    const doc = blocksToDocState([obituary])
    // It must be carried as a decorator node, not exploded into prose.
    const carrier = doc.root.children.find((c) => c.type === POST_BLOCK_TYPE)
    expect(carrier).toBeDefined()
    expect((carrier as { block: Block }).block).toBe(obituary)

    const round = docToBlocks(doc)
    expect(round).toHaveLength(1)
    // Exact equality — id preserved (NOT re-minted), visibility gate intact,
    // containsPii NOT reset to false.
    expect(round[0]).toEqual(obituary)
  })

  it('preserves a members-only text block even when it has no containsPii flag', () => {
    const gated: TextBlock = {
      id: 'gated-1',
      kind: 'text',
      body: 'Members-only announcement.',
      visibility: 'members',
      containsPii: false,
    }
    const round = docToBlocks(blocksToDocState([gated]))
    expect(round).toEqual([gated])
  })

  it('plain prose text stays editable bare prose (unchanged behavior)', () => {
    // No visibility override, not PII ⇒ explodes into paragraph/heading nodes,
    // NOT a decorator; round-trips modulo id (a fresh run id is expected).
    const plain = text('plain-1', 'Just some public prose.')
    const doc = blocksToDocState([plain])
    expect(doc.root.children.some((c) => c.type === POST_BLOCK_TYPE)).toBe(false)
    const round = docToBlocks(doc)
    expect(round.map(norm)).toEqual([norm(plain)])
  })
})

describe('armed-tool insert (pure state transition of ArmedToolPlugin)', () => {
  it('makeToolBlock builds a fresh, empty block for every wired tool', () => {
    const loc = makeToolBlock('location')
    expect(loc.kind).toBe('location')
    expect((loc as LocationBlock).mode).toBe('plain')
    expect(makeToolBlock('location').id).not.toBe(loc.id) // fresh id each call
    // All six tools are now wired end-to-end.
    expect(makeToolBlock('person').kind).toBe('person')
    expect(makeToolBlock('time').kind).toBe('time')
    expect(makeToolBlock('link').kind).toBe('link')
    expect(makeToolBlock('registration').kind).toBe('registration')
    // Flyer builds an image-less block whose document is blank (uploader fills it).
    const flyer = makeToolBlock('flyer') as FlyerBlock
    expect(flyer.kind).toBe('flyer')
    expect(flyer.document.fileUrl).toBe('')
    expect(makeToolBlock('flyer').id).not.toBe(flyer.id)
  })

  it('arming Location + clicking inserts a location post-block at the click index', () => {
    // Document is "prose | prose"; arm Location, click between them (index 1).
    const children = blocksToDocState([text('a', 'A'), text('b', 'B')]).root.children
    const inserted = insertBlockNodeAt(children, 1, makeToolBlock('location'))

    expect(inserted).toHaveLength(children.length + 1)
    expect(inserted[1].type).toBe(POST_BLOCK_TYPE)
    expect((inserted[1] as { block: Block }).block.kind).toBe('location')

    // And the resulting document deserializes to prose → location → prose.
    const roundtrip = docToBlocks({ root: { children: inserted as SerializedTopNode[] } })
    expect(roundtrip.map((b) => b.kind)).toEqual(['text', 'location', 'text'])
  })

  it('clamps an out-of-range insert index to the document bounds', () => {
    const children = blocksToDocState([text('a', 'A')]).root.children
    const atEnd = insertBlockNodeAt(children, 999, makeToolBlock('location'))
    expect(atEnd[atEnd.length - 1].type).toBe(POST_BLOCK_TYPE)
    const atStart = insertBlockNodeAt(children, -5, makeToolBlock('location'))
    expect(atStart[0].type).toBe(POST_BLOCK_TYPE)
  })
})
