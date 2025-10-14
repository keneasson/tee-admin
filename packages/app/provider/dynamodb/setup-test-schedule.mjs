#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = 'tee-schedules'

/**
 * Add a single test schedule: Thursday 9:30pm newsletter (TEST MODE)
 */
async function addTestSchedule() {
  const schedule = {
    PK: 'SCHEDULE',
    SK: 'newsletter#thursday#21:30',
    emailType: 'newsletter',
    dayOfWeek: 'thursday',
    time: '21:30', // 9:30pm
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Thursday test newsletter (TEST MODE)',
    testMode: true, // IMPORTANT: Always send to test list
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    console.log('📧 Adding Thursday 9:30pm test schedule to DynamoDB...')
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
    console.log('   Day: Thursday')
    console.log('   Time: 9:30 PM (America/Toronto)')
    console.log('   Test Mode: ENABLED (sends to test list only)')
    console.log('')
    console.log('🔗 Next steps:')
    console.log('   1. Set up EventBridge scheduler to call /api/cron/email-queue every 15 minutes')
    console.log('   2. EventBridge will queue this email ~2 hours before 9:30pm on Thursdays')
    console.log('   3. Email will be sent within 15 minutes of 9:30pm')
    console.log('')

  } catch (error) {
    console.error('❌ Failed to add test schedule:', error)
    throw error
  }
}

// Run it
addTestSchedule()
