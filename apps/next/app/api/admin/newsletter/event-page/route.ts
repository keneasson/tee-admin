import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { EventService } from '@/utils/events'
import { v4 as uuidv4 } from 'uuid'

const dynamoDb = DynamoDBDocument.from(new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
}))

const eventService = new EventService(dynamoDb)

// POST /api/admin/newsletter/event-page - Create event page from newsletter curation
export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      slug, 
      description, 
      eventId, 
      newsletterId,
      eventType = 'general',
      metadata = {}
    } = await request.json()

    if (!title || !slug) {
      return NextResponse.json(
        { success: false, error: 'Title and slug are required' },
        { status: 400 }
      )
    }

    // Validate slug format
    const slugPattern = /^[a-z0-9-]+$/
    if (!slugPattern.test(slug)) {
      return NextResponse.json(
        { success: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existingEvent = await eventService.getEventBySlug(slug)
    if (existingEvent) {
      return NextResponse.json(
        { success: false, error: 'An event with this slug already exists' },
        { status: 409 }
      )
    }

    // Create event page
    const eventPageId = uuidv4()
    const now = new Date()

    const eventPage = {
      id: eventPageId,
      slug,
      title,
      subtitle: metadata.subtitle || '',
      type: eventType,
      status: 'draft',
      
      // Content
      description: description || '',
      shortDescription: metadata.shortDescription || description?.substring(0, 160) || '',
      
      // Newsletter integration
      newsletter: {
        emailSummary: metadata.emailSummary || `Join us for ${title}`,
        webSummary: metadata.webSummary || description?.substring(0, 200) || '',
        priority: metadata.priority || 'medium',
        includeInNewsletter: true,
        featuredUntilDate: metadata.featuredUntilDate
      },
      
      // SEO metadata
      metadata: {
        metaDescription: metadata.metaDescription || description?.substring(0, 160) || `Join us for ${title}`,
        metaKeywords: metadata.metaKeywords || [],
        socialImage: metadata.socialImage,
        canonicalUrl: `/event/${slug}`,
        noIndex: false
      },
      
      // Event details (can be filled in later)
      startDate: metadata.startDate ? new Date(metadata.startDate) : null,
      endDate: metadata.endDate ? new Date(metadata.endDate) : null,
      location: metadata.location || {},
      
      // Registration
      registrationEnabled: false,
      registrationUrl: metadata.registrationUrl || '',
      contactEmail: metadata.contactEmail || '',
      
      // Timestamps
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      
      // Analytics
      pageViews: 0,
      emailClicks: 0,
      registrations: 0
    }

    // Save event page
    await eventService.createEvent(eventPage)

    // Update newsletter draft to link to this event page
    if (newsletterId && eventId) {
      await updateNewsletterEventPage(newsletterId, eventId, slug)
    }

    return NextResponse.json({
      success: true,
      eventPage: {
        id: eventPageId,
        slug,
        title,
        description,
        status: 'draft',
        url: `/event/${slug}`,
        createdAt: now
      }
    })

  } catch (error) {
    console.error('Error creating event page:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create event page' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/newsletter/event-page - Update event page
export async function PUT(request: NextRequest) {
  try {
    const { 
      id,
      title,
      description,
      status,
      metadata = {},
      newsletter = {}
    } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Event page ID is required' },
        { status: 400 }
      )
    }

    // Get existing event page
    const existingEvent = await eventService.getEventById(id)
    if (!existingEvent) {
      return NextResponse.json(
        { success: false, error: 'Event page not found' },
        { status: 404 }
      )
    }

    // Update event page
    const updatedEvent = {
      ...existingEvent,
      title: title || existingEvent.title,
      description: description || existingEvent.description,
      status: status || existingEvent.status,
      metadata: {
        ...existingEvent.metadata,
        ...metadata
      },
      newsletter: {
        ...existingEvent.newsletter,
        ...newsletter
      },
      updatedAt: new Date(),
      publishedAt: status === 'published' && !existingEvent.publishedAt 
        ? new Date() 
        : existingEvent.publishedAt
    }

    await eventService.updateEvent(id, updatedEvent)

    return NextResponse.json({
      success: true,
      eventPage: {
        id: updatedEvent.id,
        slug: updatedEvent.slug,
        title: updatedEvent.title,
        description: updatedEvent.description,
        status: updatedEvent.status,
        url: `/event/${updatedEvent.slug}`,
        updatedAt: updatedEvent.updatedAt
      }
    })

  } catch (error) {
    console.error('Error updating event page:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update event page' },
      { status: 500 }
    )
  }
}

// GET /api/admin/newsletter/event-page - Get event pages for newsletter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build filter conditions
    const filters: any = {}
    if (type) filters.type = type
    if (status) filters.status = status

    // Get event pages
    const events = await eventService.getEvents(filters, limit)

    const eventPages = events.map(event => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      type: event.type,
      status: event.status,
      description: event.description,
      newsletter: event.newsletter,
      metadata: event.metadata,
      url: `/event/${event.slug}`,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      publishedAt: event.publishedAt
    }))

    return NextResponse.json({
      success: true,
      eventPages
    })

  } catch (error) {
    console.error('Error fetching event pages:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch event pages' },
      { status: 500 }
    )
  }
}

// Helper function to update newsletter draft with event page slug
async function updateNewsletterEventPage(newsletterId: string, eventId: string, slug: string) {
  try {
    // Get newsletter draft
    const { Item: draft } = await dynamoDb.get({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        pk: 'NEWSLETTER_DRAFT',
        sk: `ID#${newsletterId}`
      }
    })

    if (!draft) return

    // Update the specific event with the event page slug
    const updatedEvents = draft.events.map((event: any) => 
      event.id === eventId 
        ? { ...event, eventPageSlug: slug, requiresEventPage: true }
        : event
    )

    // Save updated newsletter
    await dynamoDb.update({
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        pk: 'NEWSLETTER_DRAFT',
        sk: `ID#${newsletterId}`
      },
      UpdateExpression: 'SET events = :events, contentVersion = contentVersion + :inc, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':events': updatedEvents,
        ':inc': 1,
        ':updatedAt': new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error updating newsletter with event page:', error)
  }
}