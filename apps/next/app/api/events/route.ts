import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { EventService } from '@/utils/events'
import { EventFilters, CreateEventRequest } from '@my/app/types/events'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../../../utils/email/sesClient'

// Initialize DynamoDB client
const dbClientConfig = getAwsDbConfig()
const dynamoDbClient = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

const eventService = new EventService(dynamoDbClient)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Check authentication first
    const session = await auth()
    const isAdminOrOwner = session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER
    
    // Parse query parameters
    const filters: EventFilters = {
      type: searchParams.get('type') as any,
      status: searchParams.get('status') as any || (isAdminOrOwner ? 'all' : 'published'), // Admin sees all events by default
      published: searchParams.get('published') ? searchParams.get('published') === 'true' : undefined,
      featured: searchParams.get('featured') ? searchParams.get('featured') === 'true' : undefined,
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined,
      search: searchParams.get('search') || undefined,
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // For public access, only show published events
    if (!isAdminOrOwner) {
      filters.published = true
      filters.status = 'published'
    }

    const result = await eventService.listEvents(filters, page, limit)

    return NextResponse.json(result)
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
    // Check authentication and permissions
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (userRole !== ROLES.OWNER && userRole !== ROLES.ADMIN) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const createRequest: CreateEventRequest = {
      title: body.title,
      type: body.type,
      publishDate: body.publishDate ? new Date(body.publishDate) : undefined,
      description: body.description,
    }

    // Validate required fields
    if (!createRequest.title || !createRequest.type) {
      return NextResponse.json(
        { error: 'Title and type are required' },
        { status: 400 }
      )
    }

    const event = await eventService.createEventWithSlug(createRequest, session.user.email!)

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Error creating event:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}