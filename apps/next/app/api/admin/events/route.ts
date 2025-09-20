import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import {
  createEvent,
  getAllEvents,
  saveEventDraft,
  getEventById,
  deleteEvent
} from '@my/app/services/event-service'

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

    // Return all events for admin
    const events = await getAllEvents(false)
    return NextResponse.json(events)

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
    if (eventData.isDraft) {
      const event = await saveEventDraft(eventData)
      return NextResponse.json(event, { status: 201 })
    } else {
      const event = await createEvent(eventData)
      return NextResponse.json(event, { status: 201 })
    }

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

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}