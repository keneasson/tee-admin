#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = 'tee-send-queue'

async function setupTestSchedule() {
  const schedule = {
    PK: 'SCHEDULE',
    SK: 'newsletter#thursday#22:25',
    emailType: 'newsletter',
    dayOfWeek: 'thursday',
    time: '22:25', // 10:25pm
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Thursday test newsletter at 10:25pm (TEST MODE)',
    testMode: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    console.log('📧 Adding Thursday 10:25pm test schedule to DynamoDB...')
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
    console.log('   Time: 10:25 PM (America/Toronto)')
    console.log('   Test Mode: ENABLED (sends to test list only)')
    console.log('')
  } catch (error) {
    console.error('❌ Failed to add test schedule:', error)
    throw error
  }
}

setupTestSchedule()
