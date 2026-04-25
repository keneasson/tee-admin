import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { subscriptionRepository } from '@my/app/provider/dynamodb/repositories/subscription-repository'
import type { NotificationPreference } from '@my/app/provider/dynamodb/types'
import { checkEcclesiaEditPermission } from '@/utils/ecclesia-permissions'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * Per-subscription mutation route
 * - PATCH: update notification preference for a single subscription
 * - DELETE: remove a single subscription
 *
 * Route params:
 *   [name]      = subscriberEcclesia (the ecclesia doing the subscribing)
 *   [publisher] = publisherEcclesia  (the ecclesia being subscribed to)
 *
 * Auth: caller must have edit permission on [name].
 * Feature-flagged behind MULTI_TENANT_INIT — returns 404 if flag is off.
 */

async function assertAccess(
  session: any,
  subscriberEcclesia: string
): Promise<NextResponse | null> {
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session)
  if (!flagOn) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const userEmail = session.user.email.toLowerCase()
  const userRole = session.user.role || ROLES.GUEST
  const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, subscriberEcclesia)
  if (!canEdit) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  return null
}

/**
 * PATCH /api/ecclesia/[name]/subscriptions/[publisher]
 * Body: { notificationPref: 'all' | 'major' | 'none' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string; publisher: string }> }
) {
  try {
    const session = await auth()
    const { name, publisher } = await params
    const subscriberEcclesia = decodeURIComponent(name)
    const publisherEcclesia = decodeURIComponent(publisher)

    const blocked = await assertAccess(session, subscriberEcclesia)
    if (blocked) return blocked

    const body = await request.json()
    const { notificationPref } = body as { notificationPref: NotificationPreference }

    if (
      notificationPref !== 'all' &&
      notificationPref !== 'major' &&
      notificationPref !== 'none'
    ) {
      return NextResponse.json(
        { error: 'notificationPref must be "all", "major", or "none"' },
        { status: 400 }
      )
    }

    // Ensure the subscription exists before updating
    const existing = await subscriptionRepository.getSubscription(
      subscriberEcclesia,
      publisherEcclesia
    )
    if (!existing) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const updated = await subscriptionRepository.updateNotificationPref(
      subscriberEcclesia,
      publisherEcclesia,
      notificationPref
    )

    return NextResponse.json({
      success: true,
      subscription: {
        publisherEcclesia: updated.publisherEcclesia,
        notificationPref: updated.notificationPref,
        subscribedBy: updated.subscribedBy,
        createdAt: updated.createdAt,
      },
    })
  } catch (error) {
    console.error('Error updating subscription pref:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

/**
 * DELETE /api/ecclesia/[name]/subscriptions/[publisher]
 * Removes a single subscription.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string; publisher: string }> }
) {
  try {
    const session = await auth()
    const { name, publisher } = await params
    const subscriberEcclesia = decodeURIComponent(name)
    const publisherEcclesia = decodeURIComponent(publisher)

    const blocked = await assertAccess(session, subscriberEcclesia)
    if (blocked) return blocked

    await subscriptionRepository.unsubscribe(subscriberEcclesia, publisherEcclesia)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
  }
}
