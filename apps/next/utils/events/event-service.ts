import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { Event, EventFilters, EventListResponse, CreateEventRequest, UpdateEventRequest, EventStatus, EventSlugHelper, EventMetadata } from '@my/app/types/events'
import { nanoid } from 'nanoid'

// DynamoDB table configuration for events
// Use the same table as auth system but with EVENT# partition keys
const EVENTS_TABLE = process.env.DYNAMODB_TABLE_NAME || 'tee-admin'
const EVENTS_GSI = 'gsi1' // Use the same GSI as auth system (lowercase)

export class EventService {
  constructor(private dynamoDb: DynamoDBDocument) {}

  /**
   * Create a new event
   */
  async createEvent(request: CreateEventRequest, createdBy: string): Promise<Event> {
    const now = new Date()
    const id = nanoid()

    const baseEvent: Event = {
      id,
      title: request.title,
      type: request.type,
      createdBy,
      createdAt: now,
      updatedAt: now,
      publishDate: request.publishDate,
      published: false,
      status: 'draft' as EventStatus,
      description: request.description,
      // Type-specific required fields with minimal defaults
      ...(request.type === 'study-weekend' && {
        dateRange: { start: now, end: now },
        location: { name: '', address: '', city: '', province: '' },
        theme: '',
        speakers: [],
        schedule: [],
        documents: []
      }),
      ...(request.type === 'funeral' && {
        serviceDate: now,
        deceased: { firstName: '', lastName: '' },
        locations: {
          service: { name: '', address: '', city: '', province: '' }
        },
        documents: []
      }),
      ...(request.type === 'wedding' && {
        ceremonyDate: now,
        ceremonyLocation: { name: '', address: '', city: '', province: '' },
        couple: {
          bride: { firstName: '', lastName: '' },
          groom: { firstName: '', lastName: '' }
        },
        documents: []
      }),
      ...(request.type === 'general' && {
        documents: []
      })
    } as Event

    await this.dynamoDb.put({
      TableName: EVENTS_TABLE,
      Item: {
        pkey: `EVENT#${id}`,
        skey: 'METADATA',
        gsi1pk: `STATUS#${baseEvent.status}`,
        gsi1sk: baseEvent.publishDate ? baseEvent.publishDate.toISOString() : '9999-12-31T23:59:59.999Z',
        ...baseEvent,
        createdAt: baseEvent.createdAt.toISOString(),
        updatedAt: baseEvent.updatedAt.toISOString(),
        publishDate: baseEvent.publishDate?.toISOString(),
        // Serialize nested date objects
        ...(baseEvent.type === 'study-weekend' && {
          dateRange: {
            start: (baseEvent as any).dateRange.start.toISOString(),
            end: (baseEvent as any).dateRange.end.toISOString()
          }
        }),
        ...(baseEvent.type === 'funeral' && {
          serviceDate: (baseEvent as any).serviceDate.toISOString(),
          viewingDate: (baseEvent as any).viewingDate?.toISOString()
        }),
        ...(baseEvent.type === 'wedding' && {
          ceremonyDate: (baseEvent as any).ceremonyDate.toISOString()
        }),
        ...(baseEvent.type === 'general' && {
          startDate: (baseEvent as any).startDate?.toISOString(),
          endDate: (baseEvent as any).endDate?.toISOString()
        })
      }
    })

    return baseEvent
  }

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<Event | null> {
    const result = await this.dynamoDb.get({
      TableName: EVENTS_TABLE,
      Key: {
        pkey: `EVENT#${id}`,
        skey: 'METADATA'
      }
    })

    if (!result.Item) {
      return null
    }

    return this.deserializeEvent(result.Item)
  }

  /**
   * Update an existing event
   */
  async updateEvent(request: UpdateEventRequest): Promise<Event> {
    const existing = await this.getEventById(request.id)
    if (!existing) {
      throw new Error(`Event with ID ${request.id} not found`)
    }

    const updated: Event = {
      ...existing,
      ...request,
      updatedAt: new Date()
    }

    await this.dynamoDb.put({
      TableName: EVENTS_TABLE,
      Item: {
        pkey: `EVENT#${request.id}`,
        skey: 'METADATA',
        gsi1pk: `STATUS#${updated.status}`,
        gsi1sk: updated.publishDate ? updated.publishDate.toISOString() : '9999-12-31T23:59:59.999Z',
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        publishDate: updated.publishDate?.toISOString(),
        // Serialize nested date objects based on type
        ...(updated.type === 'study-weekend' && {
          dateRange: {
            start: (updated as any).dateRange.start.toISOString(),
            end: (updated as any).dateRange.end.toISOString()
          }
        }),
        ...(updated.type === 'funeral' && {
          serviceDate: (updated as any).serviceDate.toISOString(),
          viewingDate: (updated as any).viewingDate?.toISOString()
        }),
        ...(updated.type === 'wedding' && {
          ceremonyDate: (updated as any).ceremonyDate.toISOString()
        }),
        ...(updated.type === 'general' && {
          startDate: (updated as any).startDate?.toISOString(),
          endDate: (updated as any).endDate?.toISOString()
        })
      }
    })

    return updated
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string): Promise<void> {
    await this.dynamoDb.delete({
      TableName: EVENTS_TABLE,
      Key: {
        pkey: `EVENT#${id}`,
        skey: 'METADATA'
      }
    })
  }

  /**
   * Helper method to query events by a specific status
   */
  private async queryEventsByStatus(status: string, filters: EventFilters, limit: number): Promise<Event[]> {
    const queryParams: any = {
      TableName: EVENTS_TABLE,
      IndexName: EVENTS_GSI,
      KeyConditionExpression: 'gsi1pk = :status',
      ExpressionAttributeValues: {
        ':status': `STATUS#${status}`
      },
      ScanIndexForward: false,
      Limit: limit * 3 // Get more since we're combining multiple queries
    }

    try {
      const result = await this.dynamoDb.query(queryParams)
      return (result.Items || []).map(item => this.deserializeEvent(item))
    } catch (error) {
      console.warn(`Failed to query events with status ${status}:`, error)
      return []
    }
  }

  /**
   * List events with filtering and pagination
   */
  async listEvents(filters: EventFilters = {}, page = 1, limit = 20): Promise<EventListResponse> {
    const { status = 'published', published, type, dateFrom, dateTo, search } = filters

    // If status is 'all', we need to query multiple statuses
    if (status === 'all') {
      const statuses = ['draft', 'published', 'archived']
      const allResults = await Promise.all(
        statuses.map(s => this.queryEventsByStatus(s, filters, limit))
      )
      
      // Combine and sort all results
      const combinedEvents = allResults.flat()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      
      // Apply search filtering
      let filteredEvents = combinedEvents
      if (search) {
        const searchLower = search.toLowerCase()
        filteredEvents = combinedEvents.filter(event =>
          event.title.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower)
        )
      }
      
      // Apply pagination
      const startIndex = (page - 1) * limit
      return {
        events: filteredEvents.slice(startIndex, startIndex + limit),
        total: filteredEvents.length,
        page,
        limit,
        hasMore: startIndex + limit < filteredEvents.length
      }
    }

    // Build query parameters for single status
    let queryParams: any = {
      TableName: EVENTS_TABLE,
      IndexName: EVENTS_GSI,
      KeyConditionExpression: 'gsi1pk = :status',
      ExpressionAttributeValues: {
        ':status': `STATUS#${status}`
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit * 2 // Get extra to handle filtering
    }

    // Add date range filtering
    if (dateFrom || dateTo) {
      const dateConditions = []
      if (dateFrom) {
        queryParams.ExpressionAttributeValues[':dateFrom'] = dateFrom.toISOString()
        dateConditions.push('gsi1sk >= :dateFrom')
      }
      if (dateTo) {
        queryParams.ExpressionAttributeValues[':dateTo'] = dateTo.toISOString()
        dateConditions.push('gsi1sk <= :dateTo')
      }
      if (dateConditions.length > 0) {
        queryParams.KeyConditionExpression += ` AND ${dateConditions.join(' AND ')}`
      }
    }

    // Add filter expressions for other criteria
    const filterExpressions = []
    if (published !== undefined) {
      queryParams.ExpressionAttributeValues[':published'] = published
      filterExpressions.push('published = :published')
    }
    if (type) {
      const types = Array.isArray(type) ? type : [type]
      queryParams.ExpressionAttributeValues[':types'] = types
      filterExpressions.push('contains(:types, #type)')
      queryParams.ExpressionAttributeNames = { '#type': 'type' }
    }

    if (filterExpressions.length > 0) {
      queryParams.FilterExpression = filterExpressions.join(' AND ')
    }

    const result = await this.dynamoDb.query(queryParams)
    const events = (result.Items || []).map(item => this.deserializeEvent(item))

    // Apply search filtering (post-query due to DynamoDB limitations)
    let filteredEvents = events
    if (search) {
      const searchLower = search.toLowerCase()
      filteredEvents = events.filter(event => 
        event.title.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower)
      )
    }

    // Apply pagination
    const startIndex = (page - 1) * limit
    const paginatedEvents = filteredEvents.slice(startIndex, startIndex + limit)

    return {
      events: paginatedEvents,
      total: filteredEvents.length,
      page,
      limit,
      hasMore: startIndex + limit < filteredEvents.length
    }
  }

  /**
   * Publish an event
   */
  async publishEvent(id: string): Promise<Event> {
    const event = await this.getEventById(id)
    if (!event) {
      throw new Error(`Event with ID ${id} not found`)
    }

    return await this.updateEvent({
      id,
      published: true,
      status: 'published',
      publishDate: event.publishDate || new Date()
    })
  }

  /**
   * Archive an event
   */
  async archiveEvent(id: string): Promise<Event> {
    return await this.updateEvent({
      id,
      status: 'archived'
    })
  }

  /**
   * Get event by slug - supports both custom slugs and UUID fallback
   */
  async getEventBySlug(slug: string, requireAuth: boolean = false): Promise<Event | null> {
    // First try to find by custom slug
    const slugResult = await this.dynamoDb.query({
      TableName: EVENTS_TABLE,
      FilterExpression: '#metadata.#slug = :slug',
      ExpressionAttributeNames: {
        '#metadata': 'metadata',
        '#slug': 'slug'
      },
      ExpressionAttributeValues: {
        ':slug': slug
      }
    })

    if (slugResult.Items && slugResult.Items.length > 0) {
      const event = this.deserializeEvent(slugResult.Items[0])
      
      // Check privacy requirements
      if (event.metadata?.isPrivate && !requireAuth) {
        return null  // Require authentication for private events
      }
      
      return event
    }

    // Fallback: try to get by ID (for UUID slugs of private events)
    return await this.getEventById(slug)
  }

  /**
   * Generate and validate slug for an event
   */
  async generateSlug(title: string, eventDate?: Date, eventType?: string): Promise<string> {
    // For private events, return UUID
    if (eventType && EventSlugHelper.shouldUsePrivateSlug(eventType as any)) {
      return nanoid()
    }

    let baseSlug = EventSlugHelper.generateSlug(title, eventDate)
    let slug = baseSlug
    let counter = 1

    // Check for conflicts and append counter if needed
    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    return slug
  }

  /**
   * Check if slug already exists
   */
  async slugExists(slug: string): Promise<boolean> {
    const result = await this.dynamoDb.query({
      TableName: EVENTS_TABLE,
      FilterExpression: '#metadata.#slug = :slug',
      ExpressionAttributeNames: {
        '#metadata': 'metadata',
        '#slug': 'slug'
      },
      ExpressionAttributeValues: {
        ':slug': slug
      },
      Limit: 1
    })

    return (result.Items?.length || 0) > 0
  }

  /**
   * Validate slug and return validation result
   */
  async validateSlug(slug: string, excludeEventId?: string): Promise<{ isValid: boolean; error?: string }> {
    // Basic format validation
    const formatValidation = EventSlugHelper.validateSlug(slug)
    if (!formatValidation.isValid) {
      return formatValidation
    }

    // Check for conflicts (excluding current event if updating)
    const existingEvent = await this.getEventBySlug(slug, true)
    if (existingEvent && existingEvent.id !== excludeEventId) {
      return {
        isValid: false,
        error: `Slug "${slug}" is already in use. Please choose a different slug.`
      }
    }

    return { isValid: true }
  }

  /**
   * Update event with slug handling
   */
  async updateEventWithSlug(request: UpdateEventRequest & { metadata?: Partial<EventMetadata> }): Promise<Event> {
    const existing = await this.getEventById(request.id)
    if (!existing) {
      throw new Error(`Event with ID ${request.id} not found`)
    }

    // Handle slug updates
    let metadata = { ...existing.metadata, ...request.metadata }
    
    if (request.metadata?.slug && !existing.metadata?.slugLocked) {
      // Validate new slug
      const validation = await this.validateSlug(request.metadata.slug, request.id)
      if (!validation.isValid) {
        throw new Error(validation.error)
      }
      metadata.slug = request.metadata.slug
    }

    // Auto-generate slug if none exists and this is being published
    if (!metadata.slug && request.status === 'published') {
      const eventDate = this.getEventDate(existing)
      metadata.slug = await this.generateSlug(existing.title, eventDate, existing.type)
    }

    // Lock slug on first save after creation
    if (metadata.slug && !metadata.slugLocked) {
      metadata.slugLocked = true
    }

    // Auto-set privacy for personal events
    if (EventSlugHelper.shouldUsePrivateSlug(existing.type)) {
      metadata.isPrivate = true
      metadata.requiresAuth = true
    }

    return await this.updateEvent({
      ...request,
      metadata
    })
  }

  /**
   * Create event with automatic slug generation
   */
  async createEventWithSlug(request: CreateEventRequest, createdBy: string): Promise<Event> {
    // Create base event first
    const event = await this.createEvent(request, createdBy)
    
    // Generate metadata with slug
    const eventDate = this.getEventDate(event)
    const slug = await this.generateSlug(event.title, eventDate, event.type)
    
    const metadata: EventMetadata = {
      slug,
      slugLocked: false,
      isPrivate: EventSlugHelper.shouldUsePrivateSlug(event.type),
      requiresAuth: EventSlugHelper.shouldUsePrivateSlug(event.type)
    }

    // Update event with metadata
    return await this.updateEvent({
      id: event.id,
      metadata
    })
  }

  /**
   * Get primary event date for slug generation
   */
  private getEventDate(event: Event): Date | undefined {
    switch (event.type) {
      case 'study-weekend':
        return (event as any).dateRange?.start
      case 'funeral':
        return (event as any).serviceDate
      case 'wedding':
        return (event as any).ceremonyDate
      case 'baptism':
        return (event as any).baptismDate
      case 'general':
        return (event as any).startDate
      default:
        return undefined
    }
  }

  /**
   * Get events by date range for newsletter generation
   */
  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    try {
      const result = await this.listEvents({
        status: 'published',
        dateFrom: startDate,
        dateTo: endDate
      }, 1, 100)
      
      return result.events
    } catch (error) {
      console.error('Error fetching events by date range:', error)
      return []
    }
  }

  /**
   * Get events suitable for newsletter inclusion
   */
  async getNewsletterEvents(limit: number = 50): Promise<Event[]> {
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixMonthsFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000)

    const result = await this.listEvents({
      status: 'published',
      dateFrom: oneMonthAgo,
      dateTo: sixMonthsFromNow
    }, 1, limit)

    // Filter out private events and sort by newsletter priority
    return result.events
      .filter(event => !event.metadata?.isPrivate)
      .sort((a, b) => {
        const priorityA = a.newsletter?.newsletterPriority || 5
        const priorityB = b.newsletter?.newsletterPriority || 5
        return priorityB - priorityA  // Higher priority first
      })
  }

  /**
   * Deserialize DynamoDB item to Event object
   */
  private deserializeEvent(item: any): Event {
    const event = {
      ...item,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      publishDate: item.publishDate ? new Date(item.publishDate) : undefined
    }

    // Deserialize type-specific date fields
    if (event.type === 'study-weekend' && event.dateRange) {
      event.dateRange = {
        start: new Date(event.dateRange.start),
        end: new Date(event.dateRange.end)
      }
    }
    if (event.type === 'funeral') {
      if (event.serviceDate) event.serviceDate = new Date(event.serviceDate)
      if (event.viewingDate) event.viewingDate = new Date(event.viewingDate)
    }
    if (event.type === 'wedding' && event.ceremonyDate) {
      event.ceremonyDate = new Date(event.ceremonyDate)
    }
    if (event.type === 'general') {
      if (event.startDate) event.startDate = new Date(event.startDate)
      if (event.endDate) event.endDate = new Date(event.endDate)
    }

    // Remove DynamoDB-specific fields
    delete event.pkey
    delete event.skey
    delete event.gsi1pk
    delete event.gsi1sk

    return event as Event
  }
}