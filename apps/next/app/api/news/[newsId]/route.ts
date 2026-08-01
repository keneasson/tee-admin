import { NextRequest, NextResponse } from 'next/server'
import { getNewsItemById } from '@my/app/services/news-service'
import { isNewsActive } from '@my/app/types/news'
import { auth } from '@/utils/auth'
import { resolveViewer } from '@/utils/resolve-viewer'
import { redactNewsForViewer } from '@/utils/redact-news'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * Public news detail. PII read boundary mirrors the list route: behind the
 * CONSOLIDATED_CMS flag the item is scrubbed via the block model for the
 * resolved viewer; flag OFF → returned unchanged (byte-identical).
 */
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

    const session = await auth()
    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.CONSOLIDATED_CMS, session as any)
    if (!flagOn) {
      return NextResponse.json(news)
    }

    const viewer = await resolveViewer()
    return NextResponse.json(redactNewsForViewer(news, viewer))
  } catch (error) {
    console.error('Error fetching news:', error)
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}
