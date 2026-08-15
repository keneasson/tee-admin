#!/usr/bin/env tsx
/**
 * Backfill: seed the 7 Toronto East mailing lists into the in-house registry and
 * migrate existing opt-ins into ListSubscriptionRecord items.
 *
 * SUBSCRIPTION SOURCE — SES, not PersonRecord.
 *  The canonical opt-in state lives in the SES `TEEAdmin` contact list, on each
 *  contact's per-topic `TopicPreferences`. The PersonRecord EMAIL# rows' mirror
 *  field `sesTopicPreferences` is EMPTY in prod (0 of ~192 EMAIL# items populated),
 *  so sourcing from it would migrate ZERO subscriptions and effectively unsubscribe
 *  everyone at cutover. This backfill therefore reads subscriptions from SES.
 *
 * SAFETY
 *  - DRY-RUN by default. Pass `--apply` to actually write.
 *  - IDEMPOTENT: skips lists that already exist (matched by ownerName + sesTopic)
 *    and subscriptions that already exist (matched by person#list#email).
 *  - ADDITIVE: never modifies or deletes any SES contact, topic list, or
 *    PersonRecord field. It only ADDS new registry items.
 *  - Only migrates OPT_IN topics. OPT_OUT topics are ignored (no row written).
 *  - Contacts whose email resolves to NO PersonRecord are NOT dropped: they are
 *    collected into `unresolvedSubscribers` and printed in the summary. This
 *    backfill NEVER creates person records — that is a separate decision.
 *  - DO NOT run against prod as part of CI. The pure planning functions below are
 *    unit-tested against fixtures; only `runBackfill` touches AWS.
 *
 * Usage:
 *   tsx apps/next/utils/mailing-lists/backfill-mailing-lists.ts            # dry-run (counts only)
 *   tsx apps/next/utils/mailing-lists/backfill-mailing-lists.ts --apply    # perform writes
 */

import type {
  ConsentCategory,
  MailingListRecord,
  PersonRecord,
} from '@my/app/provider/dynamodb/types'

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

/**
 * One SES contact, reduced to what the plan needs: its email and its per-topic
 * opt-in/opt-out preferences (as read from `get-contact` TopicPreferences).
 */
export interface SesContactForBackfill {
  email: string
  topicPreferences: Array<{ topic: string; status: 'OPT_IN' | 'OPT_OUT' }>
}

/**
 * The PersonRecord an SES contact email resolves to: the owning person plus the
 * specific EMAIL# row (its emailId) that carries the address.
 */
export interface ResolvedContact {
  personId: string
  emailId: string
  /** The matched EMAIL# row's stored address (may differ in case from the input). */
  email: string
}

/** Resolve an SES contact email → PersonRecord EMAIL# row, or null if unknown. */
export type ContactResolver = (email: string) => Promise<ResolvedContact | null>

export interface PlannedSubscription {
  personId: string
  listId: string
  emailId: string
  email: string
  topic: string
}

export interface SubscriptionPlan {
  toCreate: PlannedSubscription[]
  /** Total OPT_IN topic-rows read from SES contacts (the raw source signal). */
  subscriptionsFromSes: number
  /**
   * SES contacts with ≥1 OPT_IN topic whose email resolves to NO PersonRecord.
   * Reported, never dropped. NOT turned into person records here.
   */
  unresolvedSubscribers: Array<{ email: string; topics: string[] }>
  anomalies: {
    /** topic → count of OPT_INs (for a resolved contact) that had no matching seeded list */
    topicsWithNoList: Record<string, number>
    /** subscriptions skipped because they already exist */
    alreadyExists: number
  }
}

/**
 * Turn SES contacts into the ListSubscriptionRecords to create. For every contact
 * with at least one `OPT_IN` topic, resolve its email to a PersonRecord EMAIL# row
 * and emit one opt_in per OPT_IN topic against the Toronto-East list whose sesTopic
 * matches. Idempotent via `existingSubKeys` (`personId#listId#emailId`).
 *
 * Pure except for the injected `resolve` function (the only I/O), which tests mock.
 */
export async function planSubscriptions(input: {
  contacts: SesContactForBackfill[]
  listIdByTopic: Map<string, string>
  resolve: ContactResolver
  existingSubKeys?: Set<string>
}): Promise<SubscriptionPlan> {
  const existing = input.existingSubKeys ?? new Set<string>()
  const toCreate: PlannedSubscription[] = []
  const topicsWithNoList: Record<string, number> = {}
  const unresolvedSubscribers: Array<{ email: string; topics: string[] }> = []
  let subscriptionsFromSes = 0
  let alreadyExists = 0

  for (const contact of input.contacts) {
    const optInTopics = contact.topicPreferences
      .filter((p) => p.status === 'OPT_IN')
      .map((p) => p.topic)

    if (optInTopics.length === 0) continue // nothing to migrate for this contact
    subscriptionsFromSes += optInTopics.length

    const resolved = await input.resolve(contact.email)
    if (!resolved) {
      unresolvedSubscribers.push({ email: contact.email, topics: optInTopics })
      continue
    }

    for (const topic of optInTopics) {
      const listId = input.listIdByTopic.get(topic)
      if (!listId) {
        topicsWithNoList[topic] = (topicsWithNoList[topic] || 0) + 1
        continue
      }
      const key = `${resolved.personId}#${listId}#${resolved.emailId}`
      if (existing.has(key)) {
        alreadyExists++
        continue
      }
      toCreate.push({
        personId: resolved.personId,
        listId,
        emailId: resolved.emailId,
        email: resolved.email,
        topic,
      })
    }
  }

  return {
    toCreate,
    subscriptionsFromSes,
    unresolvedSubscribers,
    anomalies: { topicsWithNoList, alreadyExists },
  }
}

// ---------------------------------------------------------------------------
// I/O — only reached from a direct `--apply`/dry-run invocation, never in tests.
// ---------------------------------------------------------------------------

async function runBackfill(opts: { apply: boolean }): Promise<void> {
  // Imported lazily so importing this module for its pure helpers (in tests)
  // never constructs the DynamoDB / SES clients.
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient, tableNames } = await import('@my/app/provider/dynamodb/config')
  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )
  const { personRepository } = await import(
    '@my/app/provider/dynamodb/repositories/person-repository'
  )
  const { isListSubscriptionRecord } = await import('@my/app/provider/dynamodb/types')
  const { getContacts, getContact } = await import('../email/contact')

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

  // 2) Read the CANONICAL subscription state from SES ----------------------
  //    Page every opted-in contact in the TEEAdmin list, then `get-contact` each
  //    for its FULL per-topic TopicPreferences (ListContacts only returns a
  //    summary; the complete per-topic map comes from GetContact).
  const contacts: SesContactForBackfill[] = []
  let nextPageToken: string | undefined
  const contactEmails: string[] = []
  do {
    const page = await getContacts({ nextPageToken })
    for (const c of page.Contacts || []) {
      if (c.EmailAddress) contactEmails.push(c.EmailAddress)
    }
    nextPageToken = page.NextToken
  } while (nextPageToken)

  for (const email of contactEmails) {
    const full = await getContact(email)
    const topicPreferences = (full?.TopicPreferences || [])
      .filter((p) => p.TopicName && p.SubscriptionStatus)
      .map((p) => ({
        topic: p.TopicName as string,
        status: p.SubscriptionStatus as 'OPT_IN' | 'OPT_OUT',
      }))
    contacts.push({ email, topicPreferences })
  }

  // 3) Load existing SUB# items (for idempotent skips) ---------------------
  const existingSubKeys = new Set<string>()
  let lastKey: Record<string, any> | undefined
  do {
    const res = await docClient.send(
      new ScanCommand({
        TableName: tableNames.admin,
        FilterExpression: 'begins_with(skey, :sub)',
        ExpressionAttributeValues: { ':sub': 'SUB#' },
        ExclusiveStartKey: lastKey,
      })
    )
    for (const item of res.Items || []) {
      if (isListSubscriptionRecord(item)) {
        const pid = (item.pkey as string).slice('PERSON#'.length)
        existingSubKeys.add(`${pid}#${item.listId}#${item.emailId}`)
      }
    }
    lastKey = res.LastEvaluatedKey
  } while (lastKey)

  // 4) Resolve each SES contact email → PersonRecord EMAIL# row -------------
  const resolve: ContactResolver = async (email) => {
    const lower = email.toLowerCase()
    // getByEmail resolves both primary (PROFILE) and secondary (EMAIL#) addresses;
    // fall back to getAllPersonsByEmail per the spec for the shared-address case.
    let persons: PersonRecord[] = []
    const primary = await personRepository.getByEmail(lower)
    if (primary) {
      persons = [primary]
    } else {
      persons = await personRepository.getAllPersonsByEmail(lower)
    }
    for (const person of persons) {
      const emails = await personRepository.getEmails(person.personId)
      const row = emails.find((e) => e.email.toLowerCase() === lower)
      if (row) {
        return { personId: person.personId, emailId: row.emailId, email: row.email }
      }
    }
    return null
  }

  // 5) Plan + (optionally) write subscriptions -----------------------------
  const plan = await planSubscriptions({ contacts, listIdByTopic, resolve, existingSubKeys })

  console.log(
    `\nSubscriptions: ${plan.toCreate.length} to create, ${plan.anomalies.alreadyExists} already present.`
  )
  console.log(
    `Read ${contacts.length} SES contact(s); ${plan.subscriptionsFromSes} OPT_IN topic-row(s) sourced from SES.`
  )
  const noList = Object.entries(plan.anomalies.topicsWithNoList)
  if (noList.length > 0) {
    console.log('  Anomaly — OPT_INs for topics with no matching list:')
    for (const [topic, n] of noList) console.log(`    ${topic}: ${n}`)
  }
  if (plan.unresolvedSubscribers.length > 0) {
    console.log(
      `\n  ⚠ ${plan.unresolvedSubscribers.length} SES contact(s) with OPT_INs but NO PersonRecord (NOT migrated, NOT created):`
    )
    for (const u of plan.unresolvedSubscribers) {
      console.log(`    ${u.email} → [${u.topics.join(', ')}]`)
    }
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
