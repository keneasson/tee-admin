/**
 * Test Sync Data Types
 * Simple data structure for testing Google Sheets → DynamoDB sync
 */

export interface TestSyncRecord {
  // From Google Sheets
  Date: string | Date  // Date column
  Name: string         // Name column  
  Topic: string        // Topic column
  
  // Metadata
  rowNumber?: number   // Sheet row number
  sheetId?: string     // Google Sheet ID
  lastModified?: string // ISO timestamp
}

export interface TestSyncDynamoRecord {
  // DynamoDB keys
  pkey: string  // TEST#SYNC
  skey: string  // DATE#2025-01-15#ROW#2
  
  // Data
  date: string
  name: string
  topic: string
  
  // Metadata
  sheetId: string
  rowNumber: number
  syncedAt: string
  version: number
  ttl?: number
}

export interface TestSyncStatus {
  lastSync: string | null
  totalRecords: number
  lastWebhook: string | null
  sheetVersion: string | null
  dynamoVersion: string | null
  cacheStatus: 'hot' | 'cold' | 'stale'
  errors: string[]
}