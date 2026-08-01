import { notFound } from 'next/navigation'
import { getPublicPost } from '../../../../utils/get-public-post'
import { PostViewScreen } from './post-view-screen'

/**
 * Public Post view page (Consolidated CMS epic #131, Phase 3).
 *
 * A SERVER component: it does the read + redaction on the server via
 * `getPublicPost` (flag gate → load → status gate → `redactPost` at the
 * `public-web` tier) and passes the already-redacted post to the client
 * `PostViewScreen`. When the post is hidden — flag OFF, missing, not `ready`, or
 * unreachable for the viewer — `getPublicPost` returns `null` and we `notFound()`
 * so the whole feature stays invisible while the flag is OFF.
 *
 * This is a NEW, additive surface. It does not touch the legacy events/news
 * pages, `/api/events/public`, or the newsletter render path.
 */

// Session/viewer-dependent redaction ⇒ never statically cache this page.
export const dynamic = 'force-dynamic'

export default async function PublicPostPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const post = await getPublicPost(id)
  if (!post) notFound()
  return <PostViewScreen post={post} />
}
