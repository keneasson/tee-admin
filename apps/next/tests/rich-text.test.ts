import { describe, it, expect } from 'vitest'
import {
  richToMarkdown,
  markdownToRich,
  marksUsed,
  type RichNode,
} from '@my/app/features/post-editor/rich-text'

/**
 * ADR-0004: storage is lossless, rendering is progressive.
 *
 * The two properties that make incremental renderer work safe:
 *   1. `body` is a faithful PROJECTION — a renderer that knows nothing about
 *      `rich` still shows readable prose with the author's structure intact.
 *   2. A mark markdown cannot spell is ABSENT from the projection but PRESERVED
 *      on the tree. Nothing the author types is destroyed just because no
 *      renderer displays it yet.
 */
describe('richToMarkdown — the projection', () => {
  it('spells the marks markdown has', () => {
    const nodes: RichNode[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'plain ' },
          { type: 'text', text: 'bold', marks: ['bold'] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic', marks: ['italic'] },
        ],
      },
    ]
    expect(richToMarkdown(nodes)).toBe('plain **bold** and *italic*')
  })

  it('renders headings, lists, quotes and rules', () => {
    const nodes: RichNode[] = [
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Details' }] },
      { type: 'listItem', list: 'bullet', children: [{ type: 'text', text: 'first' }] },
      { type: 'listItem', list: 'bullet', children: [{ type: 'text', text: 'second' }] },
      { type: 'quote', children: [{ type: 'text', text: 'a note' }] },
      { type: 'rule', children: [] },
    ]
    expect(richToMarkdown(nodes)).toBe('## Details\n\n- first\n- second\n\n> a note\n\n---')
  })

  it('keeps an inline block reference as its marker', () => {
    const nodes: RichNode[] = [
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Starts at ' },
          { type: 'blockRef', kind: 'time', id: 't1' },
        ],
      },
    ]
    expect(richToMarkdown(nodes)).toBe('Starts at {{time:t1}}')
  })

  it('a mark markdown cannot spell is dropped from the projection ONLY', () => {
    const nodes: RichNode[] = [
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'important', marks: ['highlight', 'underline'] }],
      },
    ]
    // The projection is plain — no invented syntax leaks into `body`.
    expect(richToMarkdown(nodes)).toBe('important')
    // But the marks are still on the tree: captured now, rendered later.
    expect([...marksUsed(nodes)].sort()).toEqual(['highlight', 'underline'])
  })

  it('survives a mark added after this code was written (forward compatibility)', () => {
    const nodes: RichNode[] = [
      { type: 'paragraph', children: [{ type: 'text', text: 'x', marks: ['some-future-mark'] }] },
    ]
    expect(() => richToMarkdown(nodes)).not.toThrow()
    expect(richToMarkdown(nodes)).toBe('x')
    expect(marksUsed(nodes).has('some-future-mark')).toBe(true)
  })
})

describe('markdownToRich — upgrading a legacy body', () => {
  it('parses the formatting the old mini-markdown could hold', () => {
    const nodes = markdownToRich('# Title\n\nSome **bold** and *italic* text.')
    expect(nodes[0].type).toBe('heading')
    expect(nodes[0].level).toBe(1)
    const runs = nodes[1].children.filter((c) => c.type === 'text')
    expect(runs.some((r) => r.type === 'text' && r.marks?.includes('bold'))).toBe(true)
    expect(runs.some((r) => r.type === 'text' && r.marks?.includes('italic'))).toBe(true)
  })

  it('recovers inline block references', () => {
    const [para] = markdownToRich('Starts at {{time:t1}} sharp.')
    const ref = para.children.find((c) => c.type === 'blockRef')
    expect(ref).toEqual({ type: 'blockRef', kind: 'time', id: 't1' })
  })

  it('parses lists and quotes the old format never stored', () => {
    const nodes = markdownToRich('- one\n- two\n\n> quoted')
    expect(nodes.map((n) => n.type)).toEqual(['listItem', 'listItem', 'quote'])
  })

  it('round-trips a legacy body back to itself', () => {
    const body = '# Heading\n\nSome **bold** text.'
    expect(richToMarkdown(markdownToRich(body))).toBe(body)
  })

  it('tolerates an empty or absent body', () => {
    expect(markdownToRich('')).toEqual([])
    expect(markdownToRich(undefined as unknown as string)).toEqual([])
  })
})
