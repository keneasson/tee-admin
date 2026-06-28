import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  createEvent,
  getAllEvents,
  saveEventDraft,
  getEventById,
  deleteEvent
} from '@my/app/services/event-service'
import { isEventActive } from '@my/app/types/events'
import { invalidateEventsCache } from '@/utils/cache'
import { notifyRBsOfSharedEvent } from '@/utils/notify-rbs-of-shared-event'
import {
  authorizeContentEcclesia,
  canAuthorForEcclesia,
  canManageEcclesia,
  listManageableEcclesias,
} from '@/utils/ecclesia-permissions'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import type { Event } from '@my/app/types/events'

/** Ecclesia that owns an event for authz/scoping (display field + legacy fallback). */
const eventOwner = (event: Pick<Event, 'ownerEcclesia' | 'hostingEcclesia'>): string =>
  event.ownerEcclesia || event.hostingEcclesia?.name || HOME_ECCLESIA.canonicalName

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

    const callerRole = (session.user as any).role as string || ROLES.GUEST

    // Ecclesia-scoped read access: OWNER sees all; staff/RB see their own +
    // managed-region ecclesias. Anyone with no manageable ecclesias is denied.
    const manageable = await listManageableEcclesias(session.user.email, callerRole)
    if (!manageable.all && manageable.ecclesias.size === 0) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('id')

    if (eventId) {
      const event = await getEventById(eventId)
      if (!event) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      if (!canManageEcclesia(manageable, eventOwner(event))) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json(event)
    }

    // Return events the caller may manage, sorted by start date/time ascending
    const allEvents = await getAllEvents(false)
    const events = manageable.all
      ? allEvents
      : allEvents.filter((e) => canManageEcclesia(manageable, eventOwner(e)))

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

    const postCallerRole = (session.user as any).role as string || ROLES.GUEST

    const eventData = await request.json()
    eventData.createdBy = session.user.email

    // Ecclesia-scoped authorization — validate/derive the owning ecclesia and
    // stamp it server-side (never trust the raw client value). OWNER may author
    // for any ecclesia; scoped roles only for their own / managed region.
    const postAuthz = await authorizeContentEcclesia(
      session.user.email,
      postCallerRole,
      eventData.ownerEcclesia || eventData.hostingEcclesia?.name
    )
    if (!postAuthz.ok) {
      return NextResponse.json({ error: postAuthz.error }, { status: postAuthz.status })
    }
    eventData.ownerEcclesia = postAuthz.ecclesia

    // Determine if this is a draft save or full create
    let event
    if (eventData.isDraft) {
      event = await saveEventDraft(eventData)
    } else {
      event = await createEvent(eventData)
    }

    // Invalidate events cache if the event is active
    if (isEventActive(event)) {
      console.log('📰 Invalidating events cache after creating active event')
      await invalidateEventsCache()
      // Notify RBs of shared event (fire-and-forget)
      notifyRBsOfSharedEvent(event).catch(() => {})
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

    const putCallerRole = (session.user as any).role as string || ROLES.GUEST

    const eventData = await request.json()

    if (!eventData.id) {
      return NextResponse.json({ error: 'Event ID required for update' }, { status: 400 })
    }

    // Fetch old event to detect activation transitions + check ownership
    const oldEvent = await getEventById(eventData.id)
    const wasActive = oldEvent ? isEventActive(oldEvent) : false

    // Ecclesia-scoped authorization: must be allowed to manage the event's
    // current owner; if reassigning ownership, must also be allowed for the new one.
    const currentOwner =
      oldEvent?.ownerEcclesia || oldEvent?.hostingEcclesia?.name || HOME_ECCLESIA.canonicalName
    if (oldEvent) {
      const canEditExisting = await canAuthorForEcclesia(
        session.user.email,
        putCallerRole,
        currentOwner
      )
      if (!canEditExisting) {
        return NextResponse.json(
          { error: `You do not have permission to manage content for ${currentOwner}.` },
          { status: 403 }
        )
      }
    }
    const putAuthz = await authorizeContentEcclesia(
      session.user.email,
      putCallerRole,
      eventData.ownerEcclesia || eventData.hostingEcclesia?.name || currentOwner
    )
    if (!putAuthz.ok) {
      return NextResponse.json({ error: putAuthz.error }, { status: putAuthz.status })
    }
    eventData.ownerEcclesia = putAuthz.ecclesia

    // Update uses saveEventDraft which handles both draft and published updates
    const event = await saveEventDraft(eventData)

    // Invalidate events cache if the event is active
    if (isEventActive(event)) {
      console.log('📰 Invalidating events cache after updating active event')
      await invalidateEventsCache()
      // Notify RBs only on activation transition (inactive → active)
      if (!wasActive) {
        notifyRBsOfSharedEvent(event).catch(() => {})
      }
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

    const deleteCallerRole = (session.user as any).role as string || ROLES.GUEST

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    // Ecclesia-scoped authorization against the event's owner.
    const existing = await getEventById(eventId)
    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const deleteOwner =
      existing.ownerEcclesia || existing.hostingEcclesia?.name || HOME_ECCLESIA.canonicalName
    const canDelete = await canAuthorForEcclesia(
      session.user.email,
      deleteCallerRole,
      deleteOwner
    )
    if (!canDelete) {
      return NextResponse.json(
        { error: `You do not have permission to manage content for ${deleteOwner}.` },
        { status: 403 }
      )
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