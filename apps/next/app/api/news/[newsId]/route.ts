import { NextRequest, NextResponse } from 'next/server'
import { getNewsItemById } from '@my/app/services/news-service'
import { isNewsActive } from '@my/app/types/news'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  try {
    const { newsId } = await params
    const news = await getNewsItemById(newsId)
    if (!news || !isNewsActive(news)) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }
    return NextResponse.json(news)
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
