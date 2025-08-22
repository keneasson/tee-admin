/**
 * Test Sync Service - Pure Functions
 * Handles test data sync between Google Sheets and DynamoDB
 */

import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import type { TestSyncStatus, TestSyncRecord, TestSyncDynamoRecord } from '@my/app/types/test-sync'

// Test Google Sheet configuration
export const TEST_SHEET_CONFIG = {
  sheetId: process.env.TEST_SYNC_SHEET_ID || '1test-sheet-id', // Will be set after manual sheet creation
  sheetName: 'TestSync',
  range: 'A:C', // Date, Name, Topic columns
  sheetType: 'testSync' // Custom type that won't appear in production schedules
}

// Initialize DynamoDB client
const getDynamoClient = (): DynamoDBDocument => {
  const client = new DynamoDB({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })
  
  return DynamoDBDocument.from(client, {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  })
}

/**
 * Get test sync status
 */
export async function getTestSyncStatus(): Promise<TestSyncStatus> {
  try {
    const dynamoDb = getDynamoClient()
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'tee-admin'
    
    // Query for sync metadata
    const result = await dynamoDb.get({
      TableName: tableName,
      Key: {
        pkey: 'TEST#SYNC#STATUS',
        skey: 'METADATA'
      }
    })

    const metadata = result.Item || {}
    
    // Count records in DynamoDB
    const countResult = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'pkey = :pkey',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC'
      },
      Select: 'COUNT'
    })

    return {
      lastSync: metadata.lastSync || null,
      totalRecords: countResult.Count || 0,
      lastWebhook: metadata.lastWebhook || null,
      sheetVersion: metadata.sheetVersion || null,
      dynamoVersion: metadata.dynamoVersion || null,
      cacheStatus: determineCacheStatus(metadata.lastSync),
      errors: metadata.errors || []
    }
  } catch (error) {
    console.error('Failed to get test sync status:', error)
    return {
      lastSync: null,
      totalRecords: 0,
      lastWebhook: null,
      sheetVersion: null,
      dynamoVersion: null,
      cacheStatus: 'cold',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Get data from Google Sheets (mock for now)
 */
export async function getSheetData(): Promise<TestSyncRecord[]> {
  try {
    // For initial testing, return mock data
    // TODO: Implement actual Google Sheets API call
    return [
      {
        Date: '2025-01-20',
        Name: 'John Smith',
        Topic: 'Test Topic 1',
        rowNumber: 2,
        sheetId: TEST_SHEET_CONFIG.sheetId
      },
      {
        Date: '2025-01-21',
        Name: 'Jane Doe',
        Topic: 'Test Topic 2',
        rowNumber: 3,
        sheetId: TEST_SHEET_CONFIG.sheetId
      }
    ]
  } catch (error) {
    console.error('Failed to get sheet data:', error)
    return []
  }
}

/**
 * Get data from DynamoDB
 */
export async function getDynamoData(): Promise<TestSyncRecord[]> {
  try {
    const dynamoDb = getDynamoClient()
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'tee-admin'
    
    const result = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'pkey = :pkey',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC'
      },
      FilterExpression: 'skey <> :meta',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC',
        ':meta': 'METADATA'
      }
    })

    return (result.Items || []).map((item: TestSyncDynamoRecord) => ({
      Date: item.date,
      Name: item.name,
      Topic: item.topic,
      rowNumber: item.rowNumber,
      sheetId: item.sheetId,
      lastModified: item.syncedAt
    }))
  } catch (error) {
    console.error('Failed to get DynamoDB data:', error)
    return []
  }
}

/**
 * Sync data from Google Sheets to DynamoDB
 */
export async function syncSheetToDynamo(records: TestSyncRecord[]): Promise<{
  success: boolean
  message: string
  recordsProcessed: number
}> {
  try {
    const dynamoDb = getDynamoClient()
    const tableName = process.env.DYNAMODB_TABLE_NAME || 'tee-admin'
    const timestamp = new Date().toISOString()
    
    // Batch write records
    const putRequests = records.map((record, index) => ({
      PutRequest: {
        Item: {
          pkey: 'TEST#SYNC',
          skey: `DATE#${record.Date}#ROW#${record.rowNumber || index + 2}`,
          date: record.Date,
          name: record.Name,
          topic: record.Topic,
          sheetId: record.sheetId || TEST_SHEET_CONFIG.sheetId,
          rowNumber: record.rowNumber || index + 2,
          syncedAt: timestamp,
          version: 1,
          ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
        }
      }
    }))

    // DynamoDB batch write limit is 25 items
    const chunks = []
    for (let i = 0; i < putRequests.length; i += 25) {
      chunks.push(putRequests.slice(i, i + 25))
    }

    let totalProcessed = 0
    for (const chunk of chunks) {
      await dynamoDb.batchWrite({
        RequestItems: {
          [tableName]: chunk
        }
      })
      totalProcessed += chunk.length
    }

    // Update sync status
    await dynamoDb.put({
      TableName: tableName,
      Item: {
        pkey: 'TEST#SYNC#STATUS',
        skey: 'METADATA',
        lastSync: timestamp,
        dynamoVersion: `v${Date.now()}`,
        totalRecords: records.length,
        errors: []
      }
    })

    return {
      success: true,
      message: `Successfully synced ${totalProcessed} records`,
      recordsProcessed: totalProcessed
    }
  } catch (error) {
    console.error('Failed to sync to DynamoDB:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Sync failed',
      recordsProcessed: 0
    }
  }
}

/**
 * Clear cache for test data
 */
export async function clearTestCache(): Promise<void> {
  // TODO: Implement cache clearing logic
  // For now, just log
  console.log('🗑️ Clearing test sync cache...')
}

/**
 * Determine cache status based on last sync time
 */
function determineCacheStatus(lastSync: string | null): 'hot' | 'cold' | 'stale' {
  if (!lastSync) return 'cold'
  
  const syncTime = new Date(lastSync).getTime()
  const now = Date.now()
  const ageInMinutes = (now - syncTime) / (1000 * 60)
  
  if (ageInMinutes < 5) return 'hot'
  if (ageInMinutes < 60) return 'stale'
  return 'cold'
}