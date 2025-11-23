import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { GetContactCommand, UpdateContactCommand, CreateContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
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

/**
 * POST: Create a new directory entry from an SES-only email
 * Creates a new DIRECTORY#MEMBERS record with the provided name and email
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, firstName, lastName, isMember } = body

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, firstName, lastName' },
        { status: 400 }
      )
    }

    console.log(`📧 Creating directory entry for: ${firstName} ${lastName} (${email}) - Member: ${isMember ? 'Yes' : 'No'}`)

    // Generate a unique SK by finding the next available index
    const queryCommand = new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DIRECTORY#MEMBERS'
      },
      ProjectionExpression: 'SK'
    })

    const existingMembers = await docClient.send(queryCommand)

    // Find the highest index
    let maxIndex = -1
    if (existingMembers.Items) {
      existingMembers.Items.forEach((item: any) => {
        const match = item.SK.match(/#(\d+)$/)
        if (match) {
          const index = parseInt(match[1], 10)
          if (index > maxIndex) {
            maxIndex = index
          }
        }
      })
    }

    const newIndex = maxIndex + 1
    const newSK = `MEMBER#${firstName.toUpperCase()}#${lastName.toUpperCase()}#${newIndex}`

    // Create new directory entry
    const putCommand = new PutCommand({
      TableName: 'tee-schedules',
      Item: {
        PK: 'DIRECTORY#MEMBERS',
        SK: newSK,
        firstName,
        lastName,
        email,
        ecclesia: isMember ? 'TEE' : '', // Set based on member checkbox
        address: '',
        phone: '',
        children: '',
        lastUpdated: new Date().toISOString(),
        version: '1'
      }
    })

    await docClient.send(putCommand)

    console.log(`✅ Created directory entry: ${newSK}`)

    // Sync to SES with AttributesData
    const sesClient = getSesClient()
    const ecclesiaValue = isMember ? 'TEE' : ''

    const attributes = {
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`.trim(),
      dynamodbSK: newSK,
      ecclesia: ecclesiaValue,
      isMember: !!isMember
    }

    let sesResult = null
    try {
      // Try to get existing contact first
      const getCommand = new GetContactCommand({
        ...inputTemplate,
        EmailAddress: email
      })
      const currentContact = await sesClient.send(getCommand)

      // Update existing contact with new AttributesData
      const updateCommand = new UpdateContactCommand({
        ...inputTemplate,
        EmailAddress: email,
        TopicPreferences: currentContact.TopicPreferences,
        AttributesData: JSON.stringify(attributes)
      })
      await sesClient.send(updateCommand)
      sesResult = { action: 'updated', email }
      console.log(`✅ Updated SES contact for ${email}`)
    } catch (getError: any) {
      if (getError.name === 'NotFoundException') {
        // Contact doesn't exist in SES - skip (they need to subscribe first)
        console.warn(`⚠️ ${email} not found in SES - skipping`)
        sesResult = { action: 'skipped', email, reason: 'not in SES' }
      } else {
        console.error(`❌ Failed to update SES for ${email}:`, getError.message)
        sesResult = { action: 'failed', email, error: getError.message }
      }
    }

    return NextResponse.json({
      success: true,
      created: {
        pkey: 'DIRECTORY#MEMBERS',
        skey: newSK,
        firstName,
        lastName,
        email
      },
      sesSync: sesResult
    })

  } catch (error) {
    console.error('❌ Error creating directory entry:', error)
    return NextResponse.json(
      { error: 'Failed to create directory entry' },
      { status: 500 }
    )
  }
}
