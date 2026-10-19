import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { render } from '@react-email/render'
import { createElement } from 'react'
import NewsAlert from 'email-builder/emails/NewsAlert'
import { emailSend } from '@/utils/email/email-send'
import { resolveSendList, SendListError } from '@/utils/mailing-lists/send-target'
import {
  getNewsItemById,
  markNewsBlastSent,
} from '@my/app/services/news-service'
import { isNewsActive, blastedAudiences } from '@my/app/types/news'
import { getPreviewImageUrl } from '@my/app/types/events'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { resolveBrandProfile } from '@/utils/email/resolve-brand-profile'
import { emailIdentityFromProfile } from '@my/app/types/brand-profile'
import { canAuthorForEcclesia } from '@/utils/ecclesia-permissions'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

export const config = {
  maxDuration: 60,
}

/**
 * POST /api/admin/news/[newsId]/send-alert — News Manager (Issue #41)
 * Triggers an email blast for a news item. One-shot: subsequent calls fail
 * unless ?force=true (admin/owner only override).
 * Query: ?test=true → send to test list only.
 *        ?list=<listId> → the audience (default: the newsletter list). An old
 *        list key ('newsletter', 'interEcclesia') is still accepted.
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

    const { newsId } = await params
    const { searchParams } = new URL(request.url)
    const isTest = searchParams.get('test') === 'true'
    const force = searchParams.get('force') === 'true'

    // Which list to blast to (R5: a registry list, by listId). Defaults to the
    // newsletter list. Test sends always go to the test list (in emailSend).
    const tenant = getTenantFromHeaders(request.headers) || resolveTenantFromEnv()
    let audience: Awaited<ReturnType<typeof resolveSendList>>
    try {
      audience = await resolveSendList({ reason: 'news-alert', list: searchParams.get('list'), tenant })
    } catch (error) {
      if (error instanceof SendListError) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }
    const audienceKey = audience.listId
    // Blasts recorded before lists had ids stored the list's key.
    const audienceAliases = [audience.listId, audience.key]

    const news = await getNewsItemById(newsId)
    if (!news) {
      return NextResponse.json({ error: 'News item not found' }, { status: 404 })
    }

    // Ecclesia-scoped authorization — only someone who manages this item's
    // owning ecclesia may blast an alert for it.
    const alertOwner = news.ecclesiaId || HOME_ECCLESIA.canonicalName
    const canSend = await canAuthorForEcclesia(session.user.email, role, alertOwner)
    if (!canSend) {
      return NextResponse.json(
        { error: `You do not have permission to manage content for ${alertOwner}.` },
        { status: 403 }
      )
    }
    if (!isNewsActive(news)) {
      return NextResponse.json({ error: 'News item has expired' }, { status: 400 })
    }
    // One-shot guard is now per-audience: a prior blast to one list never
    // blocks a fresh send to a different list.
    if (!isTest && !force && blastedAudiences(news).some((a) => audienceAliases.includes(a))) {
      return NextResponse.json(
        { error: `Alert already sent to '${audience.name}' for this news item.` },
        { status: 409 }
      )
    }

    // Resolve the brand domain so the "click to read" link points at the
    // correct surface (tee-admin.com vs echadhub.org). Falls back to the
    // deployment's env-configured tenant when the host isn't recognized.
    const detailsUrl = `https://www.${tenant.senderDomain}/news/${news.id}`

    // Brand the footer from the news item's owning ecclesia (per-org branding).
    // Identity is passed as a prop rather than via EmailIdentityProvider: that
    // provider is a `'use client'` component and can't be rendered as an element
    // from this App Router server route (react-dom/server can't invoke a client
    // reference). See NewsAlert/Footer `identity` prop.
    const profile = await resolveBrandProfile({ ownerEcclesiaName: news.ecclesiaId, tenant })
    const emailElement = createElement(NewsAlert as any, {
      title: news.title,
      body: news.body,
      detailsUrl,
      previewImageUrl: getPreviewImageUrl(news.documents),
      identity: {
        ...emailIdentityFromProfile(profile),
        // Header link back to the sending site (tee-admin.com / echadhub.org).
        homeUrl: `https://${tenant.senderDomain}`,
        homeLabel: tenant.publicName,
      },
      // "Please share with your ecclesia" framing is driven by the selected
      // audience (not the send mode), so it also applies to test sends.
      interEcclesia: audience.category === 'ecclesial_correspondence',
      // "From {ecclesia}" — the sending ecclesia's display name (e.g. "Toronto
      // East Ecclesia"), distinct from the footer's public name.
      fromEcclesia: profile.displayName,
    })
    const emailHtml = await render(emailElement)
    const emailText = await render(emailElement, { plainText: true })

    const result = await emailSend({
      reason: 'news-alert',
      emailHtml,
      emailText,
      test: isTest,
      listId: audience.listId,
      customSubject: news.title,
      subReason: 'general',
      description: `News alert: ${news.title} → ${audienceKey}`,
      sentBy: session.user.email,
      tenant,
    })

    if (result instanceof Error) {
      return NextResponse.json({ error: result.message }, { status: 500 })
    }

    if (!isTest) {
      await markNewsBlastSent(newsId, audienceKey)
    }

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      sentCount: result.sends.length,
      skippedCount: result.skips.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Error sending news alert:', message, error instanceof Error ? error.stack : error)
    return NextResponse.json(
      { success: false, error: `Failed to send news alert: ${message}` },
      { status: 500 }
    )
  }
}
