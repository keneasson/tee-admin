/**
 * The CANONICAL set of PII-bearing occasions — the single home for "does this
 * occasion routinely carry PII the redactor cannot locate?".
 *
 * WHY THIS FILE EXISTS: this membership set had drifted into two copies (the
 * Phase 0 adapter `legacy-to-post.ts` and the doc-editor's chrome), and the
 * copies disagreed — `engagement` was PII-bearing on the legacy read path but
 * NOT in the editor, so an engagement post's prose was gated on one path and
 * published public on the other. Occasion is DATA, and knowledge about occasions
 * belongs in `packages/app` where EVERY platform and BOTH editors read the same
 * answer. Never re-declare this set; import it.
 *
 * Under these occasions a TextBlock and a FlyerBlock default to `members` reach
 * (design §5, §8.3) — the redactor can't parse names out of prose or out of
 * pixels, so anon simply doesn't see them.
 *
 * Pure + I/O-free. Cross-platform: no platform imports.
 */

import type { OccasionTag } from '../types/post'

export const PII_BEARING_OCCASIONS: ReadonlySet<OccasionTag> = new Set<OccasionTag>([
  'funeral',
  'baptism',
  'engagement',
  'medical',
])

/** True when a post's occasion tags include at least one PII-bearing occasion. */
export function occasionIsPiiBearing(occasion: OccasionTag[]): boolean {
  return occasion.some((tag) => PII_BEARING_OCCASIONS.has(tag))
}
