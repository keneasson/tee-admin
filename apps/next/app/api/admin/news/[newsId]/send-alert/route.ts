import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { render } from '@react-email/render'
import { createElement } from 'react'
import NewsAlert from 'email-builder/emails/NewsAlert'
import { emailSend } from '@/utils/email/email-send'
import {
  getNewsItemById,
  markNewsBlastSent,
} from '@my/app/services/news-service'
import { isNewsActive } from '@my/app/types/news'

export const config = {
  maxDuration: 60,
}

/**
 * POST /api/admin/news/[newsId]/send-alert — News Manager (Issue #41)
 * Triggers an email blast for a news item. One-shot: subsequent calls fail
 * unless ?force=true (admin/owner only override).
 * Query: ?test=true → send to test list only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ newsId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role || ROLES.GUEST
    if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { newsId } = await params
    const { searchParams } = new URL(request.url)
    const isTest = searchParams.get('test') === 'true'
    const force = searchParams.get('force') === 'true'

    const news = await getNewsItemById(newsId)
    if (!news) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }
    if (!isNewsActive(news)) {
      return NextResponse.json({ error: 'News item has expired' }, { status: 400 })
    }
    if (news.emailBlastSentAt && !force && !isTest) {
      return NextResponse.json(
        { error: 'Alert already sent for this news item' },
        { status: 409 }
      )
    }

    const emailElement = createElement(NewsAlert as any, {
      title: news.title,
      body: news.body,
    })
    const emailHtml = await render(emailElement)
    const emailText = await render(emailElement, { plainText: true })

    const result = await emailSend({
      reason: 'news-alert',
      emailHtml,
      emailText,
      test: isTest,
      customSubject: news.title,
      subReason: 'general',
      description: `News alert: ${news.title}`,
      sentBy: session.user.email,
    })

    if (result instanceof Error) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    if (!isTest) {
      await markNewsBlastSent(newsId)
    }

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      sentCount: result.sends.length,
      skippedCount: result.skips.length,
    })
  } catch (error) {
    console.error('Error sending news alert:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send news alert' },
      { status: 500 }
    )
  }
}
