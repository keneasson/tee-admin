import { NextRequest, NextResponse } from 'next/server'
import { getPublishedEvents } from '@my/app/services/event-service'

/**
 * Public Events API - No authentication required
 * Returns only published/ready events for public consumption
 * Used by: Newsletter page, Events page, public-facing components
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('id')

    if (eventId) {
      const events = await getPublishedEvents()
      const event = events.find(e => e.id === eventId)
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json(event)
    }

    const events = await getPublishedEvents()
    return NextResponse.json(events)
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