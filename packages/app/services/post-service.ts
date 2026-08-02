import type { Post } from '@my/app/types/post'
import type { Channel, Viewer } from '@my/app/utils/viewer-pii'
import { redactPosts } from '@my/app/utils/redact-post'
import { legacyToPost } from '@my/app/utils/legacy-to-post'
import { getPostDisplayState } from '@my/app/utils/post-lifecycle'
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
  /**
   * Reference time for the unified lifecycle filter (Phase 4a). Defaults to
   * `new Date()`; INJECTABLE so callers/tests are deterministic. Posts that are
   * not active at this instant (unpublished, expired, or past their retrospective
   * window) are dropped.
   */
  now?: Date
}

/** A viewer-ready Post plus its lifecycle state (whether `now` is its eve-of reminder). */
export interface PostWithDisplayState {
  post: Post
  /** True when `now` is the bounded Thursday-before reminder for the next happening. */
  isReminder: boolean
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
 * THE unified read WITH lifecycle state: merged native + legacy posts, filtered
 * to those ACTIVE at `now` by the ONE display-rules engine
 * ({@link getPostDisplayState}), then redacted for the viewer. Each surviving
 * post carries its `isReminder` flag (the bounded Thursday-before eve-of).
 *
 * The lifecycle filter runs BEFORE redaction (it is reach-independent — a post's
 * active window doesn't depend on who is looking); `redactPosts` then reach-gates
 * and PII-scrubs, dropping anything the viewer can't see.
 *
 * NOTE (Phase 4a scope): this only governs the unified Post READ path (Phase 3
 * surface + future cutover). It does NOT touch the live legacy newsletter / events
 * / news code paths — that cutover is Phase 4b.
 */
export async function getPostsForViewerWithState(
  viewer: Viewer,
  options: GetPostsOptions = {}
): Promise<PostWithDisplayState[]> {
  const [native, legacy] = await Promise.all([
    loadNativePosts(options),
    loadLegacyPosts(options),
  ])

  const now = options.now ?? new Date()

  // Disjoint today → concat is the correct merge. Apply the unified lifecycle
  // rule, keeping the reminder flag alongside each active post.
  const active = [...native, ...legacy].flatMap((post) => {
    const state = getPostDisplayState(post, now)
    return state.active ? [{ post, isReminder: state.isReminder }] : []
  })

  const redacted = redactPosts(
    active.map((a) => a.post),
    viewer,
    { channel: options.channel }
  )

  // redactPosts preserves order and drops unreachable posts; re-attach the
  // reminder flag by id (ids are unique across the merged set).
  const reminderById = new Map(active.map((a) => [a.post.id, a.isReminder]))
  return redacted.map((post) => ({ post, isReminder: reminderById.get(post.id) ?? false }))
}

/**
 * THE unified read: merged native + legacy posts, filtered to those active at
 * `now` (unified lifecycle engine, Phase 4a), each redacted for the viewer.
 * Posts the viewer cannot reach are dropped by `redactPosts`. Callers that need
 * the eve-of reminder flag should use {@link getPostsForViewerWithState}.
 */
export async function getPostsForViewer(
  viewer: Viewer,
  options: GetPostsOptions = {}
): Promise<Post[]> {
  const withState = await getPostsForViewerWithState(viewer, options)
  return withState.map((w) => w.post)
}
