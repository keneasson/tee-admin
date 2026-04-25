import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
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
 * DELETE: Delete a contact from directory and optionally from SES
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pkey, skey, unsubscribeFromSES = false, emails = [] } = body

    if (!pkey || !skey) {
      return NextResponse.json({ error: 'Missing required fields: pkey, skey' }, { status: 400 })
    }

    console.log(`🗑️ Deleting contact: ${skey} from directory`)

    // If this is a base skey (without #EMAIL suffix), we need to delete all related email records too
    const baseSkey = skey.split('#EMAIL')[0]

    // Query for all records with this base skey
    const queryCommand = new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': pkey,
        ':skPrefix': baseSkey,
      },
    })

    const queryResult = await docClient.send(queryCommand)
    const recordsToDelete = queryResult.Items || []

    // Delete all records for this person
    let deletedCount = 0
    for (const record of recordsToDelete) {
      const deleteCommand = new DeleteCommand({
        TableName: 'tee-schedules',
        Key: { PK: record.PK, SK: record.SK },
      })
      await docClient.send(deleteCommand)
      deletedCount++
      console.log(`  ✅ Deleted record: ${record.SK}`)
    }

    // Optionally unsubscribe from SES
    let sesDeleted = 0
    if (unsubscribeFromSES && emails.length > 0) {
      for (const email of emails) {
        try {
          const deleteContactCommand = new DeleteContactCommand({
            ContactListName: CONTACT_LIST_NAME,
            EmailAddress: email,
          })
          await sesClient.send(deleteContactCommand)
          sesDeleted++
          console.log(`  ✅ Unsubscribed from SES: ${email}`)
        } catch (sesError: any) {
          // Contact might not exist in SES - that's okay
          if (sesError.name !== 'NotFoundException') {
            console.error(`  ⚠️ Failed to unsubscribe ${email} from SES:`, sesError.message)
          }
        }
      }
    }

    console.log(`✅ Deleted ${deletedCount} directory records, ${sesDeleted} SES contacts`)

    return NextResponse.json({
      success: true,
      deletedRecords: deletedCount,
      deletedFromSES: sesDeleted,
    })
  } catch (error) {
    console.error('❌ Error deleting contact:', error)
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}
