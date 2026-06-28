import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { createNewsItem, listNewsItems } from '@my/app/services/news-service'
import { authorizeContentEcclesia } from '@/utils/ecclesia-permissions'

/**
 * Admin News API — News Manager (Issue #41)
 * GET  → all news items including expired (admin only)
 * POST → create a news item (admin/owner)
 */

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role || ROLES.GUEST
    if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const items = await listNewsItems({ includeExpired: true })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error listing news (admin):', error)
    return NextResponse.json({ error: 'Failed to list news' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role || ROLES.GUEST

    const body = await request.json()
    if (!body.title || !body.body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 })
    }
    if (![1, 2, 3].includes(body.durationWeeks)) {
      return NextResponse.json({ error: 'durationWeeks must be 1, 2, or 3' }, { status: 400 })
    }

    // Ecclesia-scoped authorization — validate/derive the owning ecclesia
    // (defaults to the author's home ecclesia when not supplied).
    const authz = await authorizeContentEcclesia(session.user.email, role, body.ecclesiaId)
    if (!authz.ok) {
      return NextResponse.json({ error: authz.error }, { status: authz.status })
    }
    const ecclesiaId = authz.ecclesia

    const news = await createNewsItem({
      ecclesiaId,
      authorId: session.user.email,
      title: body.title,
      body: body.body,
      category: body.category,
      documents: Array.isArray(body.documents) ? body.documents : undefined,
      durationWeeks: body.durationWeeks,
      sharingScope: body.sharingScope || 'own',
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
    })

    return NextResponse.json(news, { status: 201 })
  } catch (error) {
    console.error('Error creating news:', error)
    return NextResponse.json({ error: 'Failed to create news' }, { status: 500 })
  }
}
