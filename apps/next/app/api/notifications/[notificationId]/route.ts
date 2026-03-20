import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'

/**
 * PATCH /api/notifications/[notificationId] - Mark notification as read
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { notificationId } = await params

    await notificationRepository.markAsRead(session.user.email, notificationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark notification read error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/[notificationId] - Delete a notification
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { notificationId } = await params

    await notificationRepository.deleteNotification(session.user.email, notificationId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete notification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
