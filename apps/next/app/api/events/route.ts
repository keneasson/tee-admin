import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { 
  createEvent, 
  getAllEvents, 
  saveEventDraft,
  getEventById,
  deleteEvent
} from '@my/app/services/event-service'

export async function GET(request: NextRequest) {
  try {
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
    } else {
      const includeArchived = searchParams.get('includeArchived') === 'true'
      const events = await getAllEvents(includeArchived)
      return NextResponse.json(events)
    }
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch events' },
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
    
    // Add createdBy from session
    eventData.createdBy = session.user.email
    
    console.log('[API] Creating event:', eventData)
    
    const event = await createEvent(eventData)
    
    console.log('[API] Event created successfully:', event)
    
    return NextResponse.json(event)
  } catch (error) {
    console.error('[API] Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event', details: error instanceof Error ? error.message : 'Unknown error' },
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
    
    console.log('[API] Saving/updating event draft:', eventData)
    
    // Use saveEventDraft for auto-save functionality
    const event = await saveEventDraft({
      ...eventData,
      createdBy: eventData.createdBy || session.user.email
    })
    
    console.log('[API] Event draft saved successfully:', event)
    
    return NextResponse.json(event)
  } catch (error) {
    console.error('[API] Error saving event draft:', error)
    return NextResponse.json(
      { error: 'Failed to save event draft', details: error instanceof Error ? error.message : 'Unknown error' },
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
    
    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('id')
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }
    
    const success = await deleteEvent(eventId)
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
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