import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import {
  createEvent,
  getAllEvents,
  saveEventDraft,
  getEventById,
  deleteEvent
} from '@my/app/services/event-service'
import { invalidateEventsCache } from '@/utils/cache'

// Helper functions to extract date/time for sorting
const extractEventDate = (event: any): string => {
  let date: Date
  switch (event.type) {
    case 'funeral':
      date = event.serviceDate ? new Date(event.serviceDate) : new Date()
      break
    case 'wedding':
      date = event.ceremonyDate ? new Date(event.ceremonyDate) : new Date()
      break
    case 'baptism':
      date = event.baptismDate ? new Date(event.baptismDate) : new Date()
      break
    case 'study-weekend':
      date = event.dateRange?.start ? new Date(event.dateRange.start) : new Date()
      break
    case 'general':
      date = event.startDate ? new Date(event.startDate) : new Date()
      break
    case 'recurring':
      // Check both startDate and dateRange.start for recurring events
      if (event.recurringConfig?.startDate) {
        date = new Date(event.recurringConfig.startDate)
      } else if ((event.recurringConfig as any)?.dateRange?.start) {
        date = new Date((event.recurringConfig as any).dateRange.start)
      } else {
        date = new Date()
      }
      break
    default:
      date = new Date()
  }
  return date.toISOString().split('T')[0]
}

const extractEventTime = (event: any): string => {
  let date: Date
  switch (event.type) {
    case 'funeral':
      date = event.serviceDate ? new Date(event.serviceDate) : new Date()
      break
    case 'wedding':
      date = event.ceremonyDate ? new Date(event.ceremonyDate) : new Date()
      break
    case 'baptism':
      date = event.baptismDate ? new Date(event.baptismDate) : new Date()
      break
    case 'study-weekend':
      date = event.dateRange?.start ? new Date(event.dateRange.start) : new Date()
      break
    case 'general':
      date = event.startDate ? new Date(event.startDate) : new Date()
      break
    case 'recurring':
      return event.recurringConfig?.startTime || '00:00'
    default:
      date = new Date()
  }
  return date.toTimeString().slice(0, 5) // HH:MM format
}

/**
 * Admin Events API - Authentication required
 * Returns all events (including drafts) for admin management
 * Used by: Admin events page, event management components
 */
export async function GET(request: NextRequest) {
  try {
    // Admin access requires authentication
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('id')

    if (eventId) {
      const event = await getEventById(eventId)
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json(event)
    }

    // Return all events for admin, sorted by start date/time ascending
    const events = await getAllEvents(false)

    // Sort by start date/time in ascending order (earliest first)
    const sortedEvents = events.sort((a, b) => {
      const aDate = extractEventDate(a)
      const bDate = extractEventDate(b)
      const dateCompare = new Date(aDate).getTime() - new Date(bDate).getTime()

      if (dateCompare !== 0) return dateCompare

      // If same date, sort by time
      const aTime = extractEventTime(a)
      const bTime = extractEventTime(b)
      return aTime.localeCompare(bTime)
    })

    return NextResponse.json(sortedEvents)

  } catch (error) {
    console.error('Error in admin events API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventData = await request.json()
    eventData.createdBy = session.user.email

    // Determine if this is a draft save or full create
    let event
    if (eventData.isDraft) {
      event = await saveEventDraft(eventData)
    } else {
      event = await createEvent(eventData)
    }

    // Invalidate events cache if the event is published/ready
    if (event.status === 'published' || event.status === 'ready') {
      console.log('📰 Invalidating events cache after creating published event')
      await invalidateEventsCache()
    }

    return NextResponse.json(event, { status: 201 })

  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const eventData = await request.json()

    if (!eventData.id) {
      return NextResponse.json({ error: 'Event ID required for update' }, { status: 400 })
    }

    // Update uses saveEventDraft which handles both draft and published updates
    const event = await saveEventDraft(eventData)

    // Invalidate events cache if the event is published/ready
    if (event.status === 'published' || event.status === 'ready') {
      console.log('📰 Invalidating events cache after updating published event')
      await invalidateEventsCache()
    }

    return NextResponse.json(event)

  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    const success = await deleteEvent(eventId)

    if (!success) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Always invalidate cache when deleting an event
    console.log('📰 Invalidating events cache after deleting event')
    await invalidateEventsCache()

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}