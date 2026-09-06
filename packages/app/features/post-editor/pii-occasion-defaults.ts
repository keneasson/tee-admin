/**
 * Occasion-aware PII defaulting for the document-canvas editor (Consolidated CMS
 * Phase 2R-1 keystone; design doc §2 "PII gate").
 *
 * THE PROBLEM this closes: {@link docToBlocks} emits plain canvas prose as a
 * `TextBlock` with `containsPii: false` and NO `visibility` override — which by
 * design *inherits the post's reach* (public for a public post). So an obituary
 * or a medical update typed as ordinary prose under a `funeral` / `medical`
 * occasion would serialize PUBLIC. Under a PII-bearing occasion we therefore
 * default every prose text block to `containsPii: true` + `visibility: 'members'`
 * so anon simply never sees it — unless the author explicitly opts the post's
 * prose back to public via the "make prose public" toggle.
 *
 * This is a chrome-layer transform on the editor's derived blocks — NOT a change
 * to the doc ⇄ blocks bijection (which stays a pure, PII-preserving round-trip).
 * The pair {@link gatePiiProse} / {@link ungatePiiProse} is a clean inverse for
 * plain prose: the editor's Lexical state always holds bare (editable) prose, the
 * PERSISTED post holds the gated version, and the toggle flips between them
 * without ever mutating the editor — so gating is fully reversible and never
 * fragments prose into widgets.
 *
 * Pure + dependency-light: types only, unit-testable in a plain node env — and
 * cross-platform, so an Expo canvas gets the same PII gate for free. It lives in
 * `packages/app` (NOT the web app) because the gate is a rule about posts, not a
 * property of the Lexical canvas that happens to render them.
 */

import type { Block, OccasionTag, TextBlock } from '../../types/post'
import { occasionIsPiiBearing } from '../../utils/occasion-pii'

// The membership set itself lives in `utils/occasion-pii.ts` — the ONE home
// shared with the Phase 0 adapter. Re-exported here purely for callers that
// already reach for the editor module.
export { PII_BEARING_OCCASIONS, occasionIsPiiBearing } from '../../utils/occasion-pii'

/** The signature of a text block auto-gated by {@link gatePiiProse}. */
function isAutoGated(block: TextBlock): boolean {
  return block.containsPii === true && block.visibility === 'members'
}

/**
 * Gate canvas prose for PERSISTENCE. Under a PII-bearing occasion (and unless the
 * author has toggled make-public), every `text` block is forced to
 * `containsPii: true` + `visibility: 'members'` — the safe default. Non-text
 * blocks are returned untouched (their own per-block visibility round-trips via
 * the decorator payload, unchanged). Idempotent, and a no-op when the occasion is
 * not PII-bearing or make-public is on.
 */
export function gatePiiProse(
  blocks: Block[],
  occasion: OccasionTag[],
  makePublic: boolean
): Block[] {
  if (makePublic || !occasionIsPiiBearing(occasion)) return blocks
  return blocks.map((block) =>
    block.kind === 'text'
      ? ({ ...block, containsPii: true, visibility: 'members' } satisfies TextBlock)
      : block
  )
}

/**
 * The inverse used to SEED the editor: strip the auto-gate signature back to bare
 * prose (`containsPii: false`, no `visibility`) so the canvas always holds
 * editable text rather than a members-gated widget. Only applied under a
 * PII-bearing occasion — so a legacy post's *deliberate* members text under a
 * non-PII occasion is left exactly as-is (and still round-trips as a decorator).
 * Non-text blocks and non-auto-gated text blocks pass through unchanged.
 */
export function ungatePiiProse(blocks: Block[], occasion: OccasionTag[]): Block[] {
  if (!occasionIsPiiBearing(occasion)) return blocks
  return blocks.map((block) =>
    block.kind === 'text' && isAutoGated(block)
      ? ({ ...block, containsPii: false, visibility: undefined } satisfies TextBlock)
      : block
  )
}
