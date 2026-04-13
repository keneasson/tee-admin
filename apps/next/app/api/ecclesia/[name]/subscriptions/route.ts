import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { subscriptionRepository } from '@my/app/provider/dynamodb/repositories/subscription-repository'
import { getEcclesiaByName } from '@/utils/dynamodb/locations'
import { notificationRepository } from '@my/app/provider/dynamodb/repositories/notification-repository'
import { buildSystemNotification } from '@my/app/provider/dynamodb/repositories/notification-helpers'
import type { NotificationPreference } from '@my/app/provider/dynamodb/types'
import { checkEcclesiaEditPermission } from '@/utils/ecclesia-permissions'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * Subscriptions collection route
 * - GET: list subscriptions for [name]
 * - POST: create new subscription
 *
 * Feature-flagged behind MULTI_TENANT_INIT — returns 404 if the flag is off
 * for the calling user. Per-subscription mutations live at
 * `./[publisher]/route.ts`.
 */

/**
 * GET /api/ecclesia/[name]/subscriptions
 * Returns all ecclesias [name] currently subscribes to.
 * Requires member access + MULTI_TENANT_INIT feature flag.
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

    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!flagOn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)

    const subscriptions = await subscriptionRepository.getSubscriptions(ecclesiaName)

    // Enrich with publisher displayName where available (best effort)
    const enriched = await Promise.all(
      subscriptions.map(async (s) => {
        let publisherDisplayName: string | undefined
        try {
          const publisher = await getEcclesiaByName(s.publisherEcclesia)
          publisherDisplayName = publisher?.name
        } catch {
          /* ignore lookup errors */
        }
        return {
          publisherEcclesia: s.publisherEcclesia,
          publisherDisplayName,
          notificationPref: s.notificationPref,
          subscribedBy: s.subscribedBy,
          createdAt: s.createdAt,
        }
      })
    )

    return NextResponse.json({ success: true, subscriptions: enriched })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

/**
 * POST /api/ecclesia/[name]/subscriptions
 * Body: { publisherEcclesia: string, notificationPref?: NotificationPreference }
 * Requires edit permission for [name] + MULTI_TENANT_INIT feature flag.
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

    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!flagOn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { name } = await params
    const subscriberEcclesia = decodeURIComponent(name)

    const userEmail = session.user.email.toLowerCase()
    const userRole = (session.user as any).role || ROLES.GUEST
    const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, subscriberEcclesia)
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

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
      return NextResponse.json(
        { error: `Ecclesia "${publisherEcclesia}" not found` },
        { status: 404 }
      )
    }

    // Check if already subscribed
    const existing = await subscriptionRepository.getSubscription(
      subscriberEcclesia,
      publisherEcclesia
    )
    if (existing) {
      return NextResponse.json({ error: 'Already subscribed' }, { status: 409 })
    }

    const subscription = await subscriptionRepository.subscribe(
      subscriberEcclesia,
      publisher.name, // use canonical name from lookup
      session.user.email,
      notificationPref
    )

    // Notify publisher ecclesia's RB about the new subscriber (fire-and-forget)
    if (publisher.recordingBrotherEmail) {
      const notification = buildSystemNotification(
        publisher.recordingBrotherEmail,
        'New subscriber',
        `${subscriberEcclesia} has subscribed to your events.`,
        `/directory/ecclesias/${encodeURIComponent(publisher.name)}`
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
 * @deprecated Prefer `./[publisher]/route.ts` DELETE.
 * Body-based DELETE kept for backward compatibility with existing clients.
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

    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!flagOn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { name } = await params
    const subscriberEcclesia = decodeURIComponent(name)

    const userEmail = session.user.email.toLowerCase()
    const userRole = (session.user as any).role || ROLES.GUEST
    const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, subscriberEcclesia)
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

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
 * @deprecated Prefer `./[publisher]/route.ts` PATCH.
 * Body-based PATCH kept for backward compatibility with existing clients.
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

    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!flagOn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { name } = await params
    const subscriberEcclesia = decodeURIComponent(name)

    const userEmail = session.user.email.toLowerCase()
    const userRole = (session.user as any).role || ROLES.GUEST
    const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, subscriberEcclesia)
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { publisherEcclesia, notificationPref } = body as {
      publisherEcclesia: string
      notificationPref: NotificationPreference
    }

    if (!publisherEcclesia || !notificationPref) {
      return NextResponse.json(
        { error: 'publisherEcclesia and notificationPref are required' },
        { status: 400 }
      )
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
