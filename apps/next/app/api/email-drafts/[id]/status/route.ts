import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { conditionFailure, EXISTS_AND_NOT_SENT } from '@/utils/email-draft-item'

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
//
// A SENT email is a permanent record: it can't be marked sent again (that
// would overwrite its sentAt) or marked tested (that would unlock it). Both
// are refused with 409. A missing draft is a 404 — this never creates an item.
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
      '#status': 'status',
    }
    const attributeValues: Record<string, any> = {
      ':updatedAt': now,
      ':sent': 'sent',
    }

    if (action === 'tested') {
      updateExpression += ', #status = :status, #lastTestedAt = :lastTestedAt'
      attributeNames['#lastTestedAt'] = 'lastTestedAt'
      attributeValues[':status'] = 'tested'
      attributeValues[':lastTestedAt'] = now
    } else if (action === 'sent') {
      updateExpression += ', #status = :status, #sentAt = :sentAt'
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
      ConditionExpression: EXISTS_AND_NOT_SENT,
      ExpressionAttributeNames: attributeNames,
      ExpressionAttributeValues: attributeValues,
      ReturnValues: 'ALL_NEW',
      ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    })

    let response
    try {
      response = await docClient.send(command)
    } catch (error) {
      const failure = conditionFailure(error)
      if (failure === 'sent') {
        return NextResponse.json(
          { error: 'This email was already sent; copy it to send it again.' },
          { status: 409 }
        )
      }
      if (failure === 'missing') {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
      }
      throw error
    }

    if (!response.Attributes) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, draft: response.Attributes })
  } catch (error) {
    console.error('Error updating draft status:', error)
    return NextResponse.json({ error: 'Failed to update draft status' }, { status: 500 })
  }
}
