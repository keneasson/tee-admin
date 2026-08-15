#!/usr/bin/env tsx
/**
 * Backfill: seed the 7 Toronto East mailing lists into the in-house registry and
 * migrate existing SES topic opt-ins (PersonEmailRecord.sesTopicPreferences) into
 * ListSubscriptionRecord items.
 *
 * SAFETY
 *  - DRY-RUN by default. Pass `--apply` to actually write.
 *  - IDEMPOTENT: skips lists that already exist (matched by ownerName + sesTopic)
 *    and subscriptions that already exist (matched by person#list#email).
 *  - ADDITIVE: never modifies or deletes any existing SES contact, topic list, or
 *    PersonEmailRecord.sesTopicPreferences. It only ADDS new registry items.
 *  - DO NOT run against prod as part of CI. The pure planning functions below are
 *    unit-tested against fixtures; only `runBackfill` touches AWS.
 *
 * Usage:
 *   tsx apps/next/scripts/backfill-mailing-lists.ts            # dry-run (counts only)
 *   tsx apps/next/scripts/backfill-mailing-lists.ts --apply    # perform writes
 */

import type { ConsentCategory, MailingListRecord } from '@my/app/provider/dynamodb/types'

// ---------------------------------------------------------------------------
// The 7 current SES topics (packages/app/types.ts EmailListTypes).
// ---------------------------------------------------------------------------
export type SeedTopic =
  | 'newsletter'
  | 'memorial'
  | 'bibleClass'
  | 'sundaySchool'
  | 'members'
  | 'interEcclesia'
  | 'testList'

export const SEED_TOPICS: SeedTopic[] = [
  'newsletter',
  'memorial',
  'bibleClass',
  'sundaySchool',
  'members',
  'interEcclesia',
  'testList',
]

// topic → consent category (per the backfill spec).
//   bibleClass + sundaySchool → reminders
//   newsletter + memorial     → newsletters
//   interEcclesia             → ecclesial_correspondence
//   members                   → operational
//   testList                  → operational (kept, not skipped, so the SES topic
//                               bridge stays complete for the internal test list)
export const SEED_CATEGORY_BY_TOPIC: Record<SeedTopic, ConsentCategory> = {
  bibleClass: 'reminders',
  sundaySchool: 'reminders',
  newsletter: 'newsletters',
  memorial: 'newsletters',
  interEcclesia: 'ecclesial_correspondence',
  members: 'operational',
  testList: 'operational',
}

// Toronto East owns all 7 seed lists, all ecclesia-scoped.
export const TORONTO_EAST = {
  ownerType: 'ecclesia' as const,
  ownerName: 'Toronto East Ecclesia',
  scope: 'ecclesia' as const,
  scopeValue: 'Toronto East Ecclesia',
}

export interface SeedListDef {
  key: SeedTopic
  sesTopic: SeedTopic
  category: ConsentCategory
  name: string
  description: string
}

const SEED_NAMES: Record<SeedTopic, { name: string; description: string }> = {
  newsletter: {
    name: 'Newsletter',
    description: 'Weekly Toronto East ecclesial newsletter.',
  },
  memorial: {
    name: 'Memorial Service Recap',
    description: 'Recap sent after the Sunday memorial service.',
  },
  bibleClass: {
    name: 'Bible Class Reminders',
    description: 'Reminders for the weekly Bible class.',
  },
  sundaySchool: {
    name: 'Sunday School Reminders',
    description: 'Reminders for Sunday school.',
  },
  members: {
    name: 'Members Announcements',
    description: 'Operational announcements for Toronto East members.',
  },
  interEcclesia: {
    name: 'Inter-Ecclesial Correspondence',
    description: 'Correspondence circulated between ecclesias.',
  },
  testList: {
    name: 'Test List',
    description: 'Internal test-send list (operational, not member-facing).',
  },
}

/** The 7 seed list definitions, in a stable order. */
export function buildSeedListDefs(): SeedListDef[] {
  return SEED_TOPICS.map((topic) => ({
    key: topic,
    sesTopic: topic,
    category: SEED_CATEGORY_BY_TOPIC[topic],
    name: SEED_NAMES[topic].name,
    description: SEED_NAMES[topic].description,
  }))
}

// ---------------------------------------------------------------------------
// Pure planning (no AWS) — unit-tested against fixtures.
// ---------------------------------------------------------------------------

/**
 * Decide which of the 7 seed lists still need creating. A list is considered to
 * already exist when a Toronto-East-owned record shares its sesTopic (idempotent
 * across re-runs even though listIds are random uuids).
 */
export function planSeedLists(existingLists: Pick<MailingListRecord, 'ownerName' | 'sesTopic'>[]): {
  toSeed: SeedListDef[]
  skipped: SeedListDef[]
} {
  const existingTopics = new Set(
    existingLists
      .filter((l) => l.ownerName === TORONTO_EAST.ownerName && l.sesTopic)
      .map((l) => l.sesTopic as string)
  )
  const defs = buildSeedListDefs()
  return {
    toSeed: defs.filter((d) => !existingTopics.has(d.sesTopic)),
    skipped: defs.filter((d) => existingTopics.has(d.sesTopic)),
  }
}

/** Minimal shape of an EMAIL# item this backfill reads. */
export interface EmailItemForBackfill {
  pkey: string // PERSON#{personId}
  emailId: string
  email: string
  sesTopicPreferences?: Record<string, boolean>
}

export interface PlannedSubscription {
  personId: string
  listId: string
  emailId: string
  email: string
  topic: string
}

export interface SubscriptionPlan {
  toCreate: PlannedSubscription[]
  anomalies: {
    /** topic → count of true-prefs that had no matching seeded list */
    topicsWithNoList: Record<string, number>
    /** EMAIL# items whose pkey was not a PERSON# key */
    emailsWithNoPerson: Array<{ pkey: string; email: string }>
    /** subscriptions skipped because they already exist */
    alreadyExists: number
  }
}

/**
 * Turn EMAIL# items into the ListSubscriptionRecords to create. For every
 * `sesTopicPreferences[topic] === true`, emit an opt_in for the Toronto-East list
 * whose topic matches. Idempotent via `existingSubKeys` (`personId#listId#emailId`).
 */
export function planSubscriptions(input: {
  emailItems: EmailItemForBackfill[]
  listIdByTopic: Map<string, string>
  existingSubKeys?: Set<string>
}): SubscriptionPlan {
  const existing = input.existingSubKeys ?? new Set<string>()
  const toCreate: PlannedSubscription[] = []
  const topicsWithNoList: Record<string, number> = {}
  const emailsWithNoPerson: Array<{ pkey: string; email: string }> = []
  let alreadyExists = 0

  for (const item of input.emailItems) {
    if (!item.pkey?.startsWith('PERSON#')) {
      emailsWithNoPerson.push({ pkey: item.pkey, email: item.email })
      continue
    }
    const personId = item.pkey.slice('PERSON#'.length)
    const prefs = item.sesTopicPreferences || {}

    for (const [topic, on] of Object.entries(prefs)) {
      if (on !== true) continue
      const listId = input.listIdByTopic.get(topic)
      if (!listId) {
        topicsWithNoList[topic] = (topicsWithNoList[topic] || 0) + 1
        continue
      }
      const key = `${personId}#${listId}#${item.emailId}`
      if (existing.has(key)) {
        alreadyExists++
        continue
      }
      toCreate.push({
        personId,
        listId,
        emailId: item.emailId,
        email: item.email,
        topic,
      })
    }
  }

  return { toCreate, anomalies: { topicsWithNoList, emailsWithNoPerson, alreadyExists } }
}

// ---------------------------------------------------------------------------
// I/O — only reached from a direct `--apply`/dry-run invocation, never in tests.
// ---------------------------------------------------------------------------

async function runBackfill(opts: { apply: boolean }): Promise<void> {
  // Imported lazily so importing this module for its pure helpers (in tests)
  // never constructs the DynamoDB client.
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient, tableNames } = await import('@my/app/provider/dynamodb/config')
  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )
  const { isListSubscriptionRecord } = await import('@my/app/provider/dynamodb/types')

  const mode = opts.apply ? 'APPLY' : 'DRY-RUN'
  console.log(`\n=== Mailing-list backfill (${mode}) ===\n`)

  // 1) Seed the 7 Toronto East lists ---------------------------------------
  const existingLists = await mailingListRepository.listByTenant(
    TORONTO_EAST.ownerType,
    TORONTO_EAST.ownerName
  )
  const { toSeed, skipped } = planSeedLists(existingLists)

  const listIdByTopic = new Map<string, string>()
  for (const l of existingLists) {
    if (l.sesTopic) listIdByTopic.set(l.sesTopic, l.listId)
  }

  console.log(`Lists: ${toSeed.length} to seed, ${skipped.length} already present.`)
  for (const def of toSeed) {
    if (opts.apply) {
      const created = await mailingListRepository.createList({
        ...TORONTO_EAST,
        category: def.category,
        key: def.key,
        name: def.name,
        description: def.description,
        defaultOptIn: false,
        sesTopic: def.sesTopic,
      })
      listIdByTopic.set(def.sesTopic, created.listId)
      console.log(`  + seeded "${def.name}" (${def.category}) → ${created.listId}`)
    } else {
      console.log(`  · would seed "${def.name}" (${def.category}, topic=${def.sesTopic})`)
    }
  }

  // 2) Scan EMAIL# items + existing SUB# items -----------------------------
  const emailItems: EmailItemForBackfill[] = []
  const existingSubKeys = new Set<string>()
  let lastKey: Record<string, any> | undefined
  do {
    const res = await docClient.send(
      new ScanCommand({
        TableName: tableNames.admin,
        FilterExpression: 'begins_with(skey, :email) OR begins_with(skey, :sub)',
        ExpressionAttributeValues: { ':email': 'EMAIL#', ':sub': 'SUB#' },
        ExclusiveStartKey: lastKey,
      })
    )
    for (const item of res.Items || []) {
      if ((item.skey as string)?.startsWith('EMAIL#')) {
        emailItems.push({
          pkey: item.pkey,
          emailId: item.emailId,
          email: item.email,
          sesTopicPreferences: item.sesTopicPreferences,
        })
      } else if (isListSubscriptionRecord(item)) {
        const pid = (item.pkey as string).slice('PERSON#'.length)
        existingSubKeys.add(`${pid}#${item.listId}#${item.emailId}`)
      }
    }
    lastKey = res.LastEvaluatedKey
  } while (lastKey)

  // 3) Plan + (optionally) write subscriptions -----------------------------
  const plan = planSubscriptions({ emailItems, listIdByTopic, existingSubKeys })

  console.log(
    `\nSubscriptions: ${plan.toCreate.length} to create, ${plan.anomalies.alreadyExists} already present.`
  )
  console.log(`Scanned ${emailItems.length} EMAIL# items.`)
  const noList = Object.entries(plan.anomalies.topicsWithNoList)
  if (noList.length > 0) {
    console.log('  Anomaly — opt-ins for topics with no matching list:')
    for (const [topic, n] of noList) console.log(`    ${topic}: ${n}`)
  }
  if (plan.anomalies.emailsWithNoPerson.length > 0) {
    console.log(`  Anomaly — ${plan.anomalies.emailsWithNoPerson.length} EMAIL# item(s) with no PERSON# owner.`)
  }

  if (opts.apply) {
    let created = 0
    for (const sub of plan.toCreate) {
      await mailingListRepository.subscribe({
        personId: sub.personId,
        listId: sub.listId,
        emailId: sub.emailId,
        email: sub.email,
        source: 'migration',
        basis: 'migrated',
      })
      created++
    }
    console.log(`\n  + created ${created} subscription(s).`)
  } else {
    console.log('\n(DRY-RUN — no writes performed. Re-run with --apply to write.)')
  }

  console.log('\n=== Done ===\n')
}

// Only run when executed directly (not when imported by a test).
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  /backfill-mailing-lists\.ts$/.test(process.argv[1] || '')

if (invokedDirectly) {
  runBackfill({ apply: process.argv.includes('--apply') }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
