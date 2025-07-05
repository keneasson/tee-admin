import { scheduleRepo, adminRepo } from '@my/app/provider/dynamodb'
import { GoogleSheetsService } from './google-sheets-service'
import { SheetTransformer } from './sheet-transformer'
import type { MigrationResult, SheetMigrationResult } from '@my/app/provider/dynamodb/types'

// Webhook payload interface
export interface SheetWebhookPayload {
  eventType: 'SHEET_CHANGED'
  sheetId: string
  range?: string
  changeType: 'INSERT' | 'UPDATE' | 'DELETE'
  timestamp: string
}

// Debounced sync service to handle rapid edits efficiently
export class WebhookSyncService {
  private pendingSyncs = new Map<string, NodeJS.Timeout>()
  private readonly DEBOUNCE_DELAY = 30000 // 30 seconds
  private readonly MAX_RETRIES = 3
  
  private googleSheetsService = new GoogleSheetsService()
  private transformer = new SheetTransformer()

  async handleWebhook(payload: SheetWebhookPayload): Promise<void> {
    const { sheetId } = payload
    
    console.log(`🔄 Debouncing sync for sheet: ${sheetId}`)
    
    // Clear existing timeout for this sheet
    if (this.pendingSyncs.has(sheetId)) {
      clearTimeout(this.pendingSyncs.get(sheetId)!)
      console.log(`⏱️ Cleared existing timeout for sheet: ${sheetId}`)
    }
    
    // Set new debounced sync
    const timeout = setTimeout(async () => {
      try {
        console.log(`🚀 Starting debounced sync for sheet: ${sheetId}`)
        await this.syncSheetToDynamoDB(sheetId)
        console.log(`✅ Completed sync for sheet: ${sheetId}`)
      } catch (error) {
        console.error(`❌ Failed sync for sheet ${sheetId}:`, error)
      } finally {
        this.pendingSyncs.delete(sheetId)
      }
    }, this.DEBOUNCE_DELAY)
    
    this.pendingSyncs.set(sheetId, timeout)
    
    console.log(`⏰ Scheduled sync for sheet ${sheetId} in ${this.DEBOUNCE_DELAY/1000}s`)
  }

  async syncSheetToDynamoDB(sheetId: string): Promise<SheetMigrationResult> {
    const startTime = Date.now()
    
    try {
      // Check if data actually changed using version/checksum
      const currentVersion = await this.getSheetVersion(sheetId)
      const lastSyncedVersion = await this.getLastSyncedVersion(sheetId)
      
      if (currentVersion === lastSyncedVersion) {
        console.log(`📋 No changes detected for sheet ${sheetId}, skipping sync`)
        return {
          sheetId,
          sheetType: 'unknown',
          recordsProcessed: 0,
          recordsSuccessful: 0,
          recordsFailed: 0,
          errors: [],
          executionTime: Date.now() - startTime,
        }
      }
      
      // Determine sheet type and get data
      const sheetType = await this.determineSheetType(sheetId)
      const sheetData = await this.googleSheetsService.getSheetData(sheetId)
      
      if (!sheetData || sheetData.length === 0) {
        throw new Error(`No data found in sheet ${sheetId}`)
      }
      
      // Transform data based on sheet type
      let result: { successful: number; failed: number; errors: string[] }
      
      switch (sheetType) {
        case 'schedule':
          const scheduleRecords = this.transformer.transformScheduleData(sheetData, sheetId)
          result = await scheduleRepo.replaceSheetSchedules(sheetId, scheduleRecords)
          break
          
        case 'directory':
          const directoryRecords = this.transformer.transformDirectoryData(sheetData, sheetId)
          result = await adminRepo.replaceSheetDirectoryRecords(sheetId, directoryRecords)
          break
          
        default:
          throw new Error(`Unknown sheet type: ${sheetType}`)
      }
      
      // Update sync status
      await this.updateSyncStatus(sheetId, sheetType, currentVersion, 'completed')
      
      const migrationResult: SheetMigrationResult = {
        sheetId,
        sheetType,
        recordsProcessed: sheetData.length,
        recordsSuccessful: result.successful,
        recordsFailed: result.failed,
        errors: result.errors,
        executionTime: Date.now() - startTime,
      }
      
      console.log(`📊 Sync completed for ${sheetId}:`, migrationResult)
      return migrationResult
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Update sync status to failed
      await this.updateSyncStatus(sheetId, 'unknown', '', 'failed', errorMessage)
      
      const failedResult: SheetMigrationResult = {
        sheetId,
        sheetType: 'unknown',
        recordsProcessed: 0,
        recordsSuccessful: 0,
        recordsFailed: 1,
        errors: [errorMessage],
        executionTime: Date.now() - startTime,
      }
      
      console.error(`❌ Sync failed for ${sheetId}:`, failedResult)
      throw error
    }
  }

  // Get sheet version/checksum to detect changes
  private async getSheetVersion(sheetId: string): Promise<string> {
    try {
      // Get sheet metadata to create a version hash
      const metadata = await this.googleSheetsService.getSheetMetadata(sheetId)
      
      // Create version string from last modified time + row count
      const versionData = {
        lastModified: metadata.modifiedTime,
        rowCount: metadata.sheets?.[0]?.properties?.gridProperties?.rowCount || 0,
        columnCount: metadata.sheets?.[0]?.properties?.gridProperties?.columnCount || 0,
      }
      
      // Simple hash of version data
      return Buffer.from(JSON.stringify(versionData)).toString('base64')
    } catch (error) {
      console.warn(`⚠️ Could not get version for sheet ${sheetId}:`, error)
      return Date.now().toString() // Fallback to timestamp
    }
  }

  private async getLastSyncedVersion(sheetId: string): Promise<string> {
    try {
      // Get last synced version from sync status table
      // This will be implemented when we create the sync status repository
      return '' // For now, always sync
    } catch (error) {
      console.warn(`⚠️ Could not get last synced version for sheet ${sheetId}:`, error)
      return ''
    }
  }

  private async determineSheetType(sheetId: string): Promise<'schedule' | 'directory' | 'events'> {
    // This would be configured based on known sheet IDs
    // For now, we'll use a simple mapping
    const sheetTypeMapping: Record<string, 'schedule' | 'directory' | 'events'> = {
      // Add your actual sheet IDs here
      // 'your-schedule-sheet-id': 'schedule',
      // 'your-directory-sheet-id': 'directory',
    }
    
    return sheetTypeMapping[sheetId] || 'schedule' // Default to schedule
  }

  private async updateSyncStatus(
    sheetId: string, 
    sheetType: string, 
    version: string, 
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      // This will be implemented with the sync status repository
      console.log(`📝 Sync status for ${sheetId}: ${status}`)
    } catch (error) {
      console.warn(`⚠️ Could not update sync status for sheet ${sheetId}:`, error)
    }
  }

  // Manual sync trigger (for admin users)
  async triggerManualSync(sheetId: string): Promise<SheetMigrationResult> {
    console.log(`🔧 Manual sync triggered for sheet: ${sheetId}`)
    
    // Clear any pending debounced sync
    if (this.pendingSyncs.has(sheetId)) {
      clearTimeout(this.pendingSyncs.get(sheetId)!)
      this.pendingSyncs.delete(sheetId)
    }
    
    return this.syncSheetToDynamoDB(sheetId)
  }

  // Get sync status for monitoring
  getSyncStatus(): Array<{ sheetId: string; status: 'pending' | 'syncing'; scheduledAt: string }> {
    const status: Array<{ sheetId: string; status: 'pending' | 'syncing'; scheduledAt: string }> = []
    
    this.pendingSyncs.forEach((timeout, sheetId) => {
      status.push({
        sheetId,
        status: 'pending',
        scheduledAt: new Date(Date.now() + this.DEBOUNCE_DELAY).toISOString(),
      })
    })
    
    return status
  }

  // Cleanup method for graceful shutdown
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up webhook sync service...')
    
    // Clear all pending timeouts
    this.pendingSyncs.forEach((timeout) => {
      clearTimeout(timeout)
    })
    
    this.pendingSyncs.clear()
    console.log('✅ Webhook sync service cleanup complete')
  }
}