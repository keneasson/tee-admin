import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { GetContactCommand, UpdateContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../../utils/email/sesClient'
import { inputTemplate } from '../../../../../utils/email/contact-lists'

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

type MemberUpdate = {
  pkey: string
  skey: string
  email: string
  isMember: boolean
}

/**
 * POST: Batch update member status (ecclesia field) for multiple directory members
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { updates } = body as { updates: MemberUpdate[] }

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid updates array' },
        { status: 400 }
      )
    }

    console.log(`📧 Batch updating member status for ${updates.length} directory members`)

    const results = []
    const errors = []

    // Process each update
    for (const update of updates) {
      try {
        const ecclesiaValue = update.isMember ? 'TEE' : ''

        // 1. Update DynamoDB Directory
        const updateCommand = new UpdateCommand({
          TableName: 'tee-schedules',
          Key: { PK: update.pkey, SK: update.skey },
          UpdateExpression: 'SET ecclesia = :ecclesia, lastUpdated = :lastUpdated',
          ExpressionAttributeValues: {
            ':ecclesia': ecclesiaValue,
            ':lastUpdated': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        })

        await docClient.send(updateCommand)

        // 2. Get directory data from DynamoDB to store in SES
        let directoryData: any = null
        try {
          const getDynamoCommand = new GetCommand({
            TableName: 'tee-schedules',
            Key: { PK: update.pkey, SK: update.skey }
          })
          const dynamoResult = await docClient.send(getDynamoCommand)
          directoryData = dynamoResult.Item
        } catch (dynamoError) {
          console.warn(`⚠️ Could not fetch directory data for ${update.skey}:`, dynamoError)
        }

        // 3. Update SES Members list (if email exists)
        if (update.email && update.email.trim()) {
          const sesClient = getSesClient()

          try {
            // Get current contact to preserve other list subscriptions
            const getCommand = new GetContactCommand({
              ...inputTemplate,
              EmailAddress: update.email
            })

            const currentContact = await sesClient.send(getCommand)

            // Update only the members topic preference, keep others
            const updatedTopicPreferences = currentContact.TopicPreferences?.map(pref => {
              if (pref.TopicName === 'members') {
                return {
                  ...pref,
                  SubscriptionStatus: update.isMember ? SubscriptionStatus.OPT_IN : SubscriptionStatus.OPT_OUT
                }
              }
              return pref
            }) || []

            // Build AttributesData with directory information
            const attributes = {
              firstName: directoryData?.firstName || '',
              lastName: directoryData?.lastName || '',
              displayName: directoryData?.firstName && directoryData?.lastName
                ? `${directoryData.firstName} ${directoryData.lastName}`.trim()
                : '',
              dynamodbSK: update.skey,  // Store the DynamoDB SK for linking
              ecclesia: ecclesiaValue,
              isMember: update.isMember
            }

            const updateSesCommand = new UpdateContactCommand({
              ...inputTemplate,
              EmailAddress: update.email,
              TopicPreferences: updatedTopicPreferences,
              AttributesData: JSON.stringify(attributes)
            })

            await sesClient.send(updateSesCommand)
          } catch (sesError: any) {
            // If contact doesn't exist in SES, that's OK - just skip SES update
            if (sesError.name !== 'NotFoundException') {
              console.warn(`⚠️ Could not update SES for ${update.email}:`, sesError.message)
            }
          }
        }

        results.push({
          skey: update.skey,
          email: update.email,
          success: true,
          ecclesia: ecclesiaValue
        })

        console.log(`✅ Updated member status for ${update.skey} (${update.email}) to ${ecclesiaValue || 'non-member'}`)

      } catch (error) {
        console.error(`❌ Failed to update ${update.skey}:`, error)
        errors.push({
          skey: update.skey,
          email: update.email,
          error: String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      updated: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error) {
    console.error('❌ Error batch updating member status:', error)
    return NextResponse.json(
      { error: 'Failed to batch update member status' },
      { status: 500 }
    )
  }
}
