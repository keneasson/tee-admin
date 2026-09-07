/**
 * Inline block markers — how a structured value keeps its place inside a
 * sentence (design §2.2, revised).
 *
 * THE PROBLEM THIS SOLVES: converting a selection into a typed block used to
 * REPLACE the phrase with a full-width widget on its own line, so the act of
 * identifying a date destroyed the sentence you wanted to keep. Prose and
 * structure were alternating siblings; what the author writes is one sentence
 * where some words happen to carry typed meaning.
 *
 * So a TextBlock's markdown body carries a marker where the value belongs:
 *
 *   "On {{time:t1}}, {{location:e1}} is hosting the study weekend."
 *
 * and the referenced blocks stay in `Post.blocks[]` as ordinary siblings with
 * `placement: 'inline'`. That keeps three properties at once:
 *
 *   1. the sentence reads as one flowing line in the editor and when published,
 *   2. every existing extractor (email, newsletter, summaries, redaction) still
 *      walks `blocks[]` and sees the same typed data it always did,
 *   3. stripping the markers leaves clean, readable prose — so any consumer that
 *      has not been taught about inline blocks degrades to sensible text rather
 *      than leaking `{{time:t1}}` into an email.
 *
 * Pure + I/O-free. Cross-platform.
 */

import type { Block, BlockKind } from '../../types/post'

/** `{{kind:id}}` — kind is redundant with the block itself, but makes a raw body readable. */
const MARKER_RE = /\{\{([a-z]+):([A-Za-z0-9_-]+)\}\}/g

export interface InlineMarker {
  kind: BlockKind
  id: string
  /** Index of the marker within the body string. */
  start: number
  end: number
}

/** Build the marker text for a block. */
export function markerFor(block: Pick<Block, 'id' | 'kind'>): string {
  return `{{${block.kind}:${block.id}}}`
}

/** Every marker in a body, in order. */
export function findMarkers(body: string): InlineMarker[] {
  if (typeof body !== 'string') return []
  const out: InlineMarker[] = []
  MARKER_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MARKER_RE.exec(body)) !== null) {
    out.push({ kind: m[1] as BlockKind, id: m[2], start: m.index, end: m.index + m[0].length })
  }
  return out
}

/** True when the body references this block id inline. */
export function bodyReferences(body: string, blockId: string): boolean {
  return findMarkers(body).some((mk) => mk.id === blockId)
}

/**
 * A body split into its literal text runs and the markers between them, so a
 * renderer can walk it without re-implementing the regex. Always starts and ends
 * with a (possibly empty) text segment.
 */
export type BodySegment =
  | { type: 'text'; text: string }
  | { type: 'block'; marker: InlineMarker }

export function segmentBody(body: string): BodySegment[] {
  const segments: BodySegment[] = []
  let cursor = 0
  for (const marker of findMarkers(body)) {
    segments.push({ type: 'text', text: body.slice(cursor, marker.start) })
    segments.push({ type: 'block', marker })
    cursor = marker.end
  }
  segments.push({ type: 'text', text: body.slice(cursor) })
  return segments
}

/**
 * Replace each marker with a plain-text rendering of its block — the graceful
 * degradation path for any consumer that does not render inline widgets.
 * A marker whose block is missing collapses to nothing rather than leaking
 * `{{…}}` into an email.
 */
export function flattenMarkers(
  body: string,
  render: (block: Block) => string,
  blocksById: Map<string, Block>
): string {
  return segmentBody(body)
    .map((seg) => {
      if (seg.type === 'text') return seg.text
      const block = blocksById.get(seg.marker.id)
      return block ? render(block) : ''
    })
    .join('')
    // Collapse the double spaces a dropped marker can leave behind.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
}

/** Strip every marker, leaving bare prose (used for summaries and plain-text mail). */
export function stripMarkers(body: string): string {
  return flattenMarkers(body, () => '', new Map())
}

/** Index a post's blocks by id, for marker resolution. */
export function blockIndex(blocks: Block[]): Map<string, Block> {
  return new Map(blocks.map((b) => [b.id, b]))
}
