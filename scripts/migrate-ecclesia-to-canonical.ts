/**
 * Migration Script: Ecclesia Name Standardization
 *
 * Migrates all 'TEE' ecclesia values to the canonical name 'Toronto East Ecclesia'
 * in both the tee-schedules and tee-admin DynamoDB tables.
 *
 * This standardizes the ecclesia naming throughout the system while maintaining
 * backward compatibility via the isHomeEcclesia() helper in the config.
 *
 * Tables affected:
 * - tee-schedules: DIRECTORY#MEMBERS records (ecclesia field)
 * - tee-admin: PersonRecord records (ecclesia field in directoryData)
 *
 * Usage:
 *   npx tsx scripts/migrate-ecclesia-to-canonical.ts --dry-run
 *   npx tsx scripts/migrate-ecclesia-to-canonical.ts --execute
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

// Configuration
const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')
const CANONICAL_NAME = 'Toronto East Ecclesia'
const OLD_VALUES = ['TEE', 'tee', 'Toronto East Christadelphian Ecclesia']

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_SCHEDULES_TABLE = 'tee-schedules'
const TEE_ADMIN_TABLE = 'tee-admin'

// Stats
const stats = {
  directoryRecordsScanned: 0,
  directoryRecordsUpdated: 0,
  directoryRecordsSkipped: 0,
  adminRecordsScanned: 0,
  adminRecordsUpdated: 0,
  adminRecordsSkipped: 0,
  errors: [] as string[],
}

interface DirectoryRecord {
  PK: string
  SK: string
  firstName?: string
  lastName?: string
  email?: string
  ecclesia?: string
  [key: string]: unknown
}

interface AdminRecord {
  PK: string
  SK: string
  directoryData?: {
    ecclesia?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Check if the ecclesia value needs to be migrated
 */
function needsMigration(ecclesia: string | undefined): boolean {
  if (!ecclesia) return false
  return OLD_VALUES.some(oldVal => ecclesia.toLowerCase() === oldVal.toLowerCase())
}

/**
 * Query all directory members from tee-schedules
 */
async function queryDirectoryMembers(): Promise<DirectoryRecord[]> {
  const records: DirectoryRecord[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const response = await docClient.send(new QueryCommand({
      TableName: TEE_SCHEDULES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DIRECTORY#MEMBERS'
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }))

    if (response.Items) {
      records.push(...(response.Items as DirectoryRecord[]))
    }
    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return records
}

/**
 * Scan admin table for PersonRecords with ecclesia in directoryData
 */
async function scanAdminRecords(): Promise<AdminRecord[]> {
  const records: AdminRecord[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const response = await docClient.send(new ScanCommand({
      TableName: TEE_ADMIN_TABLE,
      FilterExpression: 'begins_with(PK, :personPrefix)',
      ExpressionAttributeValues: {
        ':personPrefix': 'PERSON#'
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }))

    if (response.Items) {
      records.push(...(response.Items as AdminRecord[]))
    }
    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return records
}

/**
 * Update a directory record's ecclesia field
 */
async function updateDirectoryRecord(record: DirectoryRecord): Promise<boolean> {
  if (!needsMigration(record.ecclesia)) {
    stats.directoryRecordsSkipped++
    return false
  }

  const oldValue = record.ecclesia

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would update directory ${record.SK}: "${oldValue}" -> "${CANONICAL_NAME}"`)
    stats.directoryRecordsUpdated++
    return true
  }

  try {
    await docClient.send(new UpdateCommand({
      TableName: TEE_SCHEDULES_TABLE,
      Key: {
        PK: record.PK,
        SK: record.SK,
      },
      UpdateExpression: 'SET ecclesia = :newEcclesia, lastUpdated = :lastUpdated',
      ExpressionAttributeValues: {
        ':newEcclesia': CANONICAL_NAME,
        ':lastUpdated': new Date().toISOString(),
      },
    }))

    stats.directoryRecordsUpdated++
    console.log(`Updated directory ${record.SK}: "${oldValue}" -> "${CANONICAL_NAME}"`)
    return true
  } catch (error) {
    const errorMsg = `Failed to update directory ${record.SK}: ${error}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
    return false
  }
}

/**
 * Update an admin record's directoryData.ecclesia field
 */
async function updateAdminRecord(record: AdminRecord): Promise<boolean> {
  const ecclesia = record.directoryData?.ecclesia
  if (!needsMigration(ecclesia)) {
    stats.adminRecordsSkipped++
    return false
  }

  const oldValue = ecclesia

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would update admin ${record.PK}: "${oldValue}" -> "${CANONICAL_NAME}"`)
    stats.adminRecordsUpdated++
    return true
  }

  try {
    // Update the directoryData.ecclesia field
    const updatedDirectoryData = {
      ...record.directoryData,
      ecclesia: CANONICAL_NAME,
    }

    await docClient.send(new UpdateCommand({
      TableName: TEE_ADMIN_TABLE,
      Key: {
        PK: record.PK,
        SK: record.SK,
      },
      UpdateExpression: 'SET directoryData = :directoryData, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':directoryData': updatedDirectoryData,
        ':updatedAt': new Date().toISOString(),
      },
    }))

    stats.adminRecordsUpdated++
    console.log(`Updated admin ${record.PK}: "${oldValue}" -> "${CANONICAL_NAME}"`)
    return true
  } catch (error) {
    const errorMsg = `Failed to update admin ${record.PK}: ${error}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
    return false
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('Ecclesia Name Standardization Migration Script')
  console.log('='.repeat(70))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}`)
  console.log(`Canonical name: "${CANONICAL_NAME}"`)
  console.log(`Old values to migrate: ${OLD_VALUES.map(v => `"${v}"`).join(', ')}`)
  console.log()

  // Phase 1: Migrate directory members in tee-schedules
  console.log('Phase 1: Migrating directory members (tee-schedules)...')
  console.log('-'.repeat(50))

  const directoryRecords = await queryDirectoryMembers()
  stats.directoryRecordsScanned = directoryRecords.length
  console.log(`Found ${directoryRecords.length} directory members`)

  // Count how many need migration
  const directoryNeedingMigration = directoryRecords.filter(r => needsMigration(r.ecclesia))
  console.log(`Records with old ecclesia values: ${directoryNeedingMigration.length}`)

  // Process directory records
  for (const record of directoryRecords) {
    await updateDirectoryRecord(record)
  }

  console.log()

  // Phase 2: Migrate person records in tee-admin
  console.log('Phase 2: Migrating person records (tee-admin)...')
  console.log('-'.repeat(50))

  const adminRecords = await scanAdminRecords()
  stats.adminRecordsScanned = adminRecords.length
  console.log(`Found ${adminRecords.length} person records`)

  // Count how many need migration
  const adminNeedingMigration = adminRecords.filter(r => needsMigration(r.directoryData?.ecclesia))
  console.log(`Records with old ecclesia values: ${adminNeedingMigration.length}`)

  // Process admin records
  for (const record of adminRecords) {
    await updateAdminRecord(record)
  }

  // Print summary
  console.log()
  console.log('='.repeat(70))
  console.log('Migration Summary')
  console.log('='.repeat(70))
  console.log()
  console.log('Directory Members (tee-schedules):')
  console.log(`  - Scanned: ${stats.directoryRecordsScanned}`)
  console.log(`  - Updated: ${stats.directoryRecordsUpdated}`)
  console.log(`  - Skipped (already canonical or no ecclesia): ${stats.directoryRecordsSkipped}`)
  console.log()
  console.log('Person Records (tee-admin):')
  console.log(`  - Scanned: ${stats.adminRecordsScanned}`)
  console.log(`  - Updated: ${stats.adminRecordsUpdated}`)
  console.log(`  - Skipped (already canonical or no ecclesia): ${stats.adminRecordsSkipped}`)
  console.log()
  console.log(`Total records updated: ${stats.directoryRecordsUpdated + stats.adminRecordsUpdated}`)

  if (stats.errors.length > 0) {
    console.log()
    console.log(`Errors (${stats.errors.length}):`)
    stats.errors.forEach(e => console.log(`  - ${e}`))
  }

  if (DRY_RUN) {
    console.log()
    console.log('[DRY RUN] No changes were made. Run with --execute to apply changes.')
  }
}

main().catch(console.error)
