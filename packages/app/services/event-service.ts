import { scheduleRepo } from '@my/app/provider/dynamodb'
import { Event, EventFilters, EventListResponse, UpdateEventRequest, EventType } from '@my/app/types/events'
import type { ScheduleRecord } from '@my/app/provider/dynamodb/types'
import { EventValidator } from '@my/app/utils/event-validation'
import { v4 as uuidv4 } from 'uuid'

/**
 * Event Service Functions - Functional approach for comprehensive event management
 * 
 * Extends the existing scheduleRepo to work with full Event types
 * Uses the same tee-schedules table with existing key patterns:
 * 
 * Comprehensive Events: PK: EVENT#{eventId}, SK: DETAILS
 * GSI1: ECCLESIA#{hostingEcclesiaName}, GSI1SK: {date}#{type}#{time}
 * GSI2: TYPE#{eventType} or DATE#{date}
 */

// Helper functions for event data transformation

const extractHostingEcclesia = (event: Event): string => {
  switch (event.type) {
    case 'study-weekend':
      return event.hostingEcclesia?.name || 'Unknown Ecclesia'
    case 'wedding':
      return event.hostingEcclesia?.name || 'Unknown Ecclesia'
    case 'baptism':
      return event.hostingEcclesia?.name || 'Unknown Ecclesia'
    case 'general':
      return event.hostingEcclesia?.name || 'Unknown Ecclesia'
    default:
      return 'Unknown Ecclesia'
  }
}

const extractEventDate = (event: Event): string => {
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
      date = event.recurringConfig?.startDate ? new Date(event.recurringConfig.startDate) : new Date()
      break
    default:
      date = new Date()
  }

  // Validate the date before converting to ISO string
  if (isNaN(date.getTime())) {
    console.warn('[extractEventDate] Invalid date detected, using current date as fallback')
    date = new Date()
  }
  
  return date.toISOString().split('T')[0]
}

const extractEventTime = (event: Event): string => {
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
      return event.recurringConfig.startTime
    default:
      date = new Date()
  }

  return date.toTimeString().slice(0, 5) // HH:MM format
}

const serializeEventData = (event: Event): string => {
  try {
    return JSON.stringify(event, null, 0) // Compact JSON
  } catch (error) {
    throw new Error(`Failed to serialize event data: ${error}`)
  }
}

const deserializeEventData = (eventDataJson: string): Event => {
  try {
    const parsed = JSON.parse(eventDataJson)
    
    // Convert date strings back to Date objects
    if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt)
    if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt)
    if (parsed.publishDate) parsed.publishDate = new Date(parsed.publishDate)
    
    // Convert event-specific dates
    if (parsed.serviceDate) parsed.serviceDate = new Date(parsed.serviceDate)
    if (parsed.ceremonyDate) parsed.ceremonyDate = new Date(parsed.ceremonyDate)
    if (parsed.baptismDate) parsed.baptismDate = new Date(parsed.baptismDate)
    if (parsed.startDate) parsed.startDate = new Date(parsed.startDate)
    if (parsed.endDate) parsed.endDate = new Date(parsed.endDate)
    if (parsed.dateRange) {
      parsed.dateRange.start = new Date(parsed.dateRange.start)
      parsed.dateRange.end = new Date(parsed.dateRange.end)
    }

    return parsed as Event
  } catch (error) {
    throw new Error(`Failed to deserialize event data: ${error}`)
  }
}

const generateSearchableContent = (event: Event): string => {
  const searchParts: string[] = [
    event.title,
    event.description || '',
    event.type,
  ]
  
  // Add type-specific searchable content
  switch (event.type) {
    case 'study-weekend':
      searchParts.push(event.theme || '')
      searchParts.push(event.speakers?.map(s => `${s.firstName} ${s.lastName}`).join(' ') || '')
      searchParts.push(event.hostingEcclesia?.name || '')
      break
    case 'funeral':
      searchParts.push(`${event.deceased.firstName} ${event.deceased.lastName}`)
      break
    case 'wedding':
      searchParts.push(`${event.couple.bride.firstName} ${event.couple.bride.lastName}`)
      searchParts.push(`${event.couple.groom.firstName} ${event.couple.groom.lastName}`)
      searchParts.push(event.hostingEcclesia?.name || '')
      break
    case 'baptism':
      searchParts.push(`${event.candidate.firstName} ${event.candidate.lastName}`)
      searchParts.push(event.hostingEcclesia?.name || '')
      break
    case 'general':
      searchParts.push(event.customType || '')
      searchParts.push(event.hostingEcclesia?.name || '')
      break
    case 'recurring':
      searchParts.push(event.hostingEcclesia?.name || '')
      break
  }
  
  return searchParts.filter(Boolean).join(' ').toLowerCase()
}

const scheduleRecordToEvent = (record: ScheduleRecord): Event => {
  if (!record.details) {
    throw new Error('Event data not found in schedule record')
  }

  try {
    // Handle both legacy (object) and new (JSON string) formats
    let eventData: Event
    if (typeof record.details === 'string') {
      eventData = deserializeEventData(record.details)
    } else {
      // Legacy format - convert object to Event
      eventData = {
        id: record.eventId!,
        title: record.title!,
        type: 'general' as EventType, // Default fallback
        createdBy: 'system',
        createdAt: new Date(record.lastUpdated),
        updatedAt: new Date(record.lastUpdated),
        status: 'draft',
        description: record.description,
        documents: [] // Default to empty array
      } as Event
    }
    
    // Override with any direct fields from the record to ensure consistency
    return {
      ...eventData,
      id: record.eventId!,
      title: record.title || eventData.title,
      featured: (record as any).featured ?? eventData.featured,
      status: ((record as any).status as 'draft' | 'ready' | 'published' | 'archived') || eventData.status,
      createdAt: (record as any).createdAt ? new Date((record as any).createdAt) : eventData.createdAt,
      updatedAt: (record as any).updatedAt ? new Date((record as any).updatedAt) : eventData.updatedAt,
      publishDate: (record as any).publishDate ? new Date((record as any).publishDate) : eventData.publishDate,
    }
  } catch (error) {
    throw new Error(`Failed to convert schedule record to event: ${error}`)
  }
}

const eventToScheduleRecord = (event: Event, eventId: string): any => {
  const hostingEcclesiaName = extractHostingEcclesia(event)
  const eventDate = extractEventDate(event)  // Full date: "2025-10-12"
  const eventTime = extractEventTime(event)  // Time or null
  
  const record: any = {
    PK: `EVENT#${eventId}`,
    SK: 'DETAILS',
    
    // Single GSI for chronological queries
    GSI1PK: 'EVENTS',                       // Simple partition for all events
    GSI1SK: `${eventDate}#${eventId}`,     // Full date + ID: "2025-10-12#uuid123"
    
    // Core fields
    date: eventDate,                       // Required: "2025-10-12"
    time: eventTime || null,               // Optional: "10:00" or null
    title: event.title,                    // Required
    eventType: event.type,                 // Required: "study-weekend"
    ecclesia: hostingEcclesiaName,         // For filtering
    
    // Legacy fields for backward compatibility
    type: 'event' as const,
    
    // Event-specific fields
    eventId,
    description: event.description,
    details: serializeEventData(event) as any, // Store the full Event object as JSON
    
    // Enhanced fields
    status: event.status,
    featured: event.featured,
    createdBy: event.createdBy,
    createdAt: event.createdAt ? (typeof event.createdAt === 'string' ? event.createdAt : event.createdAt.toISOString()) : new Date().toISOString(),
    updatedAt: event.updatedAt ? (typeof event.updatedAt === 'string' ? event.updatedAt : event.updatedAt.toISOString()) : new Date().toISOString(),
    hostingEcclesia: hostingEcclesiaName,
    
    // Search content for future Elasticsearch integration
    searchableContent: generateSearchableContent(event),
  }
  
  // Only add publishDate if it exists to avoid null/undefined issues
  if (event.publishDate) {
    record.publishDate = typeof event.publishDate === 'string' ? event.publishDate : event.publishDate.toISOString()
  }
  
  return record
}

// Main event service functions

export const createEvent = async (eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> => {
  const eventId = uuidv4()
  const now = new Date()
  
  console.log('[createEvent] Creating event with ID:', eventId)
  console.log('[createEvent] Event data received:', eventData)
  
  // Convert date strings in eventData to Date objects
  const processedEventData = { ...eventData } as any
  
  // Convert common date fields
  if (processedEventData.publishDate) {
    processedEventData.publishDate = new Date(processedEventData.publishDate)
  }
  
  // Convert type-specific date fields based on event type
  switch (processedEventData.type) {
    case 'funeral':
      if (processedEventData.serviceDate) {
        processedEventData.serviceDate = new Date(processedEventData.serviceDate)
      }
      break
    case 'wedding':
      if (processedEventData.ceremonyDate) {
        processedEventData.ceremonyDate = new Date(processedEventData.ceremonyDate)
      }
      break
    case 'baptism':
      if (processedEventData.baptismDate) {
        processedEventData.baptismDate = new Date(processedEventData.baptismDate)
      }
      break
    case 'general':
      if (processedEventData.startDate) {
        processedEventData.startDate = new Date(processedEventData.startDate)
      }
      if (processedEventData.endDate) {
        processedEventData.endDate = new Date(processedEventData.endDate)
      }
      break
    case 'study-weekend':
      if (processedEventData.dateRange) {
        processedEventData.dateRange = {
          start: new Date(processedEventData.dateRange.start),
          end: new Date(processedEventData.dateRange.end)
        }
      }
      break
  }
  
  const event: Event = {
    ...processedEventData,
    id: eventId,
    createdAt: now,
    updatedAt: now,
    status: processedEventData.status || 'draft', // Default to draft for progressive creation
    published: processedEventData.published ?? false, // Default to unpublished
  } as Event

  // Convert Event to ScheduleRecord format with all the rich data
  const record = eventToScheduleRecord(event, eventId)
  
  console.log('[createEvent] DynamoDB record to save:', record)
  
  try {
    // Store as a complete ScheduleRecord
    const result = await scheduleRepo.put({
      ...record,
      lastUpdated: now.toISOString(),
      version: 1,
    })
    console.log('[createEvent] DynamoDB put result:', result)
  } catch (error) {
    console.error('[createEvent] Failed to save to DynamoDB:', error)
    throw error
  }

  console.log('[createEvent] Event created successfully:', event)
  return event
}

// Create or update event (for auto-save)
export const saveEventDraft = async (eventData: Partial<Event> & { id?: string }): Promise<Event> => {
  console.log('[saveEventDraft] Attempting to save draft:', eventData)
  
  // Validate that we can save as draft
  if (!EventValidator.canSaveAsDraft(eventData)) {
    console.error('[saveEventDraft] Insufficient data to save as draft')
    throw new Error('Insufficient data to save as draft')
  }

  if (eventData.id) {
    console.log('[saveEventDraft] Updating existing event with ID:', eventData.id)
    // Update existing event
    return updateEvent(eventData as UpdateEventRequest)
  } else {
    console.log('[saveEventDraft] Creating new draft event')
    // Create new draft event with minimal data
    const minimalEvent = {
      title: eventData.title || 'Untitled Event',
      type: eventData.type || 'general',
      createdBy: eventData.createdBy || 'system',
      status: 'draft',
      ...eventData,
    } as Omit<Event, 'id' | 'createdAt' | 'updatedAt'>
    
    console.log('[saveEventDraft] Minimal event data:', minimalEvent)
    
    // Validate the draft event
    const validation = EventValidator.validateEvent(minimalEvent, { mode: 'draft' })
    if (!validation.isValid) {
      console.warn('[saveEventDraft] Draft validation warnings:', validation.errors)
      // Allow saving even with warnings for drafts
    }
    
    return createEvent(minimalEvent)
  }
}

export const getEventById = async (eventId: string): Promise<Event | null> => {
  const scheduleRecord = await scheduleRepo.getEvent(eventId)
  if (!scheduleRecord) return null

  return scheduleRecordToEvent(scheduleRecord)
}

export const updateEvent = async (updateData: UpdateEventRequest): Promise<Event> => {
  const existingRecord = await scheduleRepo.getEvent(updateData.id)
  if (!existingRecord) {
    throw new Error(`Event with ID ${updateData.id} not found`)
  }

  const existingEvent = scheduleRecordToEvent(existingRecord)
  
  // Convert date strings in updateData to Date objects
  const processedUpdateData = { ...updateData } as any
  
  // Convert common date fields
  if (processedUpdateData.publishDate) {
    processedUpdateData.publishDate = new Date(processedUpdateData.publishDate)
  }
  
  // Convert type-specific date fields based on event type
  const eventType = processedUpdateData.type || existingEvent.type
  switch (eventType) {
    case 'funeral':
      if (processedUpdateData.serviceDate) {
        processedUpdateData.serviceDate = new Date(processedUpdateData.serviceDate)
      }
      break
    case 'wedding':
      if (processedUpdateData.ceremonyDate) {
        processedUpdateData.ceremonyDate = new Date(processedUpdateData.ceremonyDate)
      }
      break
    case 'baptism':
      if (processedUpdateData.baptismDate) {
        processedUpdateData.baptismDate = new Date(processedUpdateData.baptismDate)
      }
      break
    case 'general':
      if (processedUpdateData.startDate) {
        processedUpdateData.startDate = new Date(processedUpdateData.startDate)
      }
      if (processedUpdateData.endDate) {
        processedUpdateData.endDate = new Date(processedUpdateData.endDate)
      }
      break
    case 'study-weekend':
      if (processedUpdateData.dateRange) {
        processedUpdateData.dateRange = {
          start: new Date(processedUpdateData.dateRange.start),
          end: new Date(processedUpdateData.dateRange.end)
        }
      }
      break
  }
  
  const updatedEvent: Event = {
    ...existingEvent,
    ...processedUpdateData,
    updatedAt: new Date(),
  } as Event

  // Convert updated Event to ScheduleRecord format
  const updatedRecord = eventToScheduleRecord(updatedEvent, updateData.id)
  
  // Update the complete record with all the rich data
  // Note: lastUpdated and version are automatically managed by the repository
  await scheduleRepo.update(
    `EVENT#${updateData.id}`,
    'DETAILS',
    updatedRecord
  )

  return updatedEvent
}

export const deleteEvent = async (eventId: string): Promise<boolean> => {
  try {
    await scheduleRepo.deleteEvent(eventId)
    return true
  } catch (error) {
    console.error('Failed to delete event:', error)
    return false
  }
}

export const getFilteredEvents = async (filters: EventFilters): Promise<EventListResponse> => {
  const limit = filters.limit || 1000 // Much higher default limit, can be overridden
  let scheduleRecords: ScheduleRecord[] = []

  // Use existing optimized queries from scheduleRepo
  if (filters.dateFrom && filters.dateTo) {
    // Get events by date range - primary newsletter use case
    const result = await scheduleRepo.getAllSchedulesByDateRange({
      startDate: filters.dateFrom.toISOString().split('T')[0],
      endDate: filters.dateTo.toISOString().split('T')[0],
      limit
    })
    
    // Filter for events only (not schedules)
    scheduleRecords = result.items.filter(record => 
      record.PK?.startsWith('EVENT#')
    )
  } else if (filters.type) {
    // Get events by type
    const types = Array.isArray(filters.type) ? filters.type : [filters.type]
    
    for (const _eventType of types) {
      const result = await scheduleRepo.getSchedulesByTypeAndDateRange(
        'event', // All events are stored as type 'event' in the existing system
        {
          startDate: filters.dateFrom?.toISOString().split('T')[0] || '2020-01-01',
          endDate: filters.dateTo?.toISOString().split('T')[0] || '2030-12-31',
          limit: Math.ceil(limit / types.length)
        }
      )
      scheduleRecords.push(...result.items.filter(record => 
        record.PK?.startsWith('EVENT#')
      ))
    }
  } else {
    // Fallback: get all recent events
    const today = new Date().toISOString().split('T')[0]
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    const result = await scheduleRepo.getAllSchedulesByDateRange({
      startDate: today,
      endDate: futureDate,
      limit
    })
    
    scheduleRecords = result.items.filter(record => 
      record.PK?.startsWith('EVENT#')
    )
  }

  // Convert to Events
  let events = scheduleRecords.map(scheduleRecordToEvent)

  // Apply additional filters
  if (filters.published !== undefined) {
    // Convert old published filter to status-based filtering
    if (filters.published) {
      // Filter for published events (ready status + past publish date)
      const now = new Date()
      events = events.filter(event => 
        event.status === 'ready' && 
        event.publishDate && 
        new Date(event.publishDate) <= now
      )
    } else {
      // Filter for unpublished events (draft or future publish date)
      const now = new Date()
      events = events.filter(event => 
        event.status === 'draft' || 
        !event.publishDate || 
        new Date(event.publishDate) > now
      )
    }
  }

  if (filters.featured !== undefined) {
    events = events.filter(event => event.featured === filters.featured)
  }

  if (filters.createdBy) {
    events = events.filter(event => event.createdBy === filters.createdBy)
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase()
    events = events.filter(event => 
      event.title.toLowerCase().includes(searchTerm) ||
      event.description?.toLowerCase().includes(searchTerm)
    )
  }

  // Apply type filter if events came from date query
  if (filters.type && (filters.dateFrom || filters.dateTo)) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type]
    events = events.filter(event => types.includes(event.type))
  }

  const total = events.length
  const page = 1
  
  return {
    events: events.slice(0, limit),
    total,
    page,
    limit,
    hasMore: total > limit
  }
}

export const getEventsForNewsletter = async (
  startDate: string,
  endDate: string
): Promise<Record<string, Event[]>> => {
  // Use the existing newsletter optimization method
  const groupedSchedules = await scheduleRepo.getSchedulesForNewsletter(startDate, endDate)
  
  const groupedEvents: Record<string, Event[]> = {}
  
  // Extract events from the grouped schedules
  Object.entries(groupedSchedules).forEach(([date, records]) => {
    const eventRecords = records.filter(record => record.PK?.startsWith('EVENT#'))
    if (eventRecords.length > 0) {
      groupedEvents[date] = eventRecords.map(scheduleRecordToEvent)
    }
  })

  return groupedEvents
}

export const getUpcomingEvents = async (days: number = 30, limit: number = 10): Promise<Event[]> => {
  const startDate = new Date().toISOString().split('T')[0]
  const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const result = await getFilteredEvents({
    dateFrom: new Date(startDate),
    dateTo: new Date(endDate),
    published: true
  })

  return result.events.slice(0, limit)
}

export const getAllEvents = async (includeArchived: boolean = false): Promise<Event[]> => {
  // Get all events from the last 2 years to future
  const startDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]
  const endDate = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0]

  const result = await getFilteredEvents({
    dateFrom: new Date(startDate),
    dateTo: new Date(endDate),
    limit: 10000, // Very high limit to get all events
  })

  // Filter by status if needed
  let events = result.events
  if (!includeArchived) {
    events = events.filter(event => event.status !== 'archived')
  }

  // Sort by most recently updated first, then by event date
  return events.sort((a, b) => {
    // First sort by update time (most recent first)
    const updateCompare = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    if (updateCompare !== 0) return updateCompare
    
    // Then by event date
    const aDate = extractEventDate(a)
    const bDate = extractEventDate(b)
    return new Date(bDate).getTime() - new Date(aDate).getTime()
  })
}

// Validation functions for external use
export const validateEventForPublishing = async (eventId: string): Promise<{ canPublish: boolean; errors: string[]; warnings: string[] }> => {
  const event = await getEventById(eventId)
  if (!event) {
    return { canPublish: false, errors: ['Event not found'], warnings: [] }
  }

  const validation = EventValidator.canPublish(event)
  return {
    canPublish: validation.isValid,
    errors: validation.errors.map(e => e.message),
    warnings: validation.warnings?.map(w => w.message) || []
  }
}

export const getEventValidationStatus = (event: Partial<Event>) => {
  return EventValidator.getValidationStatus(event)
}

export const validateSaveTheDate = (event: Partial<Event>) => {
  return EventValidator.validateSaveTheDate(event)
}

/**
 * Get only published events for public consumption
 * Used by newsletter, events page, and other public-facing components
 */
export const getPublishedEvents = async (): Promise<Event[]> => {
  const allEvents = await getAllEvents(false)
  return allEvents.filter(event =>
    event.status === 'published' || event.status === 'ready'
  )
}