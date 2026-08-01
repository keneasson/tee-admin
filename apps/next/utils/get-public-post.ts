import { auth } from './auth'
import { resolveViewer } from './resolve-viewer'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { redactPost } from '@my/app/utils/redact-post'
import type { Post } from '@my/app/types/post'

/**
 * THE public read for a single unified Post (Consolidated CMS epic #131, Phase 3).
 *
 * The one server boundary that both the public page (`/(public)/posts/[id]`) and
 * the public read API (`/api/posts/[id]`) call — so redaction + flag-gating live
 * in ONE place and can't drift. Returns the REDACTED post (safe to serialize to
 * any viewer), or `null` when the post must be hidden:
 *
 *   1. FLAG OFF → `null`. `CONSOLIDATED_CMS` gates the whole feature; while it's
 *      OFF the public route 404s and nothing about the unified model is exposed
 *      (fails closed on any flag-store error — see `checkFeatureFlagFromDB`).
 *   2. MISSING post → `null`.
 *   3. NOT publicly viewable → `null`. Only `status: 'ready'` posts are served;
 *      drafts and archived posts never leak through the public door.
 *   4. VIEWER CANNOT REACH → `null`. `redactPost` reach-gates by visibility and,
 *      crucially, PII-scrubs every surviving block for the resolved viewer at the
 *      hard `public-web` tier BEFORE serialization — a surname / precise address /
 *      bio is present in the result ONLY if this viewer is allowed to see it.
 *
 * This deliberately does NOT touch the legacy events/news read paths — it is a
 * new, additive, flag-gated surface (the lossy legacy swap is a later phase).
 */
export async function getPublicPost(id: string): Promise<Post | null> {
  // Flag gate first — feature hidden entirely while OFF.
  const session = await auth()
  const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, session as any)
  if (!flagOn) return null

  const post = await postRepository.getPost(id)
  if (!post) return null

  // Only published/ready posts are publicly viewable — never leak a draft.
  if (post.status !== 'ready') return null

  // Redact for the resolved viewer at the hard public-web tier. Returns null when
  // the viewer cannot reach the post's visibility at all.
  const viewer = await resolveViewer()
  return redactPost(post, viewer, { channel: 'public-web' })
}
