/**
 * Types for Multi-Sheet Sync Monitoring
 */

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

export interface SheetSyncTriggerRequest {
  sheetId: string
  sheetType: string
}

export interface SheetSyncTriggerResponse {
  success: boolean
  message: string
  sheetId: string
  sheetType: string
  timestamp: string
}