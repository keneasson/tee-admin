import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { UpdatePostInput } from '@my/app/provider/dynamodb/repositories/post-repository'

/**
 * Admin Posts API (single) — Consolidated CMS Phase 2a.
 *   GET → load one post by id (edit case)
 *   PUT → update one post (the block editor's autosave target)
 *
 * Same three-way gate as the collection route: authenticated → owner/admin →
 * CONSOLIDATED_CMS flag ON (else 404).
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
    return NextResponse.json(post)
  } catch (error) {
    console.error('Error loading post:', error)
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await authorize()
  if (!gate.ok) return gate.res

  try {
    const { id } = await params
    const body = await request.json()

    // Only allow the caller to patch the editable fields (keys/id/tenant/
    // createdAt/authorId are immutable here).
    const patch: UpdatePostInput = {}
    if (body.title !== undefined) patch.title = body.title
    if (body.occasion !== undefined) patch.occasion = body.occasion
    if (body.summary !== undefined) patch.summary = body.summary
    if (body.visibility !== undefined) patch.visibility = body.visibility
    if (body.sharingScope !== undefined) patch.sharingScope = body.sharingScope
    if (body.lifecycle !== undefined) patch.lifecycle = body.lifecycle
    if (body.blocks !== undefined) patch.blocks = body.blocks
    if (body.status !== undefined) patch.status = body.status

    const post = await postRepository.updatePost(id, patch)
    return NextResponse.json(post)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }
    console.error('Error updating post:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}
