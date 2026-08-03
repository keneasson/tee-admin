import { getPostsForViewer } from '@my/app/services/post-service'
import { resolvePostNextDate } from '@my/app/utils/post-lifecycle'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { Post } from '@my/app/types/post'
import type { Viewer } from '@my/app/utils/viewer-pii'

/**
 * Active NATIVE Posts to fold into the weekly newsletter email (Consolidated CMS
 * epic #131, Phase 4b-2 — gradual cutover of the newsletter).
 *
 * This is the ADDITIVE half of the cutover: it surfaces NATIVE Posts (content
 * authored in the block editor) alongside the untouched legacy newsletter
 * sections, which keep rendering through their OWN path. It mirrors the
 * discipline of {@link getPublicPosts} (the web cutover):
 *
 *   1. FLAG OFF → `[]`. `CONSOLIDATED_CMS` gates the whole feature. The newsletter
 *      is a BROADCAST — there is no per-recipient session at assembly time — so
 *      the flag is read with a NULL session, which (like UNIVERSAL_EMAIL_LOGIN) is
 *      ON only when the flag is set to `'everyone'`. While it is anything else the
 *      newsletter gets NO extra content and is BYTE-IDENTICAL to today (fails
 *      closed on any flag-store error).
 *   2. Native-ONLY (`source: 'native'`) — legacy events/news are NOT pulled in
 *      here (they render via the newsletter's existing sections), so nothing
 *      double-renders. Native and legacy are disjoint today (no migration) → no
 *      dedup.
 *   3. MEMBER TIER. The newsletter goes to the opted-in member audience, so it
 *      renders at member tier — full names + full locations (redactor §8.2). The
 *      `'newsletter-email'` channel itself forces member reach + full-PII reveal;
 *      we ALSO pass a matching member-tier viewer so reach and PII agree.
 *   4. Lifecycle-governed: `getPostsForViewer` filters to posts ACTIVE at `now`
 *      via the ONE display-rules engine — so a "shower" Post with a FUTURE
 *      TimeBlock stays in the Thursday newsletter until the shower, then lingers
 *      its retrospective window (the whole point of the unified lifecycle).
 *   5. Drafts/archived never leak: only `status: 'ready'` posts are kept (the
 *      unified read does not gate status — this door does).
 *
 * Ordering: event-shaped (an upcoming happening at `now`) FIRST, then news-shaped,
 * using the ONE lifecycle engine ({@link resolvePostNextDate}). `now` is
 * INJECTABLE so callers/tests are deterministic.
 *
 * Cross-platform / server-safe: no `next-*` imports (repos are server-only), no
 * JSX — pure data. The returned posts are already redacted, ready to hand to the
 * server-safe `PostEmailView`.
 *
 * @param tenant Owning ecclesia/org name — scopes the read so a tenant's
 *   newsletter carries only its own native posts (multi-tenant correctness).
 */
export async function getNewsletterNativePosts(
  tenant: string,
  now: Date = new Date()
): Promise<Post[]> {
  // Flag gate first — feature hidden entirely (and the repo untouched) while OFF.
  // Broadcast context → null session → ON only at 'everyone'.
  const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, null)
  if (!flagOn) return []

  // Member-tier viewer for the newsletter audience. The channel already forces
  // member reach + full-PII reveal; this viewer keeps the two axes consistent.
  const viewer: Viewer = {
    assurance: 'authenticated',
    role: 'member',
    tenant,
    email: null,
  }

  const posts = await getPostsForViewer(viewer, {
    channel: 'newsletter-email',
    source: 'native',
    tenant,
    now,
  })

  // A broadcast surface never sends drafts/archived (unified read doesn't gate status).
  const ready = posts.filter((p) => p.status === 'ready')

  // Event-shaped (upcoming happening) first, then news-shaped.
  const eventShaped: Post[] = []
  const newsShaped: Post[] = []
  for (const post of ready) {
    if (resolvePostNextDate(post, now)) eventShaped.push(post)
    else newsShaped.push(post)
  }
  return [...eventShaped, ...newsShaped]
}
