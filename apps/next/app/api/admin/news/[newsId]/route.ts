import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  deleteNewsItem,
  getNewsItemById,
  updateNewsItem,
} from '@my/app/services/news-service'

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = (session.user as any).role || ROLES.GUEST
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { session }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  const guard = await requireAdmin()
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
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  try {
    const { newsId } = await params
    const body = await request.json()

    if (body.durationWeeks !== undefined && ![1, 2, 3].includes(body.durationWeeks)) {
      return NextResponse.json({ error: 'durationWeeks must be 1, 2, or 3' }, { status: 400 })
    }

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
  const guard = await requireAdmin()
  if ('error' in guard) return guard.error

  try {
    const { newsId } = await params
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
