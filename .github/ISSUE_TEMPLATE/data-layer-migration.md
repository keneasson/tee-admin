# Data Layer Migration: Google Sheets to DynamoDB

## 🎯 Objective

Migrate the data layer from Google Sheets API to DynamoDB to improve performance and reliability, while maintaining real-time synchronization through Google Sheets webhook triggers.

## 📋 Current State Analysis

### Current Data Sources (Google Sheets)
- **Schedules Data**: Memorial services, Sunday School, Bible Class, CYC programs
- **Newsletter Data**: Contact information, event details
- **Directory Data**: Member contacts and roles
- **Events Data**: Upcoming ecclesial events

### Current Performance Issues
- API rate limits on Google Sheets API
- Slow response times for schedule queries
- No offline capability
- Direct dependency on Google Sheets availability

## 🏗️ Proposed Architecture

### Phase 1: DynamoDB Schema Design

```typescript
// Schedules Table - Optimized for ecclesia + date range queries
interface ScheduleRecord {
  PK: string // 'SCHEDULE#{sheetId}'
  SK: string // 'EVENT#{date}#{type}'
  GSI1PK: string // 'ECCLESIA#{ecclesia}' 
  GSI1SK: string // '{date}#{type}' // Enables ecclesia + date range filtering
  GSI2PK: string // 'SCHEDULE_TYPE#{type}' 
  GSI2SK: string // '{date}' // Type-based date range queries
  sheetId: string
  ecclesia: string // Name of the specific Christadelphian Church
  eventType: 'memorial' | 'sundaySchool' | 'bibleClass' | 'cyc'
  date: string // ISO 8601 format for efficient range queries
  data: MemorialServiceType | SundaySchoolType | BibleClassType | CycType
  lastUpdated: string
  version: number
}

// Directory Table - Email-based member identification
interface DirectoryRecord {
  PK: string // 'DIRECTORY#{sheetId}'
  SK: string // 'MEMBER#{email}'
  GSI1PK: string // 'ECCLESIA#{ecclesia}'
  GSI1SK: string // '{lastName}#{firstName}'
  email: string // Unique identifier linking to user profiles
  firstName: string
  lastName: string
  ecclesia: string // Name of the specific Christadelphian Church
  contactInfo: ContactInfo
  lastUpdated: string
  version: number
}

// Events Table - Enhanced with flexible details structure
interface EventRecord {
  PK: string // 'EVENT#{sheetId}'
  SK: string // 'EVENT#{eventId}'
  GSI1PK: string // 'ECCLESIA#{ecclesia}'
  GSI1SK: string // '{date}#{time}' // Enables ecclesia + date range filtering
  GSI2PK: string // 'EVENT_DATE#{date}'
  GSI2SK: string // '{time}'
  eventId: string
  title: string
  ecclesia: string // Name of the specific Christadelphian Church
  date: string // ISO 8601 format for efficient range queries
  time: string
  description: string
  details: Record<string, string | string[]> // Flexible structure for speakers, topics, directions, etc.
  lastUpdated: string
  version: number
}
```

### Phase 2: Google Sheets Webhook Integration with Debouncing

```typescript
// Webhook endpoint: /api/sheets/webhook
interface SheetWebhookPayload {
  eventType: 'SHEET_CHANGED'
  sheetId: string
  range?: string
  changeType: 'INSERT' | 'UPDATE' | 'DELETE'
  timestamp: string
}

// Debounced sync service to handle rapid edits efficiently
class SheetSyncService {
  private pendingSyncs = new Map<string, NodeJS.Timeout>()
  private readonly DEBOUNCE_DELAY = 30000 // 30 seconds

  async handleWebhook(payload: SheetWebhookPayload): Promise<void> {
    // Clear existing timeout for this sheet
    if (this.pendingSyncs.has(payload.sheetId)) {
      clearTimeout(this.pendingSyncs.get(payload.sheetId)!)
    }
    
    // Set new debounced sync
    const timeout = setTimeout(async () => {
      await this.syncSheetToDynamoDB(payload.sheetId)
      this.pendingSyncs.delete(payload.sheetId)
    }, this.DEBOUNCE_DELAY)
    
    this.pendingSyncs.set(payload.sheetId, timeout)
  }

  async syncSheetToDynamoDB(sheetId: string): Promise<void>
  async validateAndTransformData(sheetData: any[]): Promise<ScheduleRecord[]>
  async batchWriteToDynamoDB(records: ScheduleRecord[]): Promise<void>
  async getDataVersion(sheetId: string): Promise<string> // Check if data actually changed
}
```

### Phase 3: API Layer Refactoring

```typescript
// New DynamoDB-based data providers optimized for ecclesia + date range queries
class DynamoScheduleProvider {
  // Primary access pattern: get schedules by ecclesia and date range
  async getSchedulesByEcclesiaAndDateRange(
    ecclesia: string, 
    startDate: string, 
    endDate: string
  ): Promise<ProgramTypes[]>
  
  async getSchedulesByType(type: ProgramTypeKeys): Promise<ProgramTypes[]>
  async getSchedulesByDateRange(start: string, end: string): Promise<ProgramTypes[]>
  async getLatestSchedules(): Promise<ProgramTypes[]>
}

class DynamoDirectoryProvider {
  // Email-based member lookup for user profile integration
  async getMemberByEmail(email: string): Promise<DirectoryMember | null>
  async getMembersByEcclesia(ecclesia: string): Promise<DirectoryMember[]>
  async searchMembers(query: string): Promise<DirectoryMember[]>
}

class DynamoEventsProvider {
  // Enhanced with flexible details structure
  async getEventsByEcclesiaAndDateRange(
    ecclesia: string, 
    startDate: string, 
    endDate: string
  ): Promise<EventRecord[]>
  
  async getEventDetails(eventId: string): Promise<Record<string, string | string[]>>
  async updateEventDetails(eventId: string, details: Record<string, string | string[]>): Promise<void>
}
```

## 🚀 Cost Optimization Strategy for Heavy Edits

### Debouncing Strategy
- **30-second debounce window**: Multiple edits within 30 seconds trigger only one sync
- **Version checking**: Compare sheet version/checksum before updating DynamoDB
- **Batch operations**: Use DynamoDB batch writes to minimize write units
- **Change detection**: Only update records that actually changed

### Google Sheets Webhook Behavior
Google Sheets webhooks provide:
- **Event notification only**: No actual data in webhook payload
- **Rapid fire events**: Multiple webhooks for batch operations
- **Range information**: Which cells/ranges were affected (sometimes)

### Cost-Saving Implementation
```typescript
class CostOptimizedSyncService {
  private readonly DEBOUNCE_DELAY = 30000 // 30 seconds
  private readonly MAX_BATCH_SIZE = 25 // DynamoDB batch write limit
  
  async handleWebhook(payload: SheetWebhookPayload): Promise<void> {
    // Debounce multiple rapid edits
    this.debounceSync(payload.sheetId)
  }
  
  private async syncWithVersionCheck(sheetId: string): Promise<void> {
    const currentVersion = await this.getSheetVersion(sheetId)
    const lastSyncedVersion = await this.getLastSyncedVersion(sheetId)
    
    if (currentVersion === lastSyncedVersion) {
      console.log(`No changes detected for ${sheetId}, skipping sync`)
      return
    }
    
    // Only sync if data actually changed
    await this.performOptimizedSync(sheetId)
  }
}
```

## 📝 Implementation Plan

### Phase 1: Foundation (Days 1-2)

- [ ] **DynamoDB Table Design**
  - [ ] Create schedule tables with ecclesia + date range GSI (GSI1: ECCLESIA#{ecclesia} / {date}#{type})
  - [ ] Create directory tables with email-based keys and ecclesia queries
  - [ ] Create events tables with flexible details structure and dual GSI indices
  - [ ] Set up DynamoDB local for development
  - [ ] Create CloudFormation/CDK templates for production

- [ ] **Data Access Layer**
  - [ ] Create DynamoDB client configuration
  - [ ] Implement repository pattern for each data type
  - [ ] Add comprehensive error handling and retries
  - [ ] Implement batch operations for performance
  - [ ] Add data validation and sanitization

### Phase 2: Synchronization Engine (Days 2-3)
- [ ] **Google Sheets Webhook Setup**
  - [ ] Register webhooks for each sheet in Google Apps Script
  - [ ] Create webhook verification and security
  - [ ] Implement webhook endpoint in Next.js API routes
  - [ ] Add webhook payload validation and parsing

- [ ] **Sync Service Implementation**
  - [ ] Create sheet-to-DynamoDB transformation logic with 30-second debouncing
  - [ ] Implement version checking to prevent unnecessary updates
  - [ ] Add conflict resolution for concurrent updates
  - [ ] Create manual sync triggers for admin users
  - [ ] Implement sync status monitoring and alerts
  - [ ] Add batch operations to minimize DynamoDB write units

### Phase 3: API Migration (Days 3-4)
- [ ] **Replace Google Sheets API Calls**
  - [ ] Update `getGoogleSheet()` to query DynamoDB
  - [ ] Update `getData()` to use new repository pattern
  - [ ] Migrate all schedule-related API endpoints
  - [ ] Migrate directory and events endpoints

- [ ] **Frontend Integration**
  - [ ] Update React hooks to use new API endpoints
  - [ ] Implement optimistic updates where appropriate
  - [ ] Add loading states and error boundaries
  - [ ] Update TypeScript types for new data structure

### Phase 4: Performance & Monitoring (Day 4-5)
- [ ] **Caching Strategy**
  - [ ] Implement Redis caching for frequently accessed data
  - [ ] Add cache invalidation on webhook updates
  - [ ] Implement stale-while-revalidate patterns
  - [ ] Add cache warming for critical data

- [ ] **Monitoring & Alerting**
  - [ ] Set up CloudWatch metrics for DynamoDB performance
  - [ ] Monitor webhook delivery success rates
  - [ ] Alert on sync failures or data inconsistencies
  - [ ] Create health check endpoints for sync status

### Phase 5: Initial Data Migration & Testing (Day 5)
- [ ] **Initial Data Transfer**
  - [ ] Create full data migration script from Google Sheets to DynamoDB
  - [ ] Implement data validation and integrity checks
  - [ ] Create progress tracking and error reporting
  - [ ] Test migration with production data volume
  - [ ] Verify data completeness and accuracy

- [ ] **Comprehensive Testing**
  - [ ] Unit tests for all repository classes
  - [ ] Integration tests for sync workflows
  - [ ] End-to-end tests for user-facing features
  - [ ] Performance testing with realistic data volumes
  - [ ] Webhook reliability testing

- [ ] **Complete Switchover Deployment**
  - [ ] Deploy to staging environment
  - [ ] Execute full data migration
  - [ ] Switch all API calls to DynamoDB
  - [ ] Monitor performance improvements
  - [ ] Rollback procedures and monitoring

## 🔧 Technical Implementation Details

### DynamoDB Configuration
```typescript
// dynamodb-config.ts
export const dynamoConfig = {
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  endpoint: process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : undefined,
}

export const tableNames = {
  schedules: `${process.env.STAGE}-tee-schedules`,
  directory: `${process.env.STAGE}-tee-directory`, 
  events: `${process.env.STAGE}-tee-events`,
  syncStatus: `${process.env.STAGE}-tee-sync-status`,
}
```

### Webhook Security
```typescript
// webhook-security.ts
export class WebhookSecurity {
  static validateSignature(payload: string, signature: string): boolean
  static rateLimitBySheet(sheetId: string): boolean
  static validateSheetAccess(sheetId: string, userId: string): boolean
}
```

### Data Transformation
```typescript
// sheet-transformer.ts
export class SheetTransformer {
  static transformScheduleData(sheetData: any[]): ScheduleRecord[]
  static transformDirectoryData(sheetData: any[]): DirectoryRecord[]
  static validateDataIntegrity(records: any[]): ValidationResult
}
```

### Initial Data Migration Service
```typescript
// initial-migration.ts
export class InitialDataMigrationService {
  async migrateAllSheets(): Promise<MigrationResult> {
    const sheets = await this.getAllConfiguredSheets()
    const results = []
    
    for (const sheet of sheets) {
      const result = await this.migrateSheet(sheet.id, sheet.type)
      results.push(result)
    }
    
    return this.compileMigrationReport(results)
  }
  
  async migrateSheet(sheetId: string, type: 'schedule' | 'directory' | 'events'): Promise<SheetMigrationResult> {
    // Full sheet migration with progress tracking
    const sheetData = await this.getFullSheetData(sheetId)
    const transformedData = await this.transformAndValidateData(sheetData, type)
    const migrationResult = await this.batchWriteToDynamoDB(transformedData)
    
    return {
      sheetId,
      type,
      recordsProcessed: sheetData.length,
      recordsSuccessful: migrationResult.successful,
      recordsFailed: migrationResult.failed,
      errors: migrationResult.errors
    }
  }
  
  // Keep for maintenance - full re-sync capability
  async performFullResync(sheetId: string): Promise<void> {
    console.log(`Performing full resync for sheet: ${sheetId}`)
    await this.clearExistingRecords(sheetId)
    await this.migrateSheet(sheetId, await this.getSheetType(sheetId))
  }
}
```

## 📊 Expected Performance Improvements

### Current (Google Sheets API)
- **Response Time**: 2-5 seconds for schedule queries
- **Rate Limits**: 300 requests per minute per project
- **Availability**: Dependent on Google Sheets uptime
- **Offline**: No offline capability

### Target (DynamoDB)
- **Response Time**: 50-200ms for schedule queries
- **Throughput**: 4,000 reads/writes per second (configurable)
- **Availability**: 99.99% SLA
- **Offline**: Cached data available during outages

## 🚧 Migration Risks & Mitigation

### Data Consistency Risks
- **Risk**: Data drift between Google Sheets and DynamoDB
- **Mitigation**: Implement checksum validation and maintain full re-sync capability

### Webhook Reliability
- **Risk**: Missed webhook deliveries
- **Mitigation**: Implement retry logic and fallback polling mechanisms

### Complete Switchover Risk
- **Risk**: Immediate performance impact if migration fails
- **Mitigation**: Comprehensive testing, rollback procedures, and full data validation before switchover

### Initial Migration Risk
- **Risk**: Incomplete or corrupted data during initial transfer
- **Mitigation**: Multi-stage validation, progress tracking, and ability to re-run migration

## 🔍 Acceptance Criteria

### Functional Requirements
- [ ] All existing Google Sheets data successfully migrated to DynamoDB
- [ ] Real-time synchronization working with <5 minute delay
- [ ] All existing API endpoints returning identical data structure
- [ ] No breaking changes to frontend components

### Performance Requirements
- [ ] 90th percentile response time < 200ms for schedule queries
- [ ] 99th percentile response time < 500ms for all queries
- [ ] Webhook processing time < 30 seconds for typical updates
- [ ] Zero data loss during normal operations

### Reliability Requirements
- [ ] 99.9% uptime for data access APIs
- [ ] Automatic recovery from failed sync operations
- [ ] Comprehensive error logging and alerting
- [ ] Graceful degradation when webhooks fail

## 📋 Definition of Done

- [ ] All code reviewed and approved
- [ ] Comprehensive test coverage (>90%)
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Monitoring and alerting configured
- [ ] Rollback procedures tested
- [ ] Production deployment successful
- [ ] Post-deployment validation complete

## 🏷️ Labels
`enhancement` `performance` `data-migration` `high-priority` `breaking-change`

## 🎯 Milestone
TEE Admin v2.0 - Performance & Scalability

---

**Estimated Effort**: 5 days
**Priority**: High
**Complexity**: High
**Impact**: High