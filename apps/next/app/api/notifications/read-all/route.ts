import { NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'

/**
 * POST /api/notifications/read-all - Mark all notifications as read
 */
export async function POST() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const count = await notificationRepository.markAllAsRead(session.user.email)

    return NextResponse.json({ success: true, markedRead: count })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
