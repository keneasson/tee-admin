import type { Post } from '@my/app/types/post'
import type { Channel, Viewer } from '@my/app/utils/viewer-pii'
import { redactPosts } from '@my/app/utils/redact-post'
import { legacyToPost } from '@my/app/utils/legacy-to-post'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { getPublishedEvents } from '@my/app/services/event-service'
import { listNewsItems } from '@my/app/services/news-service'

/**
 * Unified Post read service (Consolidated CMS epic #131, Phase 1).
 *
 * `getPostsForViewer` is the doc's "ONE read API + redactor"
 * (docs/UNIFIED_POST_MODEL_DESIGN.md §6): it returns the merged, PII-redacted set
 * of
 *   1. NATIVE posts from {@link PostRepository} (the Phase 1 storage), and
 *   2. LEGACY events + news adapted through {@link legacyToPost} (adapter-read
 *      during the transition, §7 Phase 1),
 * every item passed through {@link redactPost} for the (viewer, channel) so the
 * caller never has to scrub PII itself. Native and legacy are DISJOINT today
 * (nothing has been migrated), so the merge is a concat — no dedupe needed yet;
 * once Phase 3 migrates records this becomes a real "one current definition"
 * merge keyed on post id.
 *
 * FLAG-GATED WIRE-IN (deferred to Phase 2): this service is additive and is NOT
 * yet wired into any existing public read path, so nothing here changes current
 * responses — the flag-OFF behaviour of every shipped surface is byte-identical
 * by construction. Phase 2 (the block editor) is the first real consumer; when a
 * caller wires this into an existing read path (e.g. `/api/events/public`,
 * `/api/events/feed`) it MUST gate on the CONSOLIDATED_CMS flag
 * (`checkFeatureFlagFromDB`) exactly as `/api/news` already does for the Phase 0
 * redactor, and fall back to the legacy response when the flag is OFF.
 *
 * Cross-platform: no `next-auth` / `next/*` imports (server-only via the repos).
 */

export interface GetPostsOptions {
  /** Redaction channel — 'public-web' (default) hard-redacts; 'newsletter-email' is member-tier. */
  channel?: Channel
  /** Scope to a single tenant (ecclesia/org). Omit to include all tenants. */
  tenant?: string
  /** Include archived native posts / inactive legacy records. Default false. */
  includeArchived?: boolean
}

/** Load native posts, honoring the optional tenant scope. */
async function loadNativePosts(opts: GetPostsOptions): Promise<Post[]> {
  if (opts.tenant) {
    const { posts } = await postRepository.listPosts({
      tenant: opts.tenant,
      includeArchived: opts.includeArchived,
    })
    return posts
  }
  return postRepository.listAllPosts({ includeArchived: opts.includeArchived })
}

/**
 * Load legacy events + news and adapt them into the Post model via
 * `legacyToPost`. Optionally scoped to a tenant (post.tenant is derived from the
 * legacy record's owning ecclesia).
 */
async function loadLegacyPosts(opts: GetPostsOptions): Promise<Post[]> {
  const [events, news] = await Promise.all([
    getPublishedEvents(),
    listNewsItems({ includeExpired: false }),
  ])

  const adapted = [...events, ...news].map((record) => legacyToPost(record))
  if (!opts.tenant) return adapted
  return adapted.filter((post) => post.tenant === opts.tenant)
}

/**
 * THE unified read: merged native + legacy posts, each redacted for the viewer.
 * Posts the viewer cannot reach are dropped by `redactPosts`.
 */
export async function getPostsForViewer(
  viewer: Viewer,
  options: GetPostsOptions = {}
): Promise<Post[]> {
  const [native, legacy] = await Promise.all([
    loadNativePosts(options),
    loadLegacyPosts(options),
  ])

  // Disjoint today → concat is the correct merge. redactPosts reach-gates and
  // PII-scrubs, dropping anything the viewer can't see.
  const merged = [...native, ...legacy]
  return redactPosts(merged, viewer, { channel: options.channel })
}
