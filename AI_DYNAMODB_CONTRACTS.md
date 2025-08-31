# DynamoDB Data Contracts - Single Source of Truth

> **CRITICAL**: This document defines ALL valid key patterns and data structures
> **RULE**: If it's not documented here, it doesn't exist in the database

## Table: `tee-admin`

### Entity: User
```typescript
// Primary Key Pattern
PK: `USER#${email}`
SK: `PROFILE`

// Data Structure
{
  PK: string,           // USER#user@example.com
  SK: string,           // PROFILE
  email: string,
  name: string,
  role: 'owner' | 'admin' | 'member' | 'guest',
  createdAt: string,    // ISO timestamp
  updatedAt: string,    // ISO timestamp
  lastLogin?: string,   // ISO timestamp
  emailVerified?: boolean,
  image?: string,       // Profile image URL
}

// Access Pattern
adminRepo.getUserByEmail(email: string)
```

### Entity: Invitation
```typescript
// Primary Key Pattern
PK: `INVITATION#${code}`
SK: `METADATA`

// Data Structure
{
  PK: string,           // INVITATION#ABC12345
  SK: string,           // METADATA
  code: string,         // 8 characters
  email: string,        // Invited email
  role: 'admin' | 'member' | 'guest',
  createdBy: string,    // Email of creator
  createdAt: string,    // ISO timestamp
  expiresAt: string,    // ISO timestamp (7 days)
  used: boolean,
  usedBy?: string,      // Email if used
  usedAt?: string,      // ISO timestamp if used
}

// Access Pattern
adminRepo.getInvitationByCode(code: string)
adminRepo.createInvitation(email: string, role: string)
```

## Table: `tee-schedules`

### Entity: Schedule Record
```typescript
// Primary Key Pattern
PK: `SCHEDULE#${sheetType.toUpperCase()}`
SK: `${date}#${id}`

// Valid sheetTypes
type SheetType = 'SUNDAYSCHOOL' | 'MEMORIAL' | 'CALENDAR' | 'DIRECTORY'

// Data Structure
{
  PK: string,           // SCHEDULE#SUNDAYSCHOOL
  SK: string,           // 2025-01-15#uuid
  id: string,           // UUID
  date: string,         // YYYY-MM-DD
  sheetId: string,      // Google Sheet ID
  sheetType: SheetType,
  
  // Type-specific fields
  // SUNDAYSCHOOL:
  time?: string,
  speaker?: string,
  topic?: string,
  readings?: string[],
  
  // MEMORIAL:
  presiding?: string,
  exhortation?: string,
  prayers?: string,
  music?: string,
  
  // CALENDAR:
  eventName?: string,
  startTime?: string,
  endTime?: string,
  location?: string,
  description?: string,
  
  // Metadata
  createdAt: string,    // ISO timestamp
  updatedAt: string,    // ISO timestamp
  syncedAt?: string,    // ISO timestamp
}

// Access Patterns
scheduleRepo.getSchedulesByType(sheetType: string)
scheduleRepo.getScheduleByDate(sheetType: string, date: string)
scheduleRepo.replaceSheetSchedules(sheetId: string, records: ScheduleRecord[])
```

### Entity: Directory Record
```typescript
// Primary Key Pattern
PK: `DIRECTORY#${sheetId}`
SK: `MEMBER#${email}`

// Data Structure
{
  PK: string,           // DIRECTORY#sheet-id-123
  SK: string,           // MEMBER#user@example.com
  email: string,
  firstName: string,
  lastName: string,
  phone?: string,
  address?: string,
  city?: string,
  postalCode?: string,
  memberType?: string,
  notes?: string,
  sheetId: string,
  createdAt: string,    // ISO timestamp
  updatedAt: string,    // ISO timestamp
  syncedAt?: string,    // ISO timestamp
}

// Access Patterns
adminRepo.getDirectoryMembers(sheetId: string)
adminRepo.replaceSheetDirectoryRecords(sheetId: string, records: DirectoryRecord[])
```

## Table: `tee-sync-status`

### Entity: Sync Status
```typescript
// Primary Key Pattern
PK: `SYNC#${sheetId}`
SK: `STATUS`

// Data Structure
{
  PK: string,           // SYNC#sheet-id-123
  SK: string,           // STATUS
  sheetId: string,
  sheetType: SheetType,
  lastSyncedAt: string, // ISO timestamp
  lastVersion: string,  // Version/checksum
  status: 'pending' | 'syncing' | 'completed' | 'failed',
  recordCount?: number,
  errors?: string[],
  executionTime?: number, // milliseconds
}

// Access Patterns
syncRepo.getSyncStatus(sheetId: string)
syncRepo.updateSyncStatus(sheetId: string, status: SyncStatus)
```

### Entity: Sync History
```typescript
// Primary Key Pattern
PK: `SYNC#${sheetId}`
SK: `HISTORY#${timestamp}`

// Data Structure
{
  PK: string,           // SYNC#sheet-id-123
  SK: string,           // HISTORY#2025-01-31T12:00:00Z
  sheetId: string,
  timestamp: string,    // ISO timestamp
  recordsProcessed: number,
  recordsSuccessful: number,
  recordsFailed: number,
  errors: string[],
  executionTime: number, // milliseconds
  triggeredBy: 'webhook' | 'manual' | 'cron',
}

// Access Patterns
syncRepo.addSyncHistory(sheetId: string, result: SyncResult)
syncRepo.getSyncHistory(sheetId: string, limit: number)
```

## 🚨 MIGRATION OPERATIONS

### Batch Write Pattern
```typescript
// ALWAYS use batch operations for multiple items
const batchWriteItems = records.map(record => ({
  PutRequest: {
    Item: {
      PK: `SCHEDULE#${sheetType}`,
      SK: `${record.date}#${record.id}`,
      ...record
    }
  }
}))

// Execute in chunks of 25 (DynamoDB limit)
```

### Replace Pattern (Delete + Insert)
```typescript
// 1. Query all existing records
const existing = await queryCommand({
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: { ':pk': `SCHEDULE#${sheetType}` }
})

// 2. Delete existing records
const deleteRequests = existing.Items.map(item => ({
  DeleteRequest: { Key: { PK: item.PK, SK: item.SK } }
}))

// 3. Insert new records
const putRequests = newRecords.map(record => ({
  PutRequest: { Item: transformedRecord }
}))

// 4. Execute in batches
```

## ❌ INVALID PATTERNS - WILL CAUSE FAILURES

```typescript
// WRONG - Missing uppercase
PK: `SCHEDULE#sunday_school` ❌

// WRONG - Wrong separator
PK: `SCHEDULE-SUNDAYSCHOOL` ❌

// WRONG - Missing date in SK
SK: `${id}` ❌

// WRONG - Direct table name in code
const table = 'tee-admin' ❌

// CORRECT - Use imported constant
import { tableNames } from '@my/app/provider/dynamodb/table-definitions'
const table = tableNames.admin ✅
```

## 🔄 Sheet ID to Type Mapping

```typescript
// From tee-services-db47a9e534d3.json
const SHEET_MAPPINGS = {
  '1rV3k6HW9eW_n7L1P0XxBw5DaYGMPL77M0mI4xOBkFWk': 'SUNDAYSCHOOL',
  '1XGCf9tnQWq5pXC8e4JFQB7wWpGO3-KIadC0uN5SaRAw': 'MEMORIAL',
  '1234567890': 'CALENDAR',  // Update with actual ID
  '0987654321': 'DIRECTORY', // Update with actual ID
}
```

---
**REMEMBER**: Every database operation MUST match these patterns EXACTLY!