import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { EventService } from '@/utils/events'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../../../../../utils/email/sesClient'

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

export async function POST(
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

    const event = await eventService.publishEvent(params.id)

    return NextResponse.json(event)
  } catch (error) {
    console.error('Error publishing event:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish event' },
      { status: 500 }
    )
  }
}