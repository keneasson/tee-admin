import { auth } from './auth'
import { resolveViewer } from './resolve-viewer'
import { getPostsForViewer } from '@my/app/services/post-service'
import { isPostLive, resolvePostNextDate } from '@my/app/utils/post-lifecycle'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { Post } from '@my/app/types/post'

/** Active native posts for a public page, split by lifecycle facet. */
export interface PublicPosts {
  /** Event-shaped: has an upcoming happening at `now` → belongs on the events page. */
  events: Post[]
  /** News-shaped: no upcoming happening (none, or all past) → belongs on the news page. */
  news: Post[]
}

const EMPTY: PublicPosts = { events: [], news: [] }

/**
 * THE public-page read for the unified Post model (Consolidated CMS #131,
 * Phase 4b-1 — gradual cutover of the live web pages).
 *
 * This is the ADDITIVE half of the cutover: it surfaces NATIVE Posts (content
 * authored in the block editor) alongside the existing legacy events/news, which
 * keep rendering through their OWN untouched paths. It mirrors the discipline of
 * {@link getPublicPost} (the single-post read):
 *
 *   1. FLAG OFF → `{ events: [], news: [] }`. `CONSOLIDATED_CMS` gates the whole
 *      feature; while it's OFF this returns nothing extra and the live pages are
 *      byte-identical to today (fails closed on any flag-store error).
 *   2. Native-ONLY (`source: 'native'`) — legacy events/news are NOT pulled in
 *      here (they render via their existing path), so nothing double-renders.
 *      Native and legacy are disjoint today (no migration), so no dedup is needed.
 *   3. `getPostsForViewer` already redacts for the resolved viewer at the hard
 *      `public-web` tier and lifecycle-filters to ACTIVE at `now` — so a surname /
 *      precise address is present only if this viewer may see it, and only
 *      currently-active posts survive.
 *   4. Drafts/archived never leak: only `status: 'published'` posts are kept (the
 *      unified read does not itself filter status — this public door does).
 *
 * Facet split uses the ONE lifecycle engine: {@link resolvePostNextDate} — a post
 * with an upcoming happening is event-shaped (events page), otherwise news-shaped
 * (news page). `now` is INJECTABLE so callers/tests are deterministic.
 */
export async function getPublicPosts(now: Date = new Date()): Promise<PublicPosts> {
  // Flag gate first — feature hidden entirely while OFF.
  const session = await auth()
  const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, session as any)
  if (!flagOn) return EMPTY

  const viewer = await resolveViewer()
  // native only — legacy keeps its own render path (no double-render); redacted +
  // lifecycle-filtered to active by getPostsForViewer.
  const posts = await getPostsForViewer(viewer, {
    channel: 'public-web',
    source: 'native',
    now,
  })

  const events: Post[] = []
  const news: Post[] = []
  for (const post of posts) {
    // ONE liveness rule (isPostLive): drafts and archived never appear, and a
    // post scheduled for a future publishDate stays hidden until its date. That
    // scheduling half was previously written but never enforced (#227) — the
    // status check alone let a post scheduled for November be served today.
    if (!isPostLive(post, now)) continue
    if (resolvePostNextDate(post, now)) events.push(post)
    else news.push(post)
  }
  return { events, news }
}
