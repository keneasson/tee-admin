import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import {
  GetContactCommand,
  UpdateContactCommand,
  CreateContactCommand,
  SubscriptionStatus,
} from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../../utils/email/sesClient'
import { inputTemplate } from '../../../../../utils/email/contact-lists'

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

/**
 * POST: Add a second email address to a directory member
 * Appends the new email to the existing email field, separated by semicolon
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { pkey, skey, currentEmail, newEmail } = body

    if (!pkey || !skey || !newEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: pkey, skey, newEmail' },
        { status: 400 }
      )
    }

    console.log(`📧 Adding second email to ${skey}: ${newEmail}`)

    // Get current record
    const getCommand = new GetCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: skey },
    })

    const currentRecord = await docClient.send(getCommand)

    if (!currentRecord.Item) {
      return NextResponse.json({ error: 'Directory member not found' }, { status: 404 })
    }

    // Build combined email string
    const existingEmails = currentRecord.Item.email || ''
    const combinedEmail = existingEmails ? `${existingEmails};${newEmail}` : newEmail

    // Update with combined emails
    const updateCommand = new UpdateCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: skey },
      UpdateExpression: 'SET email = :email, lastUpdated = :lastUpdated',
      ExpressionAttributeValues: {
        ':email': combinedEmail,
        ':lastUpdated': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    })

    const result = await docClient.send(updateCommand)

    console.log(`✅ Added second email for ${skey}`)

    // Sync both emails to SES with updated AttributesData
    const updatedRecord = result.Attributes
    const sesClient = getSesClient()
    const emails = combinedEmail
      .split(/[;,|\s]/)
      .map((e: string) => e.trim())
      .filter((e: string) => e.length > 0)

    const sesUpdateResults = []
    for (const emailAddress of emails) {
      try {
        // Build AttributesData from DynamoDB record
        const attributes = {
          firstName: updatedRecord?.firstName || '',
          lastName: updatedRecord?.lastName || '',
          displayName:
            updatedRecord?.firstName && updatedRecord?.lastName
              ? `${updatedRecord.firstName} ${updatedRecord.lastName}`.trim()
              : '',
          dynamodbSK: skey,
          ecclesia: updatedRecord?.ecclesia || '',
          isMember: updatedRecord?.ecclesia?.toLowerCase() === 'tee',
        }

        // Try to get existing contact first
        try {
          const getCommand = new GetContactCommand({
            ...inputTemplate,
            EmailAddress: emailAddress,
          })
          const currentContact = await sesClient.send(getCommand)

          // Update existing contact with new AttributesData
          const updateSesCommand = new UpdateContactCommand({
            ...inputTemplate,
            EmailAddress: emailAddress,
            TopicPreferences: currentContact.TopicPreferences,
            AttributesData: JSON.stringify(attributes),
          })
          await sesClient.send(updateSesCommand)
          sesUpdateResults.push({ email: emailAddress, action: 'updated' })
        } catch (getError: any) {
          if (getError.name === 'NotFoundException') {
            // Contact doesn't exist in SES - skip (they need to subscribe first)
            console.warn(`⚠️ ${emailAddress} not found in SES - skipping`)
            sesUpdateResults.push({ email: emailAddress, action: 'skipped', reason: 'not in SES' })
          } else {
            throw getError
          }
        }
      } catch (sesError: any) {
        console.error(`❌ Failed to update SES for ${emailAddress}:`, sesError.message)
        sesUpdateResults.push({ email: emailAddress, action: 'failed', error: sesError.message })
      }
    }

    return NextResponse.json({
      success: true,
      updated: result.Attributes,
      sesSync: sesUpdateResults,
    })
  } catch (error) {
    console.error('❌ Error adding second email:', error)
    return NextResponse.json({ error: 'Failed to add second email' }, { status: 500 })
  }
}
