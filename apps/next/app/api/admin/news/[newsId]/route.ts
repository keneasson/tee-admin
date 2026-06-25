import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  deleteNewsItem,
  getNewsItemById,
  updateNewsItem,
} from '@my/app/services/news-service'
import { canAuthorForEcclesia } from '@/utils/ecclesia-permissions'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session }
}

/**
 * Authorize the caller to manage a specific news item, scoped to its owning
 * ecclesia. Returns the item on success, or a NextResponse error (404/403).
 */
async function authorizeNewsItem(
  session: NonNullable<Awaited<ReturnType<typeof auth>>>,
  newsId: string
) {
  const news = await getNewsItemById(newsId)
  if (!news) {
    return { error: NextResponse.json({ error: 'News item not found' }, { status: 404 }) }
  }
  const role = (session.user as any).role || ROLES.GUEST
  const owner = news.ecclesiaId || HOME_ECCLESIA.canonicalName
  const allowed = await canAuthorForEcclesia(session.user!.email!, role, owner)
  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: `You do not have permission to manage content for ${owner}.` },
        { status: 403 }
      ),
    }
  }
  return { news }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error

  try {
    const { newsId } = await params
    const news = await getNewsItemById(newsId)
    if (!news) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }
    return NextResponse.json(news)
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error

  try {
    const { newsId } = await params
    const body = await request.json()

    if (body.durationWeeks !== undefined && ![1, 2, 3].includes(body.durationWeeks)) {
      return NextResponse.json({ error: 'durationWeeks must be 1, 2, or 3' }, { status: 400 })
    }

    // Ecclesia-scoped authorization against the item's owner.
    const authz = await authorizeNewsItem(guard.session, newsId)
    if ('error' in authz) return authz.error

    const updated = await updateNewsItem({
      ...body,
      id: newsId,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating news:', error)
    const message = error instanceof Error ? error.message : 'Failed to update news'
    const status = message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  const guard = await requireAuth()
  if ('error' in guard) return guard.error

  try {
    const { newsId } = await params

    // Ecclesia-scoped authorization against the item's owner.
    const authz = await authorizeNewsItem(guard.session, newsId)
    if ('error' in authz) return authz.error

    const ok = await deleteNewsItem(newsId)
    if (!ok) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting news:', error)
    return NextResponse.json({ error: 'Failed to delete news' }, { status: 500 })
  }
}
