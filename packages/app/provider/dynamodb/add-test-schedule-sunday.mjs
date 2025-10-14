#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = 'tee-send-queue'

async function addTestSchedule() {
  const schedule = {
    PK: 'SCHEDULE',
    SK: 'newsletter#sunday#23:00',
    emailType: 'newsletter',
    dayOfWeek: 'sunday',
    time: '23:00', // 11:00pm
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Sunday 11pm test newsletter (TEST MODE)',
    testMode: true, // CRITICAL: Only sends to test list
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    console.log('📧 Adding Sunday 11:00pm test schedule to DynamoDB...')
    console.log('   Table:', TABLE_NAME)
    console.log('   Schedule:', schedule)

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: schedule,
      })
    )

    console.log('✅ Test schedule added successfully!')
    console.log('')
    console.log('📋 Schedule Details:')
    console.log('   Type: Newsletter')
    console.log('   Day: Sunday')
    console.log('   Time: 11:00 PM (America/Toronto)')
    console.log('   Test Mode: ENABLED (sends to test list only)')
    console.log('')
    console.log('🔍 Monitoring:')
    console.log('   - EventBridge will queue this ~2 hours before (9pm)')
    console.log('   - Email will send within 2 hours of 11pm (testing window)')
    console.log('   - Check your test list inbox after 11pm')
    console.log('')
  } catch (error) {
    console.error('❌ Failed to add test schedule:', error)
    throw error
  }
}

addTestSchedule()
