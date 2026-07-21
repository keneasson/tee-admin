import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { getPublishedEvents } from '@my/app/services/event-service'
import { redactEventsForViewer } from '@my/app/utils/redact-event'
import { resolveViewer } from '@/utils/resolve-viewer'
import { piiAwareCacheControl } from '@/utils/pii-response'
import { CACHE_TAGS } from '@/utils/cache'

// Cache duration: revalidate daily at midnight (86400 seconds = 24 hours)
// In development, disable caching for immediate updates
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 86400 : false

// Create cached version of getPublishedEvents
const getCachedPublishedEvents = unstable_cache(
  async () => {
    console.log('🔄 Cache miss - fetching fresh events from DynamoDB')
    // Cache the RAW events; redaction is applied PER REQUEST in the handler so a
    // signed-in member sees full names while anonymous visitors are scrubbed. The
    // shared Data Cache holds full data (server-side only, never served directly),
    // and every response goes through redactEventsForViewer before it leaves. PII-
    // bearing (authenticated) responses are marked private/no-store so the CDN
    // never caches a full-name copy. Key bumped to 'raw-v1' to abandon the old
    // pre-redacted entries that Vercel's Data Cache persists across deploys.
    return getPublishedEvents()
  },
  ['published-events', 'raw-v1'],
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

    // Redact per viewer: signed-in members see full names, anonymous visitors are
    // scrubbed. `Vary: Cookie` + private/no-store on PII responses keeps the shared
    // cache anonymous-only.
    const viewer = await resolveViewer()
    const rawEvents = await getCachedPublishedEvents()
    const events = redactEventsForViewer(rawEvents, viewer, 'public-web')
    const publicCache = `public, max-age=${CACHE_DURATION}, stale-while-revalidate=300`

    if (eventId) {
      const event = events.find(e => e.id === eventId)
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json(event, {
        headers: {
          'Cache-Control': piiAwareCacheControl(viewer, publicCache),
          'Vary': 'Cookie',
          'X-Data-Source': 'dynamodb-cache',
          'X-Cache-Tags': [CACHE_TAGS.EVENTS_PUBLIC, CACHE_TAGS.EVENTS_ALL].join(','),
        }
      })
    }

    console.log(`✅ Served ${events.length} published events from cache`)

    return NextResponse.json(events, {
      headers: {
        'Cache-Control': piiAwareCacheControl(viewer, publicCache),
        'Vary': 'Cookie',
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