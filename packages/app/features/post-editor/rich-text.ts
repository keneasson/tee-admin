/**
 * Portable rich text — the lossless capture half of ADR-0004.
 *
 * THE RULE: **storage is lossless, rendering is progressive.** The editor may
 * capture any formatting this format can describe, whether or not any renderer
 * displays it yet. A renderer that meets a mark it does not know IGNORES the
 * mark and renders the text — never crashes, never emits raw markup.
 *
 * Why this exists: `TextBlock.body` is a mini-markdown string that can only
 * express bold, italic and `#` headings. Italic is already captured and stored
 * and rendered by NOBODY, so it silently disappears at publish; and
 * `docToBlocks` discards every node that is not a paragraph or heading, so a
 * list would evaporate on the next keystroke. Markdown also has no spelling for
 * highlight or alignment, so the format simply ran out of room. Same failure
 * class as the PII-visibility loss (#177): the editor holds something the
 * storage cannot express, and it is lost on round-trip.
 *
 * The shape is deliberately boring JSON — blocks holding inline runs, each run
 * carrying a set of marks. It names no Lexical type and no DOM type, so it is
 * platform-neutral (ADR-0003 §3) and an Expo canvas can produce and consume it.
 *
 * `TextBlock.body` is NOT removed: it stays the plain-markdown PROJECTION of
 * `rich`, always derived, never hand-edited. That is what lets every existing
 * renderer keep working unchanged on the day `rich` lands, and it remains the
 * degradation path for plain-text mail parts, summaries and search.
 */

import type { BlockKind } from '../../types/post'

/**
 * Inline emphasis. Open-ended ON PURPOSE: an unknown mark must survive a
 * read/write cycle (ADR-0004 §4), so a client that predates a mark cannot
 * silently strip a newer client's formatting.
 */
export type KnownMark =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'code'
  | 'highlight'

export type Mark = KnownMark | (string & {})

/** A run of text sharing one set of marks. */
export interface TextRun {
  type: 'text'
  text: string
  /** Absent means unmarked. Order is not significant. */
  marks?: Mark[]
}

/**
 * A reference to a typed Block placed inside the prose — the `{{kind:id}}`
 * marker of the §2.2 revision, in tree form. ONE idea, two projections: never
 * two mechanisms (ADR-0004 §6).
 */
export interface BlockRef {
  type: 'blockRef'
  id: string
  kind: BlockKind
}

export type InlineNode = TextRun | BlockRef

export type BlockAlign = 'left' | 'center' | 'right'

/** A top-level block of prose. */
export interface RichBlock {
  type: 'paragraph' | 'heading' | 'listItem' | 'quote' | 'rule'
  children: InlineNode[]
  /** Heading level 1–3. Only meaningful for `heading`. */
  level?: 1 | 2 | 3
  /** Only meaningful for `listItem`. */
  list?: 'bullet' | 'number'
  /** Nesting depth for `listItem`, 0-based. */
  indent?: number
  /** Horizontal alignment. Markdown cannot express this; the tree can. */
  align?: BlockAlign
}

export type RichNode = RichBlock

// ---- Projection: rich → the markdown `body` --------------------------------

const MARK_WRAPPERS: Partial<Record<KnownMark, [string, string]>> = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  code: ['`', '`'],
}

/** Render one inline run to markdown, applying only marks markdown can spell. */
function runToMarkdown(run: TextRun): string {
  let out = run.text
  for (const mark of run.marks ?? []) {
    const wrap = MARK_WRAPPERS[mark as KnownMark]
    // A mark markdown cannot express (underline, highlight, or one added after
    // this code was written) simply does not decorate the projection. It is NOT
    // lost — it stays on the run in `rich`.
    if (wrap) out = `${wrap[0]}${out}${wrap[1]}`
  }
  return out
}

function inlineToMarkdown(children: InlineNode[]): string {
  return children
    .map((node) =>
      node.type === 'blockRef' ? `{{${node.kind}:${node.id}}}` : runToMarkdown(node)
    )
    .join('')
}

/**
 * The plain-markdown projection of a rich tree — what `TextBlock.body` holds.
 *
 * Lossy BY DESIGN and that is safe: `rich` is the source of truth, and `body`
 * exists so that a renderer which knows nothing about `rich` still shows
 * readable prose with the author's structure intact.
 */
export function richToMarkdown(nodes: RichNode[]): string {
  const lines: string[] = []
  for (const node of nodes) {
    const text = inlineToMarkdown(node.children)
    switch (node.type) {
      case 'heading':
        lines.push(`${'#'.repeat(node.level ?? 2)} ${text}`)
        break
      case 'listItem': {
        const pad = '  '.repeat(node.indent ?? 0)
        lines.push(`${pad}${node.list === 'number' ? '1.' : '-'} ${text}`)
        break
      }
      case 'quote':
        lines.push(`> ${text}`)
        break
      case 'rule':
        lines.push('---')
        break
      default:
        lines.push(text)
    }
  }
  // Paragraphs separate with a blank line; consecutive list items do not.
  return joinBlocks(nodes, lines)
}

function joinBlocks(nodes: RichNode[], lines: string[]): string {
  const out: string[] = []
  nodes.forEach((node, i) => {
    if (i > 0) {
      const prev = nodes[i - 1]
      const bothList = prev.type === 'listItem' && node.type === 'listItem'
      out.push(bothList ? '\n' : '\n\n')
    }
    out.push(lines[i])
  })
  return out.join('')
}

// ---- Upgrade path: an existing markdown `body` → a rich tree ----------------

const HEADING_RE = /^(#{1,3})\s+(.*)$/
const LIST_RE = /^(\s*)([-*]|\d+\.)\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/
const INLINE_RE = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\{\{([a-z]+):([A-Za-z0-9_-]+)\}\}/g

function markdownInline(md: string): InlineNode[] {
  const out: InlineNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(md)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: md.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ type: 'text', text: m[1], marks: ['bold', 'italic'] })
    else if (m[2] !== undefined) out.push({ type: 'text', text: m[2], marks: ['bold'] })
    else if (m[3] !== undefined) out.push({ type: 'text', text: m[3], marks: ['italic'] })
    else if (m[4] !== undefined) out.push({ type: 'text', text: m[4], marks: ['code'] })
    else out.push({ type: 'blockRef', kind: m[5] as BlockKind, id: m[6]! })
    last = INLINE_RE.lastIndex
  }
  if (last < md.length) out.push({ type: 'text', text: md.slice(last) })
  return out
}

/**
 * Parse a legacy `body` into a rich tree. Used to upgrade posts authored before
 * `rich` existed, so they can be edited without losing what they already have.
 */
export function markdownToRich(body: string): RichNode[] {
  if (typeof body !== 'string' || body.trim() === '') return []
  const nodes: RichNode[] = []
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.trim() === '') continue

    if (line.trim() === '---') {
      nodes.push({ type: 'rule', children: [] })
      continue
    }
    const heading = HEADING_RE.exec(line.trim())
    if (heading) {
      nodes.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        children: markdownInline(heading[2]),
      })
      continue
    }
    const list = LIST_RE.exec(line)
    if (list) {
      nodes.push({
        type: 'listItem',
        list: /\d/.test(list[2]) ? 'number' : 'bullet',
        indent: Math.floor(list[1].length / 2),
        children: markdownInline(list[3]),
      })
      continue
    }
    const quote = QUOTE_RE.exec(line.trim())
    if (quote) {
      nodes.push({ type: 'quote', children: markdownInline(quote[1]) })
      continue
    }
    nodes.push({ type: 'paragraph', children: markdownInline(line.trim()) })
  }
  return nodes
}

/** Every mark used anywhere in a tree — for "does any renderer need upgrading?". */
export function marksUsed(nodes: RichNode[]): Set<Mark> {
  const marks = new Set<Mark>()
  for (const node of nodes) {
    for (const child of node.children) {
      if (child.type === 'text') for (const m of child.marks ?? []) marks.add(m)
    }
  }
  return marks
}
