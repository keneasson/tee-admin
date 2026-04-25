#!/usr/bin/env node
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'

const client = new DynamoDBClient({})
const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = 'tee-send-queue'

async function debugQueue() {
  console.log('📋 SCHEDULES:')
  const schedules = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'SCHEDULE' },
    })
  )
  console.log(JSON.stringify(schedules.Items, null, 2))

  console.log('\n📧 QUEUE ENTRIES:')
  const queue = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'QUEUE' },
    })
  )
  console.log(JSON.stringify(queue.Items, null, 2))

  console.log('\n🔍 READY EMAILS (via GSI):')
  const ready = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'StatusIndex',
      KeyConditionExpression: 'GSI1PK = :status',
      ExpressionAttributeValues: { ':status': 'ready' },
    })
  )
  console.log(JSON.stringify(ready.Items, null, 2))
}

debugQueue().catch(console.error)
