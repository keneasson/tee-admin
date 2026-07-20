import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getPublishedEvents } from '@my/app/services/event-service'
import { redactEventsForViewer } from '@my/app/utils/redact-event'
import { ANONYMOUS_VIEWER } from '@my/app/utils/viewer-pii'
import { CACHE_TAGS } from '@/utils/cache'

// Cache duration: revalidate daily at midnight (86400 seconds = 24 hours)
// In development, disable caching for immediate updates
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 86400 : false

// Create cached version of getPublishedEvents
const getCachedPublishedEvents = unstable_cache(
  async () => {
    console.log('🔄 Cache miss - fetching fresh events from DynamoDB')
    const events = await getPublishedEvents()
    // This endpoint is unauthenticated → anonymous tier. Redact PII server-side
    // BEFORE it enters the response cache, so the cache literally cannot hold (and
    // this route cannot leak) last names, street addresses, bios, or contact
    // details. Full data is served to members via authenticated endpoints; the
    // newsletter EMAIL renders member-tier via its own channel (see redact-event).
    return redactEventsForViewer(events, ANONYMOUS_VIEWER, 'public-web')
  },
  ['published-events'],
  {
    tags: [
      CACHE_TAGS.EVENTS_PUBLIC,
      CACHE_TAGS.EVENTS_ALL,
      CACHE_TAGS.NEWSLETTER,
      CACHE_TAGS.ALL_API_RESPONSES
    ],
    revalidate: CACHE_DURATION
  }
)

/**
 * Public Events API - No authentication required
 * Returns only published/ready events for public consumption
 * Used by: Newsletter page, Events page, public-facing components
 *
 * Caching: 24-hour cache with automatic revalidation at midnight
 * Cache invalidation: Triggered when events are created/updated/deleted
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('id')

    const events = await getCachedPublishedEvents()

    if (eventId) {
      const event = events.find(e => e.id === eventId)
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json(event, {
        headers: {
          'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=300`,
          'X-Data-Source': 'dynamodb-cache',
          'X-Cache-Tags': [CACHE_TAGS.EVENTS_PUBLIC, CACHE_TAGS.EVENTS_ALL].join(','),
        }
      })
    }

    console.log(`✅ Served ${events.length} published events from cache`)

    return NextResponse.json(events, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=300`,
        'X-Data-Source': 'dynamodb-cache',
        'X-Event-Count': events.length.toString(),
        'X-Cache-Tags': [CACHE_TAGS.EVENTS_PUBLIC, CACHE_TAGS.EVENTS_ALL].join(','),
      }
    })
  } catch (error) {
    console.error('Error fetching published events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}