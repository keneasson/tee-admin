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

// ===== FAMILY/COMMUNITY CONTACT SYSTEM =====

// Visibility levels for privacy controls
export type VisibilityLevel =
  | 'authenticated'           // Anyone logged in can see
  | 'ecclesia_and_connections' // Same ecclesia OR people I've connected with
  | 'connections_only'        // Only people I've explicitly connected with
  | 'private'                 // Hidden - only "request callback" available

// Relationship types for family connections
export type RelationshipType =
  | 'spouse'
  | 'parent'
  | 'child'
  | 'sibling'
  | 'grandparent'
  | 'grandchild'
  | 'extended_family'
  | 'household_member'

// Relationship Records (bidirectional family links)
export interface RelationshipRecord extends BaseRecord {
  PK: string      // 'USER#{email}'
  SK: string      // 'RELATIONSHIP#{targetEmail}#{type}'
  sourceEmail: string
  targetEmail: string
  relationshipType: RelationshipType
  status: 'active' | 'pending' | 'removed'
  createdAt: string
}

// Address types
export type AddressType = 'home' | 'residence' | 'work' | 'mailing' | 'other'

// Address Records (multiple per user)
export interface AddressRecord extends BaseRecord {
  PK: string      // 'USER#{email}'
  SK: string      // 'ADDRESS#{addressId}'
  addressId: string
  type: AddressType
  isPrimary: boolean
  label?: string
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country: string
  isHousehold: boolean  // Shared with family
  householdId?: string
}

// Phone types
export type PhoneType = 'mobile' | 'home' | 'work' | 'other'

// Phone Records (personal vs household)
export interface PhoneRecord extends BaseRecord {
  PK: string      // 'USER#{email}'
  SK: string      // 'PHONE#{phoneId}'
  phoneId: string
  type: PhoneType
  number: string  // 10 digits only
  isPrimary: boolean
  isHousehold: boolean
  order: number   // For sorting/ordering
}

// Email Record (additional emails beyond primary login)
export interface EmailRecord extends BaseRecord {
  PK: string      // 'USER#{primaryEmail}'
  SK: string      // 'EMAIL#{emailId}'
  emailId: string
  email: string
  verified: boolean
  verificationToken?: string
  verificationTokenExpiry?: string
  verificationSentAt?: string
  subscribed?: boolean  // SES subscription status
  order: number   // For sorting/ordering
  isPrimary?: boolean  // True if this is the login email
}

// Privacy Settings Record
export interface PrivacySettingsRecord extends BaseRecord {
  PK: string      // 'USER#{email}'
  SK: string      // 'PRIVACY_SETTINGS'

  // Visibility controls (per field)
  showName: VisibilityLevel       // Usually 'authenticated' or 'ecclesia_and_connections'
  showPhone: VisibilityLevel
  showAddress: VisibilityLevel
  showEmail: VisibilityLevel
  showFamily: VisibilityLevel     // Who can see family relationships

  // Contact preferences
  allowContactRequests: boolean   // Allow "call me back" requests
  preferredContactMethod: 'email' | 'phone' | 'either'
}

// Connection status
export type ConnectionStatus = 'active' | 'pending' | 'blocked'

// Connection Records (for "connections_only" visibility)
// Note: Connections are one-way (I can share MY info with you)
// Different from Relationships which are bidirectional family links
export interface ConnectionRecord extends BaseRecord {
  PK: string      // 'USER#{email}'
  SK: string      // 'CONNECTION#{targetEmail}'
  targetEmail: string
  status: ConnectionStatus
  createdAt: string
}

// Contact request types
export type ContactRequestType = 'callback' | 'email_me'
export type ContactRequestStatus = 'pending' | 'viewed' | 'responded' | 'declined'

// Contact Request Records
export interface ContactRequestRecord extends BaseRecord {
  PK: string      // 'USER#{recipientEmail}'
  SK: string      // 'CONTACT_REQUEST#{requestId}'
  requestId: string
  requesterEmail: string
  recipientEmail: string
  requestType: ContactRequestType
  message?: string
  status: ContactRequestStatus
  createdAt: string
}

// Edit request field types
export type EditRequestField = 'email' | 'phone' | 'address' | 'name'
export type EditRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired'

// Edit Request Records - For suggesting edits to someone else's profile
export interface EditRequestRecord extends BaseRecord {
  PK: string      // 'USER#{targetEmail}' - the person whose data would change
  SK: string      // 'EDIT_REQUEST#{requestId}'
  requestId: string
  requesterEmail: string    // Who suggested the edit
  requesterName?: string    // Name of requester for email
  targetEmail: string       // Whose profile is being edited
  field: EditRequestField   // Which field is being changed
  currentValue?: string     // Current value (for reference)
  suggestedValue: string    // The proposed new value
  message?: string          // Optional note from requester
  status: EditRequestStatus
  approvalToken?: string    // Token for email-based approval
  tokenExpiry?: string      // When the approval token expires
  createdAt: string
  respondedAt?: string      // When owner approved/rejected
}

// Query result types for new record types
export type RelationshipQueryResult = {
  items: RelationshipRecord[]
  lastEvaluatedKey?: Record<string, any>
}

export type AddressQueryResult = {
  items: AddressRecord[]
  lastEvaluatedKey?: Record<string, any>
}

export type PhoneQueryResult = {
  items: PhoneRecord[]
  lastEvaluatedKey?: Record<string, any>
}

export type ConnectionQueryResult = {
  items: ConnectionRecord[]
  lastEvaluatedKey?: Record<string, any>
}

export type ContactRequestQueryResult = {
  items: ContactRequestRecord[]
  lastEvaluatedKey?: Record<string, any>
}

// Type guards for new record types
export function isRelationshipRecord(record: any): record is RelationshipRecord {
  return record && record.PK && record.SK && record.SK.startsWith('RELATIONSHIP#')
}

export function isAddressRecord(record: any): record is AddressRecord {
  return record && record.PK && record.SK && record.SK.startsWith('ADDRESS#')
}

export function isPhoneRecord(record: any): record is PhoneRecord {
  return record && record.PK && record.SK && record.SK.startsWith('PHONE#')
}

export function isPrivacySettingsRecord(record: any): record is PrivacySettingsRecord {
  return record && record.PK && record.SK === 'PRIVACY_SETTINGS'
}

export function isConnectionRecord(record: any): record is ConnectionRecord {
  return record && record.PK && record.SK && record.SK.startsWith('CONNECTION#')
}

export function isContactRequestRecord(record: any): record is ContactRequestRecord {
  return record && record.PK && record.SK && record.SK.startsWith('CONTACT_REQUEST#')
}

// ===== UNIFIED PEOPLE SYSTEM =====
// UUID-based person identity replacing email-based USER# records

// Member status in the ecclesia
export type MemberStatus = 'member' | 'visitor' | 'friend' | 'former'

// Person Record - Core identity with UUID
// PK: PERSON#{personId}, SK: PROFILE
export interface PersonRecord extends BaseRecord {
  pkey: string           // PERSON#{personId}
  skey: string           // PROFILE
  gsi1pk: string         // EMAIL#{primaryEmail} - for email lookups
  gsi1sk: string         // PERSON
  gsi2pk: string         // ECCLESIA#{ecclesia} - for directory browsing
  gsi2sk: string         // {lastName}#{firstName}#{personId} - for name sorting
  gsi3pk: string         // NAME#{lastName} - for name search
  gsi3sk: string         // {firstName}#{personId}

  personId: string       // UUID - stable identity
  primaryEmail: string
  firstName: string
  lastName: string
  displayName: string    // "{firstName} {lastName}"
  ecclesia: string
  memberStatus: MemberStatus

  // Inter-ecclesia communications
  isInterEcclesiaRep?: boolean  // Flag: receives inter-ecclesia emails for their ecclesia
  isRecordingBrother?: boolean  // Flag: primary contact (Recording Brother) for their ecclesia

  // Auth link (if registered user)
  userId?: string        // Links to existing USER#{email} auth record
  role?: 'owner' | 'admin' | 'member' | 'guest'
  provider?: 'google' | 'credentials'

  createdAt: string
}

// Person Email Record - Multiple emails per person
// PK: PERSON#{personId}, SK: EMAIL#{emailId}
export interface PersonEmailRecord extends BaseRecord {
  pkey: string           // PERSON#{personId}
  skey: string           // EMAIL#{emailId}
  gsi1pk: string         // EMAIL#{email} - for lookups by any email
  gsi1sk: string         // PERSON#{personId}

  emailId: string
  email: string
  emailType: 'primary' | 'secondary' | 'archived'
  order: number
  verified: boolean

  // SES integration
  sesSubscribed: boolean
  sesStatus: 'active' | 'bounced' | 'complained' | 'unsubscribed'
  sesTopicPreferences?: Record<string, boolean>
  sesLastSynced?: string
}

// Person Address Record - Using personId instead of email
// PK: PERSON#{personId}, SK: ADDRESS#{addressId}
export interface PersonAddressRecord extends BaseRecord {
  pkey: string           // PERSON#{personId}
  skey: string           // ADDRESS#{addressId}
  addressId: string
  type: AddressType
  isPrimary: boolean
  label?: string
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country: string
  isHousehold: boolean
  householdId?: string
}

// Person Phone Record - Using personId instead of email
// PK: PERSON#{personId}, SK: PHONE#{phoneId}
export interface PersonPhoneRecord extends BaseRecord {
  pkey: string           // PERSON#{personId}
  skey: string           // PHONE#{phoneId}
  phoneId: string
  type: PhoneType
  number: string
  isPrimary: boolean
  isHousehold: boolean
  order: number
}

// Privacy tiers for viewing data
export type PrivacyTier = 'self' | 'connected' | 'same_ecclesia' | 'authenticated' | 'private'

// Query result types for Person records
export type PersonQueryResult = {
  items: PersonRecord[]
  lastEvaluatedKey?: Record<string, any>
}

// Type guards for Person records
export function isPersonRecord(record: any): record is PersonRecord {
  return record && record.pkey && record.pkey.startsWith('PERSON#') && record.skey === 'PROFILE'
}

export function isPersonEmailRecord(record: any): record is PersonEmailRecord {
  return record && record.pkey && record.pkey.startsWith('PERSON#') && record.skey?.startsWith('EMAIL#')
}

export function isPersonAddressRecord(record: any): record is PersonAddressRecord {
  return record && record.pkey && record.pkey.startsWith('PERSON#') && record.skey?.startsWith('ADDRESS#')
}

export function isPersonPhoneRecord(record: any): record is PersonPhoneRecord {
  return record && record.pkey && record.pkey.startsWith('PERSON#') && record.skey?.startsWith('PHONE#')
}