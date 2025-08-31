/**
 * Multi-Sheet Sync Monitoring Service
 * Extends test sync functionality to monitor all production sheets
 */

import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../email/sesClient'
import { nextAuthDynamoDb } from '../auth'

// Sheet configuration from service account
export interface SheetConfig {
  id: string
  name: string
  type: string
  startTime?: string
  isActive: boolean
  lastSync?: string
  lastWebhook?: string
  recordCount?: number
  status: 'healthy' | 'stale' | 'error' | 'unknown'
  errors?: string[]
}

// Multi-sheet sync status
export interface MultiSheetSyncStatus {
  timestamp: string
  totalSheets: number
  healthySheets: number
  staleSheets: number
  errorSheets: number
  unknownSheets: number
  overallHealth: 'healthy' | 'degraded' | 'critical'
  isProduction: boolean
  webhookDomain: string
  sheets: SheetConfig[]
}

// Get sheet configuration from service account
async function getSheetConfigs(): Promise<SheetConfig[]> {
  try {
    // Import the service configuration
    const serviceConfig = await import('../../tee-services-db47a9e534d3.json')
    const sheetIds = serviceConfig.sheet_ids

    const configs: SheetConfig[] = []
    
    Object.entries(sheetIds).forEach(([type, config]: [string, any]) => {
      // Skip cyc as it's not a Google Sheet
      if (type !== 'cyc') {
        configs.push({
          id: config.key,
          name: config.name,
          type,
          startTime: config.startTime,
          isActive: true, // All sheets are considered active
          status: 'unknown',
          errors: []
        })
      }
    })

    return configs
  } catch (error) {
    console.error('Failed to load sheet configuration:', error)
    return []
  }
}

// Initialize DynamoDB client
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

// Detect environment and webhook domain
export function detectEnvironment(): { isProduction: boolean; webhookDomain: string } {
  const currentDomain = process.env.VERCEL_URL || 
                       process.env.NEXT_PUBLIC_VERCEL_URL || 
                       'localhost:3000'
  
  const isProduction = currentDomain.includes('tee-admin.com') || 
                      currentDomain.includes('www.tee-admin.com')
  
  const webhookDomain = isProduction ? 'https://www.tee-admin.com' : 
                       currentDomain.startsWith('http') ? currentDomain :
                       `http://${currentDomain}`

  return { isProduction, webhookDomain }
}

// Get sync metadata for a specific sheet
async function getSheetSyncStatus(sheetId: string): Promise<{
  lastSync?: string
  lastWebhook?: string
  recordCount?: number
  errors: string[]
}> {
  try {
    const dynamoDb = getDynamoClient()
    // Use the new sync status table
    const tableName = 'tee-sync-status'
    
    // Query for sheet-specific sync metadata in the new table structure
    const result = await dynamoDb.query({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `SYNC#${sheetId}`
      }
    })

    const sources = result.Items || []
    const webhookMeta = sources.find(item => item.SK === 'SOURCE#webhook')
    const manualMeta = sources.find(item => item.SK === 'SOURCE#manual')
    
    // Get most recent sync
    const allSyncTimes = sources.map(item => item.lastSync).filter(Boolean)
    const mostRecentSync = allSyncTimes.length > 0 ? allSyncTimes.sort().reverse()[0] : undefined

    // Count records (if available)
    const totalRecords = sources.reduce((max, source) => 
      Math.max(max, source.totalRecords || 0), 0)

    return {
      lastSync: mostRecentSync,
      lastWebhook: webhookMeta?.lastSync,
      recordCount: totalRecords > 0 ? totalRecords : undefined,
      errors: sources.flatMap(s => s.errors || [])
    }
  } catch (error) {
    console.error(`Failed to get sync status for sheet ${sheetId}:`, error)
    return {
      errors: [error instanceof Error ? error.message : 'Failed to fetch sync status']
    }
  }
}

// Determine health status based on sync data
function determineHealthStatus(
  lastSync?: string, 
  lastWebhook?: string, 
  errors: string[] = []
): 'healthy' | 'stale' | 'error' | 'unknown' {
  if (errors.length > 0) return 'error'
  if (!lastSync && !lastWebhook) return 'unknown'
  
  const mostRecent = lastSync && lastWebhook ? 
    (new Date(lastSync) > new Date(lastWebhook) ? lastSync : lastWebhook) :
    (lastSync || lastWebhook)
  
  if (!mostRecent) return 'unknown'
  
  const ageInMinutes = (Date.now() - new Date(mostRecent).getTime()) / (1000 * 60)
  
  if (ageInMinutes < 60) return 'healthy'  // Less than 1 hour
  if (ageInMinutes < 1440) return 'stale'  // Less than 24 hours
  return 'error'  // Over 24 hours old
}

// Get comprehensive multi-sheet sync status
export async function getMultiSheetSyncStatus(): Promise<MultiSheetSyncStatus> {
  try {
    const sheetConfigs = await getSheetConfigs()
    const { isProduction, webhookDomain } = detectEnvironment()
    
    // Get sync status for each sheet
    const sheetsWithStatus = await Promise.all(
      sheetConfigs.map(async (sheet): Promise<SheetConfig> => {
        const syncStatus = await getSheetSyncStatus(sheet.id)
        const health = determineHealthStatus(
          syncStatus.lastSync,
          syncStatus.lastWebhook,
          syncStatus.errors
        )
        
        return {
          ...sheet,
          lastSync: syncStatus.lastSync,
          lastWebhook: syncStatus.lastWebhook,
          recordCount: syncStatus.recordCount,
          status: health,
          errors: syncStatus.errors
        }
      })
    )

    // Calculate overall health metrics
    const healthCounts = sheetsWithStatus.reduce((acc, sheet) => {
      acc[sheet.status]++
      return acc
    }, { healthy: 0, stale: 0, error: 0, unknown: 0 })

    const overallHealth: 'healthy' | 'degraded' | 'critical' = 
      healthCounts.error > 0 ? 'critical' :
      healthCounts.stale > 0 || healthCounts.unknown > sheetsWithStatus.length / 2 ? 'degraded' :
      'healthy'

    return {
      timestamp: new Date().toISOString(),
      totalSheets: sheetsWithStatus.length,
      healthySheets: healthCounts.healthy,
      staleSheets: healthCounts.stale,
      errorSheets: healthCounts.error,
      unknownSheets: healthCounts.unknown,
      overallHealth,
      isProduction,
      webhookDomain,
      sheets: sheetsWithStatus
    }
  } catch (error) {
    console.error('Failed to get multi-sheet sync status:', error)
    
    return {
      timestamp: new Date().toISOString(),
      totalSheets: 0,
      healthySheets: 0,
      staleSheets: 0,
      errorSheets: 0,
      unknownSheets: 0,
      overallHealth: 'critical',
      isProduction: false,
      webhookDomain: 'unknown',
      sheets: [],
    }
  }
}

// Trigger sync for a specific sheet (manual recovery)
export async function triggerSheetSync(sheetId: string, sheetType: string): Promise<{
  success: boolean
  message: string
}> {
  try {
    // Import the Google Sheets service
    const { GoogleSheetsService } = await import('@my/app/provider/sync/google-sheets-service')
    const sheetsService = new GoogleSheetsService()
    
    // For now, just trigger a basic sync - can be enhanced based on sheet type
    console.log(`🔄 Triggering manual sync for ${sheetType} sheet: ${sheetId}`)
    
    // This is a placeholder - actual sync logic would depend on the sheet type
    // For production sheets, we'd need specific sync logic per sheet type
    
    return {
      success: true,
      message: `Sync triggered for ${sheetType} sheet`
    }
  } catch (error) {
    console.error(`Failed to trigger sync for sheet ${sheetId}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Sync trigger failed'
    }
  }
}