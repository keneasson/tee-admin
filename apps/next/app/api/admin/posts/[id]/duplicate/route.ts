import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * POST /api/admin/posts/[id]/duplicate — Duplicate/replicate (Consolidated CMS
 * epic #131). Clones the source post's STRUCTURE (title/occasion/blocks) into
 * a fresh `draft`, with brand-new block ids, so an annual gathering or study
 * day isn't rebuilt from scratch. The duplicate auto-joins the source's series
 * (Connect/series) — see {@link postRepository.duplicatePost}.
 *
 * Same three-way gate as the other admin Posts routes: authenticated →
 * owner/admin → CONSOLIDATED_CMS flag ON (else 404).
 */
async function authorize(): Promise<
  { ok: true; authorId: string } | { ok: false; res: NextResponse }
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
  return { ok: true, authorId: session.user.email }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await authorize()
  if (!gate.ok) return gate.res

  try {
    const { id } = await params
    const post = await postRepository.duplicatePost(id, gate.authorId)
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    console.error('Error duplicating post:', error)
    return NextResponse.json({ error: 'Failed to duplicate post' }, { status: 500 })
  }
}
