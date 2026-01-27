/**
 * Migration Script: Event Timezone Migration
 *
 * Adds eventTimezone field to existing funeral events that don't have it.
 * Also renames viewingDate -> visitationDate for consistency.
 *
 * Usage:
 *   npx tsx scripts/migrate-event-timezones.ts --dry-run
 *   npx tsx scripts/migrate-event-timezones.ts --execute
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

// Configuration
const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')
const DEFAULT_TIMEZONE = 'America/Toronto'

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_SCHEDULES_TABLE = 'tee-schedules'

// Stats
const stats = {
  eventsScanned: 0,
  funeralEventsFound: 0,
  eventsUpdated: 0,
  eventsSkipped: 0,
  timezoneAdded: 0,
  viewingDateMigrated: 0,
  viewingLocationMigrated: 0,
  errors: [] as string[],
}

interface EventRecord {
  PK: string
  SK: string
  type?: string // Always "event" for EVENT# records
  eventType?: string // Actual event type: "funeral", "baptism", "wedding", etc.
  eventTimezone?: string
  viewingDate?: string
  visitationDate?: string
  details?: string // JSON string containing full event data
  locations?: {
    viewing?: Record<string, unknown>
    visitation?: Record<string, unknown>
    service?: Record<string, unknown>
    graveside?: Record<string, unknown>
  }
  [key: string]: unknown
}

async function scanEvents(): Promise<EventRecord[]> {
  const events: EventRecord[] = []
  let lastEvaluatedKey: Record<string, unknown> | undefined

  do {
    const response = await docClient.send(new ScanCommand({
      TableName: TEE_SCHEDULES_TABLE,
      FilterExpression: 'begins_with(PK, :eventPrefix)',
      ExpressionAttributeValues: {
        ':eventPrefix': 'EVENT#'
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }))

    if (response.Items) {
      events.push(...(response.Items as EventRecord[]))
    }
    lastEvaluatedKey = response.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return events
}

async function migrateEvent(event: EventRecord): Promise<boolean> {
  // Parse the details JSON to get full event data
  let eventDetails: Record<string, unknown> = {}
  if (event.details) {
    try {
      eventDetails = JSON.parse(event.details)
    } catch (e) {
      console.error(`Failed to parse details for ${event.PK}:`, e)
      stats.errors.push(`Failed to parse details for ${event.PK}`)
      return false
    }
  }

  const changes: string[] = []
  let modified = false

  // Check if timezone needs to be added
  if (!eventDetails.eventTimezone) {
    eventDetails.eventTimezone = DEFAULT_TIMEZONE
    changes.push('added eventTimezone')
    stats.timezoneAdded++
    modified = true
  }

  // Check if viewingDate needs to be migrated to visitationDate
  if (eventDetails.viewingDate && !eventDetails.visitationDate) {
    eventDetails.visitationDate = eventDetails.viewingDate
    delete eventDetails.viewingDate
    changes.push('renamed viewingDate -> visitationDate')
    stats.viewingDateMigrated++
    modified = true
  }

  // Check if locations.viewing needs to be migrated to locations.visitation
  const locations = eventDetails.locations as Record<string, unknown> | undefined
  if (locations?.viewing && !locations?.visitation) {
    locations.visitation = locations.viewing
    delete locations.viewing
    changes.push('renamed locations.viewing -> locations.visitation')
    stats.viewingLocationMigrated++
    modified = true
  }

  if (!modified) {
    stats.eventsSkipped++
    return false
  }

  if (DRY_RUN) {
    console.log(`[DRY-RUN] Would update ${event.PK} (${event.eventType}): ${changes.join(', ')}`)
    return true
  }

  try {
    // Update the details JSON and also set eventTimezone at the top level for indexing
    await docClient.send(new UpdateCommand({
      TableName: TEE_SCHEDULES_TABLE,
      Key: {
        PK: event.PK,
        SK: event.SK,
      },
      UpdateExpression: 'SET #details = :details, #tz = :tz',
      ExpressionAttributeNames: {
        '#details': 'details',
        '#tz': 'eventTimezone',
      },
      ExpressionAttributeValues: {
        ':details': JSON.stringify(eventDetails),
        ':tz': DEFAULT_TIMEZONE,
      },
    }))

    stats.eventsUpdated++
    console.log(`Updated ${event.PK}: ${changes.join(', ')}`)
    return true
  } catch (error) {
    const errorMsg = `Failed to update ${event.PK}: ${error}`
    console.error(errorMsg)
    stats.errors.push(errorMsg)
    return false
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('Event Timezone Migration Script')
  console.log('='.repeat(60))
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'EXECUTE (changes will be applied)'}`)
  console.log(`Default timezone: ${DEFAULT_TIMEZONE}`)
  console.log()

  // Scan all events
  console.log('Scanning events...')
  const events = await scanEvents()
  stats.eventsScanned = events.length
  console.log(`Found ${events.length} total events`)

  // Filter to funeral events (primary target, but update all events missing timezone)
  const funeralEvents = events.filter(e => e.eventType === 'funeral')
  stats.funeralEventsFound = funeralEvents.length
  console.log(`Found ${funeralEvents.length} funeral events`)

  // Process all events - migrateEvent will check if updates are needed
  console.log('\nProcessing events...')
  for (const event of events) {
    await migrateEvent(event)
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary')
  console.log('='.repeat(60))
  console.log(`Events scanned: ${stats.eventsScanned}`)
  console.log(`Funeral events found: ${stats.funeralEventsFound}`)
  console.log(`Events updated: ${stats.eventsUpdated}`)
  console.log(`Events skipped (no changes needed): ${stats.eventsSkipped}`)
  console.log(`\nChanges:`)
  console.log(`  - eventTimezone added: ${stats.timezoneAdded}`)
  console.log(`  - viewingDate -> visitationDate: ${stats.viewingDateMigrated}`)
  console.log(`  - locations.viewing -> locations.visitation: ${stats.viewingLocationMigrated}`)

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    stats.errors.forEach(e => console.log(`  - ${e}`))
  }

  if (DRY_RUN) {
    console.log('\n[DRY RUN] No changes were made. Run with --execute to apply changes.')
  }
}

main().catch(console.error)
