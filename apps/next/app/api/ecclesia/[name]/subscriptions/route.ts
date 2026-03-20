import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { subscriptionRepository } from '@my/app/provider/dynamodb/repositories/subscription-repository'
import { getEcclesiaByName } from '@/utils/dynamodb/locations'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'
import { buildSystemNotification } from '@my/app/provider/dynamodb/repositories/notification-helpers'
import type { NotificationPreference } from '@my/app/provider/dynamodb/types'

/**
 * GET /api/ecclesia/[name]/subscriptions
 * List all ecclesias that [name] subscribes to.
 * Requires member access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role || ROLES.GUEST
    if (role === ROLES.GUEST || role === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)

    const subscriptions = await subscriptionRepository.getSubscriptions(ecclesiaName)

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions.map((s) => ({
        publisherEcclesia: s.publisherEcclesia,
        notificationPref: s.notificationPref,
        subscribedBy: s.subscribedBy,
        createdAt: s.createdAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

/**
 * POST /api/ecclesia/[name]/subscriptions
 * Subscribe [name] to another ecclesia's events.
 * Body: { publisherEcclesia: string, notificationPref?: NotificationPreference }
 * Requires admin or owner.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
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

    const { name } = await params
    const subscriberEcclesia = decodeURIComponent(name)

    const body = await request.json()
    const { publisherEcclesia, notificationPref = 'all' } = body as {
      publisherEcclesia: string
      notificationPref?: NotificationPreference
    }

    if (!publisherEcclesia) {
      return NextResponse.json({ error: 'publisherEcclesia is required' }, { status: 400 })
    }

    if (publisherEcclesia === subscriberEcclesia) {
      return NextResponse.json({ error: 'Cannot subscribe to yourself' }, { status: 400 })
    }

    // Verify publisher ecclesia exists
    const publisher = await getEcclesiaByName(publisherEcclesia)
    if (!publisher) {
      return NextResponse.json({ error: `Ecclesia "${publisherEcclesia}" not found` }, { status: 404 })
    }

    // Check if already subscribed
    const existing = await subscriptionRepository.getSubscription(subscriberEcclesia, publisherEcclesia)
    if (existing) {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
    }

    const subscription = await subscriptionRepository.subscribe(
      subscriberEcclesia,
      publisherEcclesia,
      session.user.email,
      notificationPref
    )

    // Notify publisher ecclesia's RB about the new subscriber (fire-and-forget)
    if (publisher.recordingBrotherEmail) {
      const notification = buildSystemNotification(
        publisher.recordingBrotherEmail,
        'New subscriber',
        `${subscriberEcclesia} has subscribed to your events.`,
        `/ecclesia/${encodeURIComponent(publisherEcclesia)}`
      )
      notificationRepository.createNotification(notification).catch((err) => {
        console.error('Failed to notify RB of new subscription (non-blocking):', err)
      })
    }

    return NextResponse.json({ success: true, subscription }, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}

/**
 * DELETE /api/ecclesia/[name]/subscriptions
 * Unsubscribe [name] from another ecclesia.
 * Body: { publisherEcclesia: string }
 * Requires admin or owner.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
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

    const { name } = await params
    const subscriberEcclesia = decodeURIComponent(name)

    const body = await request.json()
    const { publisherEcclesia } = body as { publisherEcclesia: string }

    if (!publisherEcclesia) {
      return NextResponse.json({ error: 'publisherEcclesia is required' }, { status: 400 })
    }

    await subscriptionRepository.unsubscribe(subscriberEcclesia, publisherEcclesia)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
  }
}

/**
 * PATCH /api/ecclesia/[name]/subscriptions
 * Update notification preference for a subscription.
 * Body: { publisherEcclesia: string, notificationPref: NotificationPreference }
 * Requires admin or owner.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
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

    const { name } = await params
    const subscriberEcclesia = decodeURIComponent(name)

    const body = await request.json()
    const { publisherEcclesia, notificationPref } = body as {
      publisherEcclesia: string
      notificationPref: NotificationPreference
    }

    if (!publisherEcclesia || !notificationPref) {
      return NextResponse.json({ error: 'publisherEcclesia and notificationPref are required' }, { status: 400 })
    }

    const updated = await subscriptionRepository.updateNotificationPref(
      subscriberEcclesia,
      publisherEcclesia,
      notificationPref
    )

    return NextResponse.json({ success: true, subscription: updated })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}
