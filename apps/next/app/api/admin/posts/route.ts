import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import type { Post } from '@my/app/types/post'

/**
 * Admin Posts API — native unified-Post storage (Consolidated CMS epic #131,
 * Phase 2a). The save/load backend for the block editor.
 *
 *   GET  → list a tenant's posts (newest-first, includes drafts + archived)
 *   POST → create a post
 *
 * Gated three ways, in order: authenticated → owner/admin → CONSOLIDATED_CMS
 * feature flag ON. With the flag OFF the routes 404 (the feature does not exist
 * for un-flagged users), so nothing about the current app changes.
 */

/** Shared gate → returns either an error response or the authorized session. */
async function authorize(): Promise<
  { ok: true; session: NonNullable<Awaited<ReturnType<typeof auth>>> } | { ok: false; res: NextResponse }
> {
  const session = await auth()
  if (!session?.user?.email) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = (session.user as any).role
  if (role !== ROLES.OWNER && role !== ROLES.ADMIN) {
    return { ok: false, res: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, session as any)
  if (!flagOn) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { ok: true, session }
}

export async function GET(request: NextRequest) {
  const gate = await authorize()
  if (!gate.ok) return gate.res

  try {
    const tenant =
      new URL(request.url).searchParams.get('tenant') || HOME_ECCLESIA.canonicalName
    const { posts } = await postRepository.listPosts({ tenant, includeArchived: true })
    return NextResponse.json(posts)
  } catch (error) {
    console.error('Error listing posts (admin):', error)
    return NextResponse.json({ error: 'Failed to list posts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const gate = await authorize()
  if (!gate.ok) return gate.res

  try {
    const body = (await request.json()) as Partial<Post>
    const post = await postRepository.createPost({
      tenant: body.tenant || HOME_ECCLESIA.canonicalName,
      authorId: gate.session.user.email!,
      title: body.title ?? '',
      occasion: body.occasion ?? ['general'],
      summary: body.summary,
      visibility: body.visibility ?? 'public',
      sharingScope: body.sharingScope ?? 'own',
      lifecycle: body.lifecycle,
      blocks: body.blocks,
      status: body.status ?? 'draft',
    })
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
