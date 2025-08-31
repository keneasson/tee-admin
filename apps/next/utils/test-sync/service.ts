/**
 * Test Sync Service - Pure Functions
 * Handles test data sync between Google Sheets and DynamoDB
 */

import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import type { TestSyncStatus, TestSyncRecord } from '@my/app/types/test-sync'
import { getAwsDbConfig } from '../email/sesClient'
import { nextAuthDynamoDb } from '../auth'

// Internal type for DynamoDB records
interface DynamoSyncRecord {
  pkey: string
  skey: string
  date: string
  name: string
  topic: string
  sheetId: string
  rowNumber: number
  rowChecksum?: string
  syncedAt: string
  version: number
  ttl?: number
}

// Test Google Sheet configuration
export const TEST_SHEET_CONFIG = {
  sheetId: '1ffB9-VWxaTQudAskm_m9vP2bbaFwA5l_tkGimTkzXAw', // Test sync sheet ID from Google services config
  sheetName: 'TestSync',
  range: 'A:C', // Date, Name, Topic columns
  sheetType: 'testSync' // Custom type that won't appear in production schedules
}

// Initialize DynamoDB client using existing configuration
const getDynamoClient = (): DynamoDBDocument => {
  const dbClientConfig = getAwsDbConfig()
  const client = new DynamoDB(dbClientConfig)
  
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
    const tableName = nextAuthDynamoDb.tableName
    
    // Query for all source-based metadata
    const result = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'pkey = :pkey AND begins_with(skey, :skey_prefix)',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC#STATUS',
        ':skey_prefix': 'SOURCE#'
      }
    })

    console.log('📋 Retrieved all source metadata from DynamoDB:', JSON.stringify(result.Items, null, 2))
    
    // Extract metadata by source
    const sources = result.Items || []
    const webhookMeta = sources.find(item => item.skey === 'SOURCE#webhook')
    const manualMeta = sources.find(item => item.skey === 'SOURCE#manual')
    const cronMeta = sources.find(item => item.skey === 'SOURCE#cron')
    
    // Get most recent sync across all sources
    const allSyncTimes = sources.map(item => item.lastSync).filter(Boolean)
    const mostRecentSync = allSyncTimes.length > 0 ? allSyncTimes.sort().reverse()[0] : null
    
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
      lastSync: mostRecentSync,
      totalRecords: countResult.Count || 0,
      lastWebhook: webhookMeta?.lastSync || null,
      lastManual: manualMeta?.lastSync || null,
      lastCron: cronMeta?.lastSync || null,
      sheetVersion: null, // TODO: Implement if needed
      dynamoVersion: sources.length > 0 ? sources[0].dynamoVersion : null,
      cacheStatus: determineCacheStatus(mostRecentSync),
      errors: sources.flatMap(s => s.errors || [])
    }
  } catch (error) {
    console.error('Failed to get test sync status:', error)
    return {
      lastSync: null,
      totalRecords: 0,
      lastWebhook: null,
      lastManual: null,
      lastCron: null,
      sheetVersion: null,
      dynamoVersion: null,
      cacheStatus: 'cold',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Get data from Google Sheets
 */
export async function getSheetData(): Promise<TestSyncRecord[]> {
  try {
    console.log('📊 Fetching test sync data from Google Sheets...')
    
    // Import the Google Sheets service
    const { GoogleSheetsService } = await import('@my/app/provider/sync/google-sheets-service')
    const sheetsService = new GoogleSheetsService()
    
    // Fetch the raw data from the sheet
    const rawData = await sheetsService.getSheetData(TEST_SHEET_CONFIG.sheetId, TEST_SHEET_CONFIG.range)
    
    console.log(`📈 Retrieved ${rawData.length} rows from test sheet`)
    
    // Skip header row and transform to our format
    const records: TestSyncRecord[] = []
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      if (row && row.length >= 3 && row[0]) { // Ensure we have all columns and Date is not empty
        records.push({
          Date: row[0]?.toString() || '',
          Name: row[1]?.toString() || '',
          Topic: row[2]?.toString() || '',
          rowNumber: i + 1, // Row numbers are 1-indexed in sheets
          sheetId: TEST_SHEET_CONFIG.sheetId,
          lastModified: new Date().toISOString()
        })
      }
    }
    
    console.log(`✅ Processed ${records.length} valid test sync records`)
    return records
    
  } catch (error) {
    console.error('Failed to get sheet data:', error)
    // Return empty array on error to avoid breaking the UI
    return []
  }
}

/**
 * Get data from DynamoDB in format needed for checksum comparison
 */
export async function getDynamoDataForSync(): Promise<Array<{
  skey: string
  date: string
  name: string
  topic: string
  rowChecksum?: string
}>> {
  try {
    const dynamoDb = getDynamoClient()
    const tableName = nextAuthDynamoDb.tableName
    
    const result = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'pkey = :pkey AND begins_with(skey, :prefix)',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC',
        ':prefix': 'DATE#'
      }
    })

    return (result.Items || []).map((item: DynamoSyncRecord) => ({
      skey: item.skey,
      date: item.date,
      name: item.name,
      topic: item.topic,
      rowChecksum: item.rowChecksum
    }))
  } catch (error) {
    console.error('Failed to get DynamoDB data for sync:', error)
    return []
  }
}

/**
 * Get data from DynamoDB (for display purposes)
 */
export async function getDynamoData(): Promise<TestSyncRecord[]> {
  try {
    const dynamoDb = getDynamoClient()
    const tableName = nextAuthDynamoDb.tableName
    
    const result = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'pkey = :pkey AND begins_with(skey, :prefix)',
      ExpressionAttributeValues: {
        ':pkey': 'TEST#SYNC',
        ':prefix': 'DATE#'
      }
    })

    return (result.Items || []).map((item: DynamoSyncRecord) => ({
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
 * Sync data from Google Sheets to DynamoDB using checksum-based diff
 */
export async function syncSheetToDynamo(
  records: TestSyncRecord[], 
  source: 'webhook' | 'manual' | 'cron'
): Promise<{
  success: boolean
  message: string
  recordsProcessed: number
}> {
  try {
    const dynamoDb = getDynamoClient()
    const tableName = nextAuthDynamoDb.tableName
    const timestamp = new Date().toISOString()
    
    // Import checksum utilities
    const { calculateRowChecksum, calculateSheetChecksum, compareRowData } = 
      await import('./checksum')
    
    console.log(`🔍 Starting checksum-based sync for ${records.length} records from ${source}`)
    
    // Calculate current data checksums
    const currentRows = records.map((record, index) => ({
      rowNumber: record.rowNumber || index + 2,
      date: typeof record.Date === 'string' ? record.Date : record.Date.toISOString(),
      name: record.Name,
      topic: record.Topic
    }))
    
    const currentRowChecksums = currentRows.map(row => 
      calculateRowChecksum(row.rowNumber, row.date, row.name, row.topic)
    )
    
    const currentSheetChecksum = calculateSheetChecksum(currentRowChecksums)
    console.log(`📊 Current sheet checksum: ${currentSheetChecksum}`)
    
    // Get existing data from DynamoDB
    const existingData = await getDynamoDataForSync()
    console.log(`📋 Found ${existingData.length} existing records in DynamoDB`)
    
    // Compare and get diff
    const diff = compareRowData(currentRows, existingData)
    console.log(`🔄 Diff: ${diff.toInsert.length} inserts, ${diff.toUpdate.length} updates, ${diff.toDelete.length} deletes`)
    
    // Early exit if no changes
    if (diff.toInsert.length === 0 && diff.toUpdate.length === 0 && diff.toDelete.length === 0) {
      console.log('✅ No changes detected - skipping sync')
      
      // Still update metadata to track sync attempt
      await dynamoDb.put({
        TableName: tableName,
        Item: {
          pkey: 'TEST#SYNC#STATUS',
          skey: `SOURCE#${source}`,
          lastSync: timestamp,
          source: source,
          sheetChecksum: currentSheetChecksum,
          dynamoVersion: `v${Date.now()}`,
          totalRecords: records.length,
          errors: []
        }
      })
      
      return {
        success: true,
        message: 'No changes detected',
        recordsProcessed: 0
      }
    }
    
    let operationsCompleted = 0
    
    // Process deletions
    if (diff.toDelete.length > 0) {
      const deleteRequests = diff.toDelete.map(skey => ({
        DeleteRequest: {
          Key: { pkey: 'TEST#SYNC', skey }
        }
      }))
      
      // Process in chunks of 25 (DynamoDB batch limit)
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const chunk = deleteRequests.slice(i, i + 25)
        await dynamoDb.batchWrite({
          RequestItems: {
            [tableName]: chunk
          }
        })
        operationsCompleted += chunk.length
        console.log(`🗑️ Deleted ${chunk.length} orphaned records`)
      }
    }
    
    // Process inserts and updates
    const writeRequests = [
      ...diff.toInsert.map(row => ({
        PutRequest: {
          Item: {
            pkey: 'TEST#SYNC',
            skey: `DATE#${row.date}#ROW#${row.rowNumber}`,
            date: row.date,
            name: row.name,
            topic: row.topic,
            sheetId: TEST_SHEET_CONFIG.sheetId,
            rowNumber: row.rowNumber,
            rowChecksum: row.checksum,
            syncedAt: timestamp,
            version: 1,
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
          }
        }
      })),
      ...diff.toUpdate.map(row => ({
        PutRequest: {
          Item: {
            pkey: 'TEST#SYNC',
            skey: `DATE#${row.date}#ROW#${row.rowNumber}`,
            date: row.date,
            name: row.name,
            topic: row.topic,
            sheetId: TEST_SHEET_CONFIG.sheetId,
            rowNumber: row.rowNumber,
            rowChecksum: row.checksum,
            syncedAt: timestamp,
            version: 1,
            ttl: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days TTL
          }
        }
      }))
    ]
    
    // Process writes in chunks of 25
    for (let i = 0; i < writeRequests.length; i += 25) {
      const chunk = writeRequests.slice(i, i + 25)
      await dynamoDb.batchWrite({
        RequestItems: {
          [tableName]: chunk
        }
      })
      operationsCompleted += chunk.length
    }
    
    console.log(`✅ Completed ${diff.toInsert.length} inserts, ${diff.toUpdate.length} updates`)
    
    // Update sync metadata with checksum
    await dynamoDb.put({
      TableName: tableName,
      Item: {
        pkey: 'TEST#SYNC#STATUS',
        skey: `SOURCE#${source}`,
        lastSync: timestamp,
        source: source,
        sheetChecksum: currentSheetChecksum,
        dynamoVersion: `v${Date.now()}`,
        totalRecords: records.length,
        errors: []
      }
    })

    return {
      success: true,
      message: `Successfully synced: ${diff.toInsert.length} new, ${diff.toUpdate.length} updated, ${diff.toDelete.length} deleted`,
      recordsProcessed: operationsCompleted
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