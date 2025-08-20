import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { EventService } from '@/utils/events'
import { UpdateEventRequest } from '@my/app/types/events'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = await eventService.getEventById(params.id)
    
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check permissions for unpublished events
    if (!event.published || event.status !== 'published') {
      const session = await auth()
      const isAdminOrOwner = session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER
      
      if (!isAdminOrOwner) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const updateRequest: UpdateEventRequest = {
      id: params.id,
      ...body,
      // Convert date strings to Date objects
      publishDate: body.publishDate ? new Date(body.publishDate) : undefined,
      updatedAt: new Date(),
    }

    // Convert type-specific date fields
    if (body.type === 'study-weekend' && body.dateRange) {
      updateRequest.dateRange = {
        start: new Date(body.dateRange.start),
        end: new Date(body.dateRange.end)
      }
    }
    if (body.type === 'funeral') {
      if (body.serviceDate) updateRequest.serviceDate = new Date(body.serviceDate)
      if (body.viewingDate) updateRequest.viewingDate = new Date(body.viewingDate)
    }
    if (body.type === 'wedding' && body.ceremonyDate) {
      updateRequest.ceremonyDate = new Date(body.ceremonyDate)
    }
    if (body.type === 'general') {
      if (body.startDate) updateRequest.startDate = new Date(body.startDate)
      if (body.endDate) updateRequest.endDate = new Date(body.endDate)
    }

    const event = await eventService.updateEventWithSlug(updateRequest)

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error updating event:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    await eventService.deleteEvent(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting event:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}