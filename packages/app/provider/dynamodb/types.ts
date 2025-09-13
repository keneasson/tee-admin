import type {
  BibleClassType,
  CycType,
  MemorialServiceType,
  ProgramTypeKeys,
  ProgramTypes,
  SundaySchoolType,
} from '@my/app/types'

// Base record interface
interface BaseRecord {
  lastUpdated: string
  version: number
}

// Contact information structure
export interface ContactInfo {
  phone?: string
  address?: string
  emergencyContact?: string
  notes?: string
}

// ===== TABLE 1: tee-admin (EXISTING - Enhanced) =====

// Directory Record - Added to existing tee-admin table
export interface DirectoryRecord extends BaseRecord {
  PK: string // 'USER#{email}' - matches existing user pattern
  SK: string // 'DIRECTORY#{sheetId}' - new record type
  GSI1PK: string // 'ECCLESIA#{ecclesia}' - for ecclesia member queries
  GSI1SK: string // '{lastName}#{firstName}' - for name-based sorting
  email: string // Unique identifier linking to user profiles
  firstName: string
  lastName: string
  ecclesia: string // Name of the specific Christadelphian Church
  contactInfo: ContactInfo
  sheetId: string // Which sheet this directory record came from
}

// Member data combined from profile and directory
export interface MemberData {
  email: string
  firstName: string
  lastName: string
  ecclesia: string
  role?: string // From profile record
  contactInfo?: ContactInfo // From directory record
  profileExists: boolean
  directoryExists: boolean
}

// ===== TABLE 2: tee-schedules (NEW) =====

// Unified Schedule/Event Record - All time-based data
export interface ScheduleRecord extends BaseRecord {
  PK: string // 'SCHEDULE#{date}' OR 'EVENT#{eventId}' 
  SK: string // '{ecclesia}#{type}#{time}' OR 'DETAILS'
  GSI1PK?: string // 'ECCLESIA#{ecclesia}' - Optional for backward compatibility
  GSI1SK?: string // '{date}#{type}#{time}' - for ecclesia + date range queries
  GSI2PK?: string // 'TYPE#{type}' OR 'DATE#{date}' - Optional for backward compatibility
  GSI2SK?: string // '{date}#{time}' OR '{type}'
  
  // Common fields
  ecclesia: string
  date: string // ISO 8601 format
  type: 'memorial' | 'sundaySchool' | 'bibleClass' | 'cyc' | 'event'
  
  // Schedule-specific fields (for memorial, sundaySchool, etc.)
  data?: MemorialServiceType | SundaySchoolType | BibleClassType | CycType // Changed from scheduleData for consistency
  sheetId?: string // Source sheet for schedule data
  sheetType?: 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc' // For schedule records
  
  // Event-specific fields (for standalone events)
  eventId?: string
  title?: string
  time?: string
  description?: string
  details?: string // JSON string for complex Event data - changed from Record for Events
  
  // Enhanced fields for Events
  status?: string // EventStatus as string
  published?: boolean
  featured?: boolean
  createdBy?: string
  createdAt?: string // ISO string
  updatedAt?: string // ISO string
  publishDate?: string // ISO string
  hostingEcclesia?: string // Name of hosting ecclesia for Events
  
  // Search and metadata fields
  searchableContent?: string // Flattened text content for search
  tags?: string[] // Event tags for categorization
}

// Event data structure for new events
export interface EventData {
  title: string
  time: string
  description: string
  details: Record<string, string | string[]>
}

// Enhanced Event data structure for comprehensive events
export interface EventRecord extends BaseRecord {
  // DynamoDB keys
  PK: string // 'EVENT#{eventId}'
  SK: string // 'DETAILS'
  GSI1PK: string // 'ECCLESIA#{hostingEcclesiaName}' for filtering by ecclesia
  GSI1SK: string // '{date}#{type}#{time}' for date range queries
  GSI2PK: string // 'TYPE#{eventType}' or 'DATE#{date}' for type/date filtering  
  GSI2SK: string // '{date}#{time}' or '{type}' 
  
  // Basic event metadata for queries and filtering
  eventId: string
  title: string
  type: string // EventType as string for DynamoDB storage
  status: string // EventStatus as string
  published: boolean
  featured?: boolean
  date: string // Primary event date in ISO format
  time?: string // Event time (HH:MM)
  
  // Hosting organization for GSI queries
  hostingEcclesia?: string // Name of hosting ecclesia
  ecclesia: string // For compatibility with existing GSI patterns
  
  // Creator and timestamps
  createdBy: string
  createdAt: string // ISO string
  updatedAt: string // ISO string
  publishDate?: string // ISO string
  
  // Rich event data stored as JSON objects
  eventData: string // Serialized Event object (all the complex nested data)
  
  // Search and metadata fields (for future Elasticsearch integration)
  searchableContent?: string // Flattened text content for search
  tags?: string[] // Event tags for categorization
  
  // Legacy compatibility fields
  description?: string
  details?: Record<string, string | string[]>
}

// Sync Status Table - Track webhook processing and sync state
export interface SyncStatusRecord extends BaseRecord {
  PK: string // 'SYNC_STATUS#{sheetId}'
  SK: string // 'STATUS'
  sheetId: string
  sheetType: 'schedule' | 'directory' | 'events'
  lastSyncedAt: string
  lastWebhookAt: string
  syncVersion: string // Checksum or version of the sheet data
  syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  errorMessage?: string
}

// Query result types
export type ScheduleQueryResult = {
  items: ScheduleRecord[]
  lastEvaluatedKey?: Record<string, any>
}

export type DirectoryQueryResult = {
  items: DirectoryRecord[]
  lastEvaluatedKey?: Record<string, any>
}

export type EventQueryResult = {
  items: EventRecord[]
  lastEvaluatedKey?: Record<string, any>
}

// Migration and batch operation types
export interface MigrationResult {
  totalSheets: number
  successfulSheets: number
  failedSheets: number
  results: SheetMigrationResult[]
  errors: string[]
}

export interface SheetMigrationResult {
  sheetId: string
  sheetType: 'schedule' | 'directory' | 'events'
  recordsProcessed: number
  recordsSuccessful: number
  recordsFailed: number
  errors: string[]
  executionTime: number
}

// Batch operation types
export interface BatchWriteResult {
  successful: number
  failed: number
  errors: string[]
  unprocessedItems?: Record<string, any>[]
}

// Query parameters for common access patterns
export interface EcclesiaDateRangeQuery {
  ecclesia: string
  startDate: string
  endDate: string
  limit?: number
  lastEvaluatedKey?: Record<string, any>
}

export interface DateRangeQuery {
  startDate: string
  endDate: string
  limit?: number
  lastEvaluatedKey?: Record<string, any>
}

// Type guards
export function isScheduleRecord(record: any): record is ScheduleRecord {
  return record && record.PK && record.PK.startsWith('SCHEDULE#')
}

export function isDirectoryRecord(record: any): record is DirectoryRecord {
  return record && record.PK && record.PK.startsWith('DIRECTORY#')
}

export function isEventRecord(record: any): record is EventRecord {
  return record && record.PK && record.PK.startsWith('EVENT#')
}

export function isSyncStatusRecord(record: any): record is SyncStatusRecord {
  return record && record.PK && record.PK.startsWith('SYNC_STATUS#')
}