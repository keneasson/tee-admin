import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { getSeriesForPost } from '@my/app/services/post-service'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * GET /api/admin/posts/[id]/series — Connect/series (Consolidated CMS epic
 * #131): the OTHER posts sharing this post's `seriesId` (empty array when the
 * post isn't part of a series). Powers the editor/list "part of a series — N
 * related" indicator. Unredacted (admin-only surface, same as the other admin
 * Posts routes) — see {@link getSeriesForPost}.
 *
 * Same three-way gate as the other admin Posts routes: authenticated →
 * owner/admin → CONSOLIDATED_CMS flag ON (else 404).
 */
async function authorize(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
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
  return { ok: true }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await authorize()
  if (!gate.ok) return gate.res

  try {
    const { id } = await params
    const post = await postRepository.getPost(id)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    const series = await getSeriesForPost(post)
    return NextResponse.json(series)
  } catch (error) {
    console.error('Error loading post series:', error)
    return NextResponse.json({ error: 'Failed to load post series' }, { status: 500 })
  }
}
