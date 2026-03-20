import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'

/**
 * GET /api/notifications - Get notifications for current user
 * Query params: ?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    const result = await notificationRepository.getNotifications(session.user.email, limit)
    const unreadCount = result.items.filter((n) => n.status === 'unread').length

    return NextResponse.json({
      notifications: result.items.map((n) => ({
        notificationId: n.notificationId,
        type: n.type,
        status: n.status,
        title: n.title,
        body: n.body,
        actionUrl: n.actionUrl,
        sourceId: n.sourceId,
        sourceType: n.sourceType,
        senderEmail: n.senderEmail,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })),
      unreadCount,
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
