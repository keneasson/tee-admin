import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const docClient = DynamoDBDocumentClient.from(client)
const TABLE_NAME = 'tee-admin'

// PATCH - Update draft status (after testing or sending)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email
    const { id: draftId } = await params
    const body = await request.json()
    const { action } = body // 'tested' or 'sent'

    const now = new Date().toISOString()
    let updateExpression = 'SET #updatedAt = :updatedAt'
    const attributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    }
    const attributeValues: Record<string, any> = {
      ':updatedAt': now,
    }

    if (action === 'tested') {
      updateExpression += ', #status = :status, #lastTestedAt = :lastTestedAt'
      attributeNames['#status'] = 'status'
      attributeNames['#lastTestedAt'] = 'lastTestedAt'
      attributeValues[':status'] = 'tested'
      attributeValues[':lastTestedAt'] = now
    } else if (action === 'sent') {
      updateExpression += ', #status = :status, #sentAt = :sentAt'
      attributeNames['#status'] = 'status'
      attributeNames['#sentAt'] = 'sentAt'
      attributeValues[':status'] = 'sent'
      attributeValues[':sentAt'] = now
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "tested" or "sent"' },
        { status: 400 }
      )
    }

    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pkey: `USER#${userEmail}`,
        skey: `EMAIL_DRAFT#${draftId}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: 'ALL_NEW',
    })

    const response = await docClient.send(command)

    if (!response.Attributes) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, draft: response.Attributes })
  } catch (error) {
    console.error('Error updating draft status:', error)
    return NextResponse.json({ error: 'Failed to update draft status' }, { status: 500 })
  }
}
