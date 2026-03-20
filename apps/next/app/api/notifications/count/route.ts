import { NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'

/**
 * GET /api/notifications/count - Lightweight unread count for polling
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const unreadCount = await notificationRepository.getUnreadCount(session.user.email)

    return NextResponse.json({ unreadCount })
  } catch (error) {
    console.error('Get notification count error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
