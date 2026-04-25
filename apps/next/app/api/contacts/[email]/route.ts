import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { SESv2Client, DeleteContactCommand } from '@aws-sdk/client-sesv2'

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

// SES client
const sesClient = new SESv2Client({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

const CONTACT_LIST_NAME = 'tee-admin-contacts'

/**
 * DELETE: Delete a contact by email address
 * Requires admin role
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    // Check authentication - admin/owner only
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await params
    const decodedEmail = decodeURIComponent(email).toLowerCase()

    console.log(`🗑️ Deleting contact: ${decodedEmail}`)

    // Find all directory records with this email
    const queryCommand = new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'contains(email, :email)',
      ExpressionAttributeValues: {
        ':pk': 'DIRECTORY#MEMBERS',
        ':email': decodedEmail,
      },
    })

    const queryResult = await docClient.send(queryCommand)
    const recordsToDelete = queryResult.Items || []

    // Delete matching records
    let deletedCount = 0
    for (const record of recordsToDelete) {
      await docClient.send(
        new DeleteCommand({
          TableName: 'tee-schedules',
          Key: { PK: record.PK, SK: record.SK },
        })
      )
      deletedCount++
      console.log(`  ✅ Deleted directory record: ${record.SK}`)
    }

    // Unsubscribe from SES
    let sesDeleted = false
    try {
      await sesClient.send(
        new DeleteContactCommand({
          ContactListName: CONTACT_LIST_NAME,
          EmailAddress: decodedEmail,
        })
      )
      sesDeleted = true
      console.log(`  ✅ Unsubscribed from SES: ${decodedEmail}`)
    } catch (sesError: any) {
      // Contact might not exist in SES - that's okay
      if (sesError.name !== 'NotFoundException') {
        console.warn(`  ⚠️ Failed to unsubscribe ${decodedEmail} from SES:`, sesError.message)
      }
    }

    console.log(`✅ Deleted ${deletedCount} directory records, SES unsubscribed: ${sesDeleted}`)

    return NextResponse.json({
      success: true,
      deletedRecords: deletedCount,
      unsubscribedFromSES: sesDeleted,
    })
  } catch (error) {
    console.error('❌ Error deleting contact:', error)
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}
