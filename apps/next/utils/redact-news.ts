/**
 * News PII read boundary (Consolidated CMS Phase 0, epic #131).
 *
 * Runs a legacy NewsItem through the unified block model
 * (`legacyToPost` → `redactPost`) for the resolved viewer, then projects the
 * result back onto the NewsItem shape so the client contract is unchanged. Only
 * `body` (a TextBlock) and `documents` (FlyerBlocks) can change: under a
 * PII-bearing occasion (e.g. `medical`) those blocks default to member reach, so
 * an anon reader sees the title + summary only.
 *
 * This is applied ONLY behind the CONSOLIDATED_CMS flag by the callers; with the
 * flag OFF the raw item is returned unchanged (byte-identical).
 */
import type { NewsItem } from '@my/app/types/news'
import type { TextBlock } from '@my/app/types/post'
import type { Viewer } from '@my/app/utils/viewer-pii'
import { legacyToPost } from '@my/app/utils/legacy-to-post'
import { redactPost } from '@my/app/utils/redact-post'

export function redactNewsForViewer(item: NewsItem, viewer: Viewer): NewsItem {
  const post = redactPost(legacyToPost(item), viewer, { channel: 'public-web' })
  if (!post) return { ...item, body: '', documents: [] }
  // The type-predicate narrows the find result to TextBlock, so no re-check is needed.
  const textBlock = post.blocks.find((b): b is TextBlock => b.kind === 'text')
  const hasFlyer = post.blocks.some((b) => b.kind === 'flyer')
  return {
    ...item,
    body: textBlock ? textBlock.body : '',
    documents: hasFlyer ? item.documents : [],
  }
}
