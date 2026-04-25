/**
 * Migration Script: Schedule DateTime Migration
 *
 * Adds dateTime and sourceTimezone fields to existing schedule records.
 * This ensures timezone-aware date/time handling for all schedule data.
 *
 * The dateTime field stores the full ISO datetime in UTC, computed from:
 * - The existing date field (YYYY-MM-DD)
 * - The service time from SERVICE_TIMES config
 * - The service timezone (America/Toronto)
 *
 * Usage:
 *   npx tsx scripts/migrate-schedule-datetimes.ts --dry-run
 *   npx tsx scripts/migrate-schedule-datetimes.ts --execute
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

// Configuration
const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')
const FORCE_UPDATE = process.argv.includes('--force')
const DEFAULT_TIMEZONE = 'America/Toronto'

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_SCHEDULES_TABLE = 'tee-schedules'

// Service times configuration (must match packages/app/config/schedule-times.ts)
const SERVICE_TIMES: Record<
  string,
  {
    name: string
    defaultTime: string // 24-hour format HH:mm
    expectedDayOfWeek: number
    timezone: string
  }
> = {
  MEMORIAL: {
    name: 'Memorial Service',
    defaultTime: '11:00',
    expectedDayOfWeek: 0, // Sunday
    timezone: 'America/Toronto',
  },
  SUNDAYSCHOOL: {
    name: 'Sunday School',
    defaultTime: '09:30',
    expectedDayOfWeek: 0, // Sunday
    timezone: 'America/Toronto',
  },
  BIBLECLASS: {
    name: 'Bible Class',
    defaultTime: '19:30',
    expectedDayOfWeek: 3, // Wednesday
    timezone: 'America/Toronto',
  },
  CYC: {
    name: 'CYC',
    defaultTime: '18:30',
    expectedDayOfWeek: 6, // Saturday
    timezone: 'America/Toronto',
  },
}

// Stats
const stats = {
  recordsScanned: 0,
  recordsUpdated: 0,
  recordsSkipped: 0,
  recordsAlreadyMigrated: 0,
  dayOfWeekWarnings: 0,
  errors: [] as string[],
  byType: {} as Record<string, { updated: number; skipped: number }>,
}

interface ScheduleRecord {
  PK: string // SCHEDULE#MEMORIAL, SCHEDULE#BIBLECLASS, etc.
  SK: string // DATE#2025-01-02T00:30:00.000Z#0
  date: string
  sheetType?: string
  dateTime?: string
  sourceTimezone?: string
  [key: string]: unknown
}

/**
 * Get schedule type from PK
 * PK format: SCHEDULE#MEMORIAL, SCHEDULE#BIBLECLASS, etc.
 */
function getScheduleTypeFromPK(pk: string): string | null {
  if (!pk.startsWith('SCHEDULE#')) return null
  return pk.replace('SCHEDULE#', '')
}

/**
 * Combine date with service time to get UTC datetime
 * Uses the same algorithm as packages/app/config/schedule-times.ts
 */
function combineDateWithServiceTime(
  dateString: string,
  scheduleType: string
): { dateTime: string; sourceTimezone: string } | null {
  const config = SERVICE_TIMES[scheduleType]
  if (!config) {
    return null
  }

  try {
    const [hours, minutes] = config.defaultTime.split(':').map(Number)
    const [year, month, day] = dateString.split('-').map(Number)

    // Strategy: Create a reference date in UTC, then use Intl to find what time
    // in Toronto corresponds to that UTC time. The difference tells us the offset.

    // Create a UTC date at the target time (as if Toronto were UTC)
    const tentativeUtc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
    const tentativeDate = new Date(tentativeUtc)

    // Format this UTC time as if viewed in Toronto timezone
    const torontoFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    // Parse the Toronto-formatted time back
    const parts = torontoFormatter.formatToParts(tentativeDate)
    const torontoParts: Record<string, string> = {}
    for (const part of parts) {
      torontoParts[part.type] = part.value
    }

    const torontoHour = parseInt(torontoParts.hour || '0', 10)
    const torontoMinute = parseInt(torontoParts.minute || '0', 10)
    const torontoDay = parseInt(torontoParts.day || '1', 10)

    // Calculate how much we need to adjust
    let hourDiff = hours - torontoHour
    let dayDiff = day - torontoDay

    // Handle day boundary crossing
    if (dayDiff > 0) {
      hourDiff += 24
    } else if (dayDiff < 0) {
      hourDiff -= 24
    }

    const minuteDiff = minutes - torontoMinute
    const adjustmentMs = (hourDiff * 60 + minuteDiff) * 60 * 1000

    // Apply adjustment to get correct UTC time
    const correctUtc = new Date(tentativeUtc + adjustmentMs)

    return {
      dateTime: correctUtc.toISOString(),
      sourceTimezone: config.timezone,
    }
  } catch (error) {
    console.error(`Error computing dateTime for ${dateString}:`, error)
    return null
  }
}

/**
 * Validate that date falls on expected day of week
 */
function validateDayOfWeek(dateString: string, scheduleType: string): boolean {
  const config = SERVICE_TIMES[scheduleType]
  if (!config) return true // Skip validation for unknown types

  // CYC can vary, skip strict validation
  if (scheduleType === 'CYC') return true

  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const actualDay = date.getDay()

  if (actualDay !== config.expectedDayOfWeek) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    console.warn(
      `  Warning: ${config.name} on ${dateString} falls on ${dayNames[actualDay]}, expected ${dayNames[config.expectedDayOfWeek]}`
    )
    stats.dayOfWeekWarnings++
    return false
  }

  return true
}

async function scanScheduleRecords(): Promise<ScheduleRecord[]> {
  const records: ScheduleRecord[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const response = await docClient.send(
      new ScanCommand({
        TableName: TEE_SCHEDULES_TABLE,
        FilterExpression: 'begins_with(PK, :schedulePrefix)',
        ExpressionAttributeValues: {
          ':schedulePrefix': 'SCHEDULE#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    )

    if (response.Items) {
      records.push(...(response.Items as ScheduleRecord[]))
    }
    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return records
}

async function migrateRecord(record: ScheduleRecord): Promise<boolean> {
  const scheduleType = getScheduleTypeFromPK(record.PK)

  if (!scheduleType) {
    stats.recordsSkipped++
    return false
  }

  // Initialize type stats
  if (!stats.byType[scheduleType]) {
    stats.byType[scheduleType] = { updated: 0, skipped: 0 }
  }

  // Check if already migrated (skip unless --force)
  if (record.dateTime && record.sourceTimezone && !FORCE_UPDATE) {
    stats.recordsAlreadyMigrated++
    stats.byType[scheduleType].skipped++
    return false
  }

  // Check if we have a date to migrate
  if (!record.date) {
    console.warn(`  No date field for ${record.PK}/${record.SK}`)
    stats.recordsSkipped++
    stats.byType[scheduleType].skipped++
    return false
  }

  // Validate day of week
  validateDayOfWeek(record.date, scheduleType)

  // Compute dateTime and sourceTimezone
  const computed = combineDateWithServiceTime(record.date, scheduleType)

  if (!computed) {
    console.warn(`  Could not compute dateTime for ${record.PK}/${record.SK}`)
    stats.recordsSkipped++
    stats.byType[scheduleType].skipped++
    return false
  }

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] Would update ${record.PK}/${record.SK}: date=${record.date} -> dateTime=${computed.dateTime}`
    )
    stats.recordsUpdated++
    stats.byType[scheduleType].updated++
    return true
  }

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TEE_SCHEDULES_TABLE,
        Key: {
          PK: record.PK,
          SK: record.SK,
        },
        UpdateExpression: 'SET #dt = :dt, #tz = :tz',
        ExpressionAttributeNames: {
          '#dt': 'dateTime',
          '#tz': 'sourceTimezone',
        },
        ExpressionAttributeValues: {
          ':dt': computed.dateTime,
          ':tz': computed.sourceTimezone,
        },
      })
    )

    stats.recordsUpdated++
    stats.byType[scheduleType].updated++
    console.log(`Updated ${record.PK}/${record.SK}: dateTime=${computed.dateTime}`)
    return true
  } catch (error) {
    const errorMsg = `Failed to update ${record.PK}/${record.SK}: ${error}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
    return false
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Schedule DateTime Migration Script')
  console.log('='.repeat(60))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}`)
  console.log(`Force update: ${FORCE_UPDATE ? 'YES (re-migrating all records)' : 'NO (skipping already migrated)'}`)
  console.log(`Default timezone: ${DEFAULT_TIMEZONE}`)
  console.log()

  // Scan all schedule records
  console.log('Scanning schedule records...')
  const records = await scanScheduleRecords()
  stats.recordsScanned = records.length
  console.log(`Found ${records.length} total schedule records`)

  // Process records
  console.log('\nProcessing records...')
  for (const record of records) {
    await migrateRecord(record)
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary')
  console.log('='.repeat(60))
  console.log(`Records scanned: ${stats.recordsScanned}`)
  console.log(`Records updated: ${stats.recordsUpdated}`)
  console.log(`Records already migrated: ${stats.recordsAlreadyMigrated}`)
  console.log(`Records skipped: ${stats.recordsSkipped}`)
  console.log(`Day of week warnings: ${stats.dayOfWeekWarnings}`)

  console.log('\nBy schedule type:')
  for (const [type, typeStats] of Object.entries(stats.byType)) {
    console.log(`  ${type}: updated=${typeStats.updated}, skipped=${typeStats.skipped}`)
  }

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    stats.errors.forEach((e) => console.log(`  - ${e}`))
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes were made. Run with --execute to apply changes.')
  }
}

main().catch(console.error)
