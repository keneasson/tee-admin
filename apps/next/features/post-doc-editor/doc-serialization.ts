/**
 * Document ⇄ Blocks serialization — the CRUX of the document-canvas editor
 * (Consolidated CMS Phase 2R-1, keystone; epic #131).
 *
 * The document-canvas editor (Lexical) is only a *container* for the SAME unified
 * Post model: a `Post.blocks[]` is an ordered list, so a document is an ordered
 * sequence of (prose → {@link TextBlock}) and (widget → a typed {@link Block}).
 * This module is the clean bijection between the two:
 *
 *  - {@link docToBlocks}: walks a Lexical editor-state JSON tree (`{ root: … }`).
 *    A run of prose (paragraph/heading nodes) collapses into ONE markdown
 *    TextBlock; each decorator node (`type: 'post-block'`) becomes its typed
 *    Block. ORDER IS PRESERVED.
 *  - {@link blocksToDocState}: the inverse — a TextBlock explodes back into
 *    paragraph/heading nodes; a typed Block becomes a `post-block` decorator
 *    node. Produces a `{ root: … }` editor-state JSON string-ready for Lexical's
 *    `initialConfig.editorState`.
 *
 * PURE + DEPENDENCY-LIGHT ON PURPOSE. It imports ONLY types + the pure `genId`
 * helper — never Lexical, never Tamagui — so the round-trip is unit-testable in
 * a plain node vitest environment (no `@tamagui/lucide-icons` mount, no DOM).
 * Lexical exposes its editor state as JSON, so we walk the JSON rather than a
 * live editor.
 *
 * WEB-ONLY feature module: lives under apps/next (a DOM rich-text editor cannot
 * live in the cross-platform packages/ui). This file itself is platform-neutral,
 * but it is a private implementation detail of the web editor.
 */

import type { Block, TextBlock } from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'

// ---- Node type discriminators (mirror Lexical's serialized `type` field) ----
export const POST_BLOCK_TYPE = 'post-block'
const PARAGRAPH_TYPE = 'paragraph'
const HEADING_TYPE = 'heading'
const TEXT_TYPE = 'text'
const ROOT_TYPE = 'root'

// Lexical text-format bitmask (subset we round-trip): see lexical's FORMAT flags.
const IS_BOLD = 1
const IS_ITALIC = 2

// ---- Serialized shapes ------------------------------------------------------
// Local mirrors of Lexical's SerializedNode shapes. Kept here (not imported from
// lexical) so this module has no runtime lexical dependency. Extra fields Lexical
// emits are tolerated on read and defaulted on write.

export interface SerializedTextNode {
  type: typeof TEXT_TYPE
  text: string
  format: number
  detail: number
  mode: 'normal'
  style: string
  version: 1
}

export interface SerializedParagraphNode {
  type: typeof PARAGRAPH_TYPE
  children: SerializedTextNode[]
  direction: 'ltr' | null
  format: ''
  indent: 0
  textFormat: 0
  textStyle: ''
  version: 1
}

export interface SerializedHeadingNode {
  type: typeof HEADING_TYPE
  tag: 'h1' | 'h2' | 'h3'
  children: SerializedTextNode[]
  direction: 'ltr' | null
  format: ''
  indent: 0
  version: 1
}

export interface SerializedPostBlockNode {
  type: typeof POST_BLOCK_TYPE
  block: Block
  version: 1
}

export type SerializedTopNode =
  | SerializedParagraphNode
  | SerializedHeadingNode
  | SerializedPostBlockNode

export interface SerializedDocState {
  root: {
    type: typeof ROOT_TYPE
    children: SerializedTopNode[]
    direction: 'ltr' | null
    format: ''
    indent: 0
    version: 1
  }
}

// ---- Inline markdown ⇄ text-node marks --------------------------------------

function textNode(text: string, format: number): SerializedTextNode {
  return { type: TEXT_TYPE, text, format, detail: 0, mode: 'normal', style: '', version: 1 }
}

/** Render a run of serialized text nodes back to markdown (bold/italic marks). */
function renderInline(children: unknown): string {
  if (!Array.isArray(children)) return ''
  return children
    .map((n) => {
      if (!n || typeof (n as SerializedTextNode).text !== 'string') return ''
      let s = (n as SerializedTextNode).text
      const f = typeof (n as SerializedTextNode).format === 'number' ? (n as SerializedTextNode).format : 0
      if (f & IS_ITALIC) s = `*${s}*`
      if (f & IS_BOLD) s = `**${s}**`
      return s
    })
    .join('')
}

/** Parse an inline markdown string into serialized text nodes (bold/italic). */
function parseInline(md: string): SerializedTextNode[] {
  const nodes: SerializedTextNode[] = []
  // ***bold+italic*** | **bold** | *italic*  (non-greedy, no nested markers).
  const re = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(md)) !== null) {
    if (m.index > last) nodes.push(textNode(md.slice(last, m.index), 0))
    if (m[1] !== undefined) nodes.push(textNode(m[1], IS_BOLD | IS_ITALIC))
    else if (m[2] !== undefined) nodes.push(textNode(m[2], IS_BOLD))
    else nodes.push(textNode(m[3]!, IS_ITALIC))
    last = re.lastIndex
  }
  if (last < md.length) nodes.push(textNode(md.slice(last), 0))
  if (nodes.length === 0) nodes.push(textNode('', 0))
  return nodes
}

// ---- Prose block ⇄ paragraph/heading nodes ----------------------------------

function paragraphNode(children: SerializedTextNode[]): SerializedParagraphNode {
  return {
    type: PARAGRAPH_TYPE,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    version: 1,
  }
}

function headingNode(level: number, children: SerializedTextNode[]): SerializedHeadingNode {
  const tag = (level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3') as SerializedHeadingNode['tag']
  return { type: HEADING_TYPE, tag, children, direction: 'ltr', format: '', indent: 0, version: 1 }
}

/** A TextBlock's markdown body → the paragraph/heading nodes it represents. */
function textBlockToNodes(body: string): SerializedTopNode[] {
  const nodes: SerializedTopNode[] = []
  for (const raw of body.split(/\n{2,}/)) {
    const chunk = raw.trim()
    if (!chunk) continue
    const h = /^(#{1,3})\s+(.*)$/.exec(chunk)
    if (h && !chunk.includes('\n')) {
      nodes.push(headingNode(h[1].length, parseInline(h[2])))
    } else {
      nodes.push(paragraphNode(parseInline(chunk.replace(/\n+/g, ' '))))
    }
  }
  if (nodes.length === 0) nodes.push(paragraphNode([textNode('', 0)]))
  return nodes
}

/** One prose node → its markdown string (for {@link docToBlocks} accumulation). */
function proseNodeToMarkdown(node: SerializedParagraphNode | SerializedHeadingNode): string {
  if (node.type === HEADING_TYPE) {
    const level = node.tag === 'h1' ? 1 : node.tag === 'h2' ? 2 : 3
    return `${'#'.repeat(level)} ${renderInline(node.children)}`
  }
  return renderInline(node.children)
}

// ---- The bijection ----------------------------------------------------------

interface LooseNode {
  type?: string
  block?: Block
  children?: unknown
  tag?: string
}

function childrenOf(state: unknown): LooseNode[] {
  const s = state as { root?: { children?: unknown }; children?: unknown } | null
  const children = s?.root?.children ?? s?.children
  return Array.isArray(children) ? (children as LooseNode[]) : []
}

/**
 * Walk a Lexical editor-state JSON (`{ root: { children } }`) into ordered Blocks.
 * Consecutive prose nodes collapse into ONE markdown TextBlock; each `post-block`
 * decorator node yields its carried typed Block. Empty/whitespace-only prose is
 * dropped (so editor spacer paragraphs never become phantom TextBlocks). Order
 * is preserved exactly.
 */
export function docToBlocks(state: unknown): Block[] {
  const out: Block[] = []
  let run: string[] = []

  const flush = () => {
    const body = run.filter((s) => s.trim().length > 0).join('\n\n')
    run = []
    if (body.length === 0) return
    out.push({ id: genId(), kind: 'text', body, containsPii: false } satisfies TextBlock)
  }

  for (const child of childrenOf(state)) {
    if (child.type === POST_BLOCK_TYPE && child.block) {
      flush()
      out.push(child.block)
    } else if (child.type === PARAGRAPH_TYPE || child.type === HEADING_TYPE) {
      run.push(proseNodeToMarkdown(child as unknown as SerializedParagraphNode | SerializedHeadingNode))
    }
    // Unknown node kinds are ignored (defensive against future Lexical nodes).
  }
  flush()
  return out
}

/**
 * The inverse: ordered Blocks → a Lexical editor-state JSON. A TextBlock explodes
 * back into paragraph/heading nodes; every other Block kind becomes a `post-block`
 * decorator node carrying the full typed block. A trailing empty paragraph is
 * appended when the document is empty or ends on a decorator node, so the caret
 * always has editable prose to land in (and it is dropped again by
 * {@link docToBlocks}, keeping the round-trip stable).
 */
export function blocksToDocState(blocks: Block[]): SerializedDocState {
  const children: SerializedTopNode[] = []
  for (const block of blocks) {
    if (block.kind === 'text') {
      children.push(...textBlockToNodes(block.body))
    } else {
      children.push({ type: POST_BLOCK_TYPE, block, version: 1 })
    }
  }
  const last = children[children.length - 1]
  if (!last || last.type === POST_BLOCK_TYPE) {
    children.push(paragraphNode([textNode('', 0)]))
  }
  return {
    root: { type: ROOT_TYPE, children, direction: 'ltr', format: '', indent: 0, version: 1 },
  }
}

/**
 * PURE model of the armed-tool insert: drop a `post-block` decorator node into a
 * root child list at `index`. This is the exact state transition the live
 * {@link ArmedToolPlugin} performs (`$insertNodeToNearestRoot`) — factored out so
 * "arming a tool + clicking inserts the right kind at the right position" is
 * unit-testable without mounting Lexical.
 */
export function insertBlockNodeAt(
  children: SerializedTopNode[],
  index: number,
  block: Block
): SerializedTopNode[] {
  const node: SerializedPostBlockNode = { type: POST_BLOCK_TYPE, block, version: 1 }
  const clamped = Math.max(0, Math.min(index, children.length))
  return [...children.slice(0, clamped), node, ...children.slice(clamped)]
}
