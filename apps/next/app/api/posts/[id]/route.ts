import { NextResponse, type NextRequest } from 'next/server'
import { getPublicPost } from '../../../../utils/get-public-post'

/**
 * Public Post read API (Consolidated CMS epic #131, Phase 3).
 *
 * The PUBLIC counterpart to `/api/admin/posts/[id]` — but where the admin route
 * returns the RAW post to an owner/admin, this route returns the post ONLY after
 * `getPublicPost` has flag-gated it and run it through `redactPost` at the
 * `public-web` tier. It never exposes un-redacted PII, so it is safe for
 * anonymous callers. A hidden post (flag OFF, missing, not `ready`, or
 * unreachable for the viewer) is a 404 — the feature stays invisible.
 *
 * Distinct from the admin route by design: DO NOT point public clients at the
 * admin endpoint (it neither redacts nor is reachable without owner/admin).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const post = await getPublicPost(id)
    if (!post) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(post)
  } catch (error) {
    console.error('Error loading public post:', error)
    return NextResponse.json({ error: 'Failed to load post' }, { status: 500 })
  }
}
