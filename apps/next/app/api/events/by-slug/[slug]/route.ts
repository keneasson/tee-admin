/**
 * API endpoint for fetching events by slug
 * Supports both public and private event access
 */

import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { EventService } from '@/utils/events'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    
    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      )
    }

    // Initialize EventService
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    })
    const dynamoDb = DynamoDBDocument.from(client)
    const eventService = new EventService(dynamoDb)

    // Get user session for authentication check
    const session = await getServerSession(authOptions)
    const isAuthenticated = !!session

    // Try to fetch the event
    const event = await eventService.getEventBySlug(slug, isAuthenticated)
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check if event is private and user is not authenticated
    if (event.metadata?.isPrivate && !isAuthenticated) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if event is draft and user doesn't have permission
    if (event.status === 'draft') {
      if (!isAuthenticated) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // TODO: Check if user has admin/owner role
      // For now, allow any authenticated user to see drafts
      // This should be replaced with proper role checking
      const userRole = session?.user?.role || 'guest'
      if (!['admin', 'owner'].includes(userRole)) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }  
        )
      }
    }

    // Return the event data
    return NextResponse.json(event)

  } catch (error) {
    console.error('[API] Error fetching event by slug:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Support HEAD requests for checking event existence
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params
    
    if (!slug) {
      return new NextResponse(null, { status: 400 })
    }

    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    })
    const dynamoDb = DynamoDBDocument.from(client)
    const eventService = new EventService(dynamoDb)

    const session = await getServerSession(authOptions)
    const event = await eventService.getEventBySlug(slug, !!session)
    
    if (!event) {
      return new NextResponse(null, { status: 404 })
    }

    if (event.metadata?.isPrivate && !session) {
      return new NextResponse(null, { status: 401 })
    }

    if (event.status === 'draft' && (!session || !['admin', 'owner'].includes(session?.user?.role || 'guest'))) {
      return new NextResponse(null, { status: 403 })
    }

    return new NextResponse(null, { status: 200 })

  } catch (error) {
    console.error('[API] Error checking event by slug:', error)
    return new NextResponse(null, { status: 500 })
  }
}