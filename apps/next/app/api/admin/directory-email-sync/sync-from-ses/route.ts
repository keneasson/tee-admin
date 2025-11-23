import { NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ListContactsCommand, ListContactsCommandOutput, GetContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
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

type SyncResult = {
  email: string
  action: 'updated' | 'skipped' | 'failed'
  reason?: string
  error?: string
}

/**
 * POST: Sync SES contacts back to DynamoDB Directory
 * This reconciles changes made in SES (like subscription updates) with the DynamoDB directory
 *
 * Process:
 * 1. Fetch all SES contacts
 * 2. For contacts with dynamodbSK in AttributesData, update DynamoDB with SES data
 * 3. For contacts without dynamodbSK, flag as "orphaned" (SES-only, not in directory)
 * 4. Return sync report
 */
export async function POST() {
  try {
    // Check authentication - OWNER only for this operation
    const session = await auth()
    if (!session || (session.user as any)?.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized - Owner role required' }, { status: 401 })
    }

    console.log('🔄 Starting sync from SES to DynamoDB Directory...')

    const sesClient = getSesClient()
    const results: SyncResult[] = []
    const orphanedContacts: { email: string; firstName?: string; lastName?: string }[] = []

    // Fetch all contacts from SES
    let nextToken: string | undefined = undefined
    let totalProcessed = 0

    do {
      const listCommand: ListContactsCommand = new ListContactsCommand({
        ...inputTemplate,
        PageSize: 100,
        NextToken: nextToken
      })

      const listResponse: ListContactsCommandOutput = await sesClient.send(listCommand)

      if (!listResponse.Contacts) {
        break
      }

      // Process each contact
      for (const contact of listResponse.Contacts) {
        totalProcessed++

        if (!contact.EmailAddress) {
          continue
        }

        // Get full contact details including AttributesData
        let contactDetails
        try {
          const getContactCmd = new GetContactCommand({
            ...inputTemplate,
            EmailAddress: contact.EmailAddress
          })
          contactDetails = await sesClient.send(getContactCmd)
        } catch (error: any) {
          console.warn(`⚠️ Could not get details for ${contact.EmailAddress}:`, error.message)
          continue
        }

        // Parse AttributesData if it exists
        let attributes: any = null
        try {
          if (contactDetails.AttributesData) {
            attributes = JSON.parse(contactDetails.AttributesData)
          }
        } catch (parseError) {
          console.warn(`⚠️ Could not parse AttributesData for ${contact.EmailAddress}`)
        }

        // Check if contact has dynamodbSK (linked to directory)
        if (!attributes || !attributes.dynamodbSK) {
          // Orphaned contact - exists in SES but not linked to directory
          orphanedContacts.push({
            email: contact.EmailAddress,
            firstName: attributes?.firstName,
            lastName: attributes?.lastName
          })
          continue
        }

        // Contact has dynamodbSK - sync to DynamoDB
        try {
          // Get current directory record
          const getCommand = new GetCommand({
            TableName: 'tee-schedules',
            Key: {
              PK: 'DIRECTORY#MEMBERS',
              SK: attributes.dynamodbSK
            }
          })

          const dynamoRecord = await docClient.send(getCommand)

          if (!dynamoRecord.Item) {
            // Directory record doesn't exist - SES has stale dynamodbSK
            results.push({
              email: contact.EmailAddress,
              action: 'skipped',
              reason: `Directory record ${attributes.dynamodbSK} not found`
            })
            continue
          }

          // Check if member status changed in SES
          const isMemberInSes = attributes.isMember === true
          const ecclesiaInDynamo = dynamoRecord.Item.ecclesia || ''
          const isMemberInDynamo = ecclesiaInDynamo.toLowerCase() === 'tee'

          if (isMemberInSes !== isMemberInDynamo) {
            // Member status mismatch - update DynamoDB to match SES
            const newEcclesia = isMemberInSes ? 'TEE' : ''

            const updateCommand = new UpdateCommand({
              TableName: 'tee-schedules',
              Key: {
                PK: 'DIRECTORY#MEMBERS',
                SK: attributes.dynamodbSK
              },
              UpdateExpression: 'SET ecclesia = :ecclesia, lastUpdated = :lastUpdated',
              ExpressionAttributeValues: {
                ':ecclesia': newEcclesia,
                ':lastUpdated': new Date().toISOString()
              }
            })

            await docClient.send(updateCommand)

            results.push({
              email: contact.EmailAddress,
              action: 'updated',
              reason: `Updated ecclesia from "${ecclesiaInDynamo}" to "${newEcclesia}"`
            })

            console.log(`✅ Updated ${contact.EmailAddress} ecclesia: ${ecclesiaInDynamo} → ${newEcclesia}`)
          } else {
            // No changes needed
            results.push({
              email: contact.EmailAddress,
              action: 'skipped',
              reason: 'Already in sync'
            })
          }

        } catch (error: any) {
          console.error(`❌ Failed to sync ${contact.EmailAddress}:`, error.message)
          results.push({
            email: contact.EmailAddress,
            action: 'failed',
            error: error.message
          })
        }
      }

      nextToken = listResponse.NextToken
    } while (nextToken)

    const updated = results.filter(r => r.action === 'updated').length
    const skipped = results.filter(r => r.action === 'skipped').length
    const failed = results.filter(r => r.action === 'failed').length

    console.log(`✅ SES to DynamoDB sync complete:`)
    console.log(`   - Total processed: ${totalProcessed}`)
    console.log(`   - Updated: ${updated}`)
    console.log(`   - Skipped: ${skipped}`)
    console.log(`   - Failed: ${failed}`)
    console.log(`   - Orphaned (SES-only): ${orphanedContacts.length}`)

    return NextResponse.json({
      success: true,
      message: `Synced ${totalProcessed} contacts from SES`,
      summary: {
        totalProcessed,
        updated,
        skipped,
        failed,
        orphaned: orphanedContacts.length
      },
      results,
      orphanedContacts
    })

  } catch (error) {
    console.error('❌ Error syncing from SES to DynamoDB:', error)
    return NextResponse.json(
      { error: 'Failed to sync from SES to DynamoDB' },
      { status: 500 }
    )
  }
}
