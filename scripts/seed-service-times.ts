/**
 * Migration Script: Seed Service Times into Schedule Config
 *
 * Writes serviceTime data into each ecclesia's scheduleConfig, making the
 * schedule configuration the single source of truth for worship service
 * times (replacing the hardcoded schedule-times.ts values).
 *
 * For Toronto East (the primary ecclesia with real data), seeds the current
 * hardcoded values. For ecclesias with the deprecated services[] array,
 * auto-generates scheduleConfig entries.
 *
 * This script is idempotent — running it multiple times produces the same result.
 * It only ADDS serviceTime data; it never removes existing config.
 *
 * Usage:
 *   npx tsx scripts/seed-service-times.ts --dry-run
 *   npx tsx scripts/seed-service-times.ts --execute
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { SCHEDULE_TYPE_CATALOGUE, SCHEDULE_TYPE_KEYS, mergeWithCatalogue } from '../packages/app/config/schedule-fields'
import type { ScheduleTypeKey, ServiceTimeDef } from '../packages/app/config/schedule-fields'

const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')
const TABLE_NAME = 'tee-admin'

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

// Map deprecated ServiceType to ScheduleTypeKey
const SERVICE_TYPE_MAP: Record<string, ScheduleTypeKey> = {
  memorial: 'memorial',
  bible_class: 'bibleClass',
  sunday_school: 'sundaySchool',
  cyc: 'cyc',
}

// Day name to number mapping
const DAY_NAME_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

interface EcclesiaItem {
  pkey: string
  skey: string
  name: string
  scheduleConfig?: Record<string, any>
  services?: Array<{
    type: string
    name: string
    day?: string
    time?: string
    location?: string
  }>
}

async function getAllEcclesias(): Promise<EcclesiaItem[]> {
  const items: EcclesiaItem[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      FilterExpression: 'begins_with(gsi1pk, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'ECCLESIA#' },
      ExclusiveStartKey: lastKey,
    }))

    if (result.Items) {
      items.push(...(result.Items as EcclesiaItem[]))
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

function buildServiceTimeFromLegacy(service: { day?: string; time?: string; location?: string }, typeKey: ScheduleTypeKey): ServiceTimeDef {
  const catalogueDefault = SCHEDULE_TYPE_CATALOGUE[typeKey].serviceTime
  const dayOfWeek = service.day ? DAY_NAME_MAP[service.day.toLowerCase()] : undefined

  return {
    defaultTime: catalogueDefault.defaultTime, // Can't reliably parse freeform time strings
    displayTime: service.time || catalogueDefault.displayTime,
    expectedDayOfWeek: dayOfWeek ?? catalogueDefault.expectedDayOfWeek,
    timezone: catalogueDefault.timezone,
    location: service.location || catalogueDefault.location,
  }
}

async function seedEcclesia(ecclesia: EcclesiaItem): Promise<{ updated: boolean; reason: string }> {
  const merged = mergeWithCatalogue(ecclesia.scheduleConfig)
  let needsUpdate = false
  const updatedConfig = { ...merged }

  // Check each schedule type — if serviceTime is missing in saved config, add it
  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    const savedType = ecclesia.scheduleConfig?.[typeKey]

    if (savedType && !savedType.serviceTime) {
      // Has schedule config but no serviceTime — seed from catalogue
      needsUpdate = true
    }
  }

  // If ecclesia has legacy services[], use them to seed scheduleConfig
  if (ecclesia.services && ecclesia.services.length > 0) {
    for (const service of ecclesia.services) {
      const typeKey = SERVICE_TYPE_MAP[service.type]
      if (!typeKey) continue

      const savedType = ecclesia.scheduleConfig?.[typeKey]
      if (!savedType?.serviceTime) {
        updatedConfig[typeKey] = {
          ...updatedConfig[typeKey],
          enabled: true,
          label: service.name || updatedConfig[typeKey].label,
          serviceTime: buildServiceTimeFromLegacy(service, typeKey),
        }
        needsUpdate = true
      }
    }
  }

  if (!needsUpdate) {
    // Check if all enabled types already have serviceTime
    const allHaveServiceTime = SCHEDULE_TYPE_KEYS.every(typeKey => {
      const saved = ecclesia.scheduleConfig?.[typeKey]
      return !saved?.enabled || saved?.serviceTime
    })
    if (allHaveServiceTime) {
      return { updated: false, reason: 'already has serviceTime for all enabled types' }
    }
  }

  // Ensure serviceTime is set on every type (even disabled ones get catalogue defaults)
  for (const typeKey of SCHEDULE_TYPE_KEYS) {
    if (!updatedConfig[typeKey].serviceTime) {
      updatedConfig[typeKey].serviceTime = { ...SCHEDULE_TYPE_CATALOGUE[typeKey].serviceTime }
      needsUpdate = true
    }
  }

  if (!needsUpdate) {
    return { updated: false, reason: 'no changes needed' }
  }

  if (!DRY_RUN) {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pkey: ecclesia.pkey, skey: ecclesia.skey },
      UpdateExpression: 'SET scheduleConfig = :config, updatedAt = :now',
      ExpressionAttributeValues: {
        ':config': updatedConfig,
        ':now': new Date().toISOString(),
      },
    }))
  }

  return { updated: true, reason: 'seeded serviceTime' }
}

async function main() {
  console.log(`\n🔄 Seed Service Times Migration`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ EXECUTE'}`)
  console.log(`   Table: ${TABLE_NAME}\n`)

  const ecclesias = await getAllEcclesias()
  console.log(`Found ${ecclesias.length} ecclesias\n`)

  let updated = 0
  let skipped = 0

  for (const ecclesia of ecclesias) {
    const result = await seedEcclesia(ecclesia)
    const icon = result.updated ? '✅' : '⏭️'
    console.log(`${icon} ${ecclesia.name}: ${result.reason}`)

    if (result.updated) updated++
    else skipped++
  }

  console.log(`\n📊 Summary:`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Skipped: ${skipped}`)
  console.log(`   Total:   ${ecclesias.length}`)

  if (DRY_RUN && updated > 0) {
    console.log(`\n💡 Run with --execute to apply changes`)
  }
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
