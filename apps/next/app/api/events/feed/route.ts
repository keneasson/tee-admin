import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { subscriptionRepository } from '@my/app/provider/dynamodb/repositories/subscription-repository'
import { getFilteredEvents } from '@my/app/services/event-service'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getEcclesiaByName, getAllEcclesia } from '@/utils/dynamodb/locations'
import { resolveEventFeed } from '@my/app/services/event-sharing-resolver'
import type { SharingEcclesiaData } from '@my/app/services/event-sharing-resolver'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * GET /api/events/feed
 * Returns a cross-ecclesia event feed based on the user's ecclesia.
 *
 * Without MULTI_TENANT_INIT: own + subscribed ecclesias (original behaviour).
 * With MULTI_TENANT_INIT: own + subscribed + nearby (proximity-based) + global.
 *
 * Query params: ?days=90 (how far ahead to look)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role || ROLES.GUEST
    if (role === ROLES.GUEST || role === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    // Get user's ecclesia
    const person = await personRepository.getByEmail(session.user.email)
    const userEcclesia = person?.ecclesia
    if (!userEcclesia) {
      return NextResponse.json({ error: 'No ecclesia found for user' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const daysAhead = parseInt(searchParams.get('days') || '90', 10)

    // Get subscriptions for user's ecclesia
    const subscriptions = await subscriptionRepository.getSubscriptions(userEcclesia)
    const subscribedEcclesias = subscriptions.map((s) => s.publisherEcclesia)

    // Fetch events in date range
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + daysAhead)

    const result = await getFilteredEvents({
      dateFrom: startDate,
      dateTo: endDate,
      limit: 1000,
    })

    // Check if multi-tenant sharing is enabled
    const multiTenantEnabled = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)

    if (multiTenantEnabled) {
      // Full sharing resolution: own + subscribed + nearby + global
      const [ecclesiaData, allEcclesiasRaw] = await Promise.all([
        getEcclesiaByName(userEcclesia),
        getAllEcclesia(),
      ])

      const ecclesia: SharingEcclesiaData = {
        name: userEcclesia,
        latitude: ecclesiaData?.latitude,
        longitude: ecclesiaData?.longitude,
        country: ecclesiaData?.country,
        sharingPreference: ecclesiaData?.sharingPreference,
        sharingRadiusKm: ecclesiaData?.sharingRadiusKm,
        excludedEcclesias: ecclesiaData?.excludedEcclesias,
        nearbyEcclesias: ecclesiaData?.nearbyEcclesias,
      }

      const allEcclesias: SharingEcclesiaData[] = allEcclesiasRaw.map((e) => ({
        name: e.name,
        latitude: e.latitude,
        longitude: e.longitude,
        country: e.country,
        sharingPreference: e.sharingPreference,
        sharingRadiusKm: e.sharingRadiusKm,
        excludedEcclesias: e.excludedEcclesias,
        nearbyEcclesias: e.nearbyEcclesias,
      }))

      const feed = resolveEventFeed({
        ecclesia,
        subscribedEcclesias,
        allEcclesias,
        events: result.events,
      })

      return NextResponse.json({
        success: true,
        ecclesia: userEcclesia,
        subscribedTo: subscribedEcclesias,
        nearbyEcclesias: ecclesia.nearbyEcclesias || [],
        events: feed.allEvents,
        breakdown: {
          own: feed.ownEvents.length,
          subscribed: feed.subscribedEvents.length,
          nearby: feed.nearbyEvents.length,
          global: feed.globalEvents.length,
        },
        total: feed.allEvents.length,
      })
    }

    // Original behaviour: own + subscribed only
    const allEcclesias = [userEcclesia, ...subscribedEcclesias]

    const feedEvents = result.events.filter((event) => {
      if (!event.active && event.status !== 'published' && event.status !== 'ready') return false
      const eventEcclesia = event.hostingEcclesia?.name
      if (!eventEcclesia) return true // Events without an ecclesia are shown to everyone
      // membersOnly events from other ecclesias are hidden
      if (event.membersOnly && eventEcclesia !== userEcclesia) return false
      return allEcclesias.includes(eventEcclesia)
    })

    feedEvents.sort((a, b) => {
      const dateA = a.startDate || a.dateRange?.start || a.ceremonyDate || a.baptismDate || a.serviceDate
      const dateB = b.startDate || b.dateRange?.start || b.ceremonyDate || b.baptismDate || b.serviceDate
      if (!dateA) return 1
      if (!dateB) return -1
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })

    return NextResponse.json({
      success: true,
      ecclesia: userEcclesia,
      subscribedTo: subscribedEcclesias,
      events: feedEvents,
      total: feedEvents.length,
    })
  } catch (error) {
    console.error('Error fetching event feed:', error)
    return NextResponse.json({ error: 'Failed to fetch event feed' }, { status: 500 })
  }
}
