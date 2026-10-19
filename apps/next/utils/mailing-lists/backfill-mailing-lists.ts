#!/usr/bin/env tsx
/**
 * Backfill (R5): seed Toronto East's 7 mailing lists into the registry, owned
 * by Toronto East's ECCLESIA ID, and copy every explicit SES opt-in into SUB#
 * rows so the registry can take over sends list by list.
 *
 * SOURCE OF SUBSCRIPTIONS — SES explicit OPT_IN only.
 *  Each contact's `TopicPreferences` (from get-contact) is the only signal. Topic
 *  DEFAULTS (`TopicDefaultPreferences`, e.g. newsletter defaults to OPT_IN) never
 *  count — sends never use them either. A contact with UnsubscribeAll contributes
 *  nothing (sends skip it today).
 *
 * ADDRESSES
 *  - Lower-cased. Contacts that differ only by letter case are merged: the
 *    address gets the union of their opt-ins.
 *  - An opted-in address that no PersonRecord holds gets a minimal
 *    subscriber-only PersonRecord (email only, no name, memberStatus 'friend',
 *    source 'mailing-list-backfill') through personRepository, so nobody
 *    silently loses mail at cutover.
 *
 * SAFETY
 *  - DRY RUN by default; prints counts only (no addresses, no names).
 *  - `--apply` first backs up, to s3://tee-admin-backups/backups/<date>-mailing-list-backfill/:
 *    every PERSON# and LIST# item, every SES contact with TopicPreferences +
 *    AttributesData, the SES topic list, and the account suppression list. No
 *    write happens unless every backup is uploaded and verified.
 *  - IDEMPOTENT: lists matched by (owner id, sesTopic); subscriptions matched by
 *    (list, address) INCLUDING opt_out rows — a re-run never re-subscribes
 *    someone who opted out in the registry.
 *  - READ-ONLY on SES: never creates, updates or deletes a contact or topic.
 *
 * Usage (repo root):
 *   npx tsx apps/next/utils/mailing-lists/backfill-mailing-lists.ts          # dry run
 *   npx tsx apps/next/utils/mailing-lists/backfill-mailing-lists.ts --apply  # back up, then write
 */

import type { ConsentCategory, MailingListRecord } from '@my/app/provider/dynamodb/types'

// ---------------------------------------------------------------------------
// The 7 legacy SES topics the Toronto East lists were seeded from.
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

// topic → consent category.
//   bibleClass + sundaySchool → reminders
//   newsletter + memorial     → newsletters
//   interEcclesia             → ecclesial_correspondence
//   members, testList         → operational (not self-serve)
export const SEED_CATEGORY_BY_TOPIC: Record<SeedTopic, ConsentCategory> = {
  bibleClass: 'reminders',
  sundaySchool: 'reminders',
  newsletter: 'newsletters',
  memorial: 'newsletters',
  interEcclesia: 'ecclesial_correspondence',
  members: 'operational',
  testList: 'operational',
}

/** The ECCLESIA item that owns the seed lists, looked up by exact name. */
export const TORONTO_EAST_NAME = 'Toronto East Ecclesia'

export interface SeedListDef {
  key: SeedTopic
  sesTopic: SeedTopic
  category: ConsentCategory
  name: string
  description: string
}

// The list's OWN name. The reader sees "<owner> <name>", e.g. "Toronto East Newsletter".
const SEED_NAMES: Record<SeedTopic, { name: string; description: string }> = {
  newsletter: { name: 'Newsletter', description: 'The weekly newsletter, sent Thursday.' },
  memorial: {
    name: 'Memorial Service Recap',
    description: 'Sent Saturday: the details for Sunday’s memorial service.',
  },
  bibleClass: { name: 'Bible Class', description: 'Sent Wednesday: tonight’s Bible class.' },
  sundaySchool: { name: 'Sunday School', description: 'Reminders for Sunday school.' },
  members: { name: 'Members', description: 'Announcements for members.' },
  interEcclesia: {
    name: 'Inter-Ecclesial Correspondence',
    description: 'Correspondence circulated between ecclesias.',
  },
  testList: { name: 'Test List', description: 'Internal test sends.' },
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

type ListKeyFields = Pick<MailingListRecord, 'ownerType' | 'ownerId' | 'sesTopic'> & {
  listId?: string
}

const ownedBy = (l: ListKeyFields, ownerId: string) =>
  l.ownerType === 'ecclesia' && l.ownerId === ownerId && !!l.sesTopic

/**
 * Rows written before lists were owned by id (no `ownerId`). Prod had none when
 * this was written; if any appear the backfill stops rather than guess.
 */
export function findLegacyNameKeyedLists<T extends { ownerId?: string }>(lists: T[]): T[] {
  return lists.filter((l) => !l.ownerId)
}

/** Which of the 7 seed lists still need creating for this owner. */
export function planSeedLists(
  existingLists: ListKeyFields[],
  ownerId: string
): { toSeed: SeedListDef[]; skipped: SeedListDef[] } {
  const existingTopics = new Set(
    existingLists.filter((l) => ownedBy(l, ownerId)).map((l) => l.sesTopic as string)
  )
  const defs = buildSeedListDefs()
  return {
    toSeed: defs.filter((d) => !existingTopics.has(d.sesTopic)),
    skipped: defs.filter((d) => existingTopics.has(d.sesTopic)),
  }
}

/**
 * Marker listId for a seed list that will be created at `--apply` time. The real
 * id replaces it before any subscription is written; a PENDING id is never stored.
 */
export const PENDING_LIST_ID_PREFIX = 'PENDING#'
export const pendingListId = (sesTopic: string): string => `${PENDING_LIST_ID_PREFIX}${sesTopic}`
export const isPendingListId = (listId: string): boolean => listId.startsWith(PENDING_LIST_ID_PREFIX)

/** topic → listId for the lists that WILL exist after seeding (real ids win over markers). */
export function buildSeedTopicLookup(existingLists: ListKeyFields[], ownerId: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const def of buildSeedListDefs()) map.set(def.sesTopic, pendingListId(def.sesTopic))
  for (const l of existingLists) {
    if (ownedBy(l, ownerId) && l.listId) map.set(l.sesTopic as string, l.listId)
  }
  return map
}

/** One SES contact as read from get-contact. */
export interface SesContactForBackfill {
  email: string
  /** Explicit per-contact preferences — the ONLY source of opt-ins. */
  topicPreferences: Array<{ topic: string; status: 'OPT_IN' | 'OPT_OUT' }>
  /** Topic defaults as reported by SES. Never counted; carried for clarity/tests. */
  topicDefaultPreferences?: Array<{ topic: string; status: 'OPT_IN' | 'OPT_OUT' }>
  unsubscribeAll?: boolean
}

/** One lower-cased address with its effective explicit opt-ins. */
export interface MergedSubscriber {
  email: string
  topics: string[]
  /** How many SES contacts (case variants) were merged into this address. */
  variants: number
}

/**
 * Lower-case every address and merge case duplicates. Effective opt-ins per
 * contact = explicit OPT_IN topics, or none when UnsubscribeAll is set; the
 * merged address gets the union. Addresses with no effective opt-in are dropped.
 */
export function mergeSesContacts(contacts: SesContactForBackfill[]): {
  subscribers: MergedSubscriber[]
  caseDuplicateAddresses: number
} {
  const byEmail = new Map<string, { topics: Set<string>; variants: number }>()
  for (const c of contacts) {
    const email = c.email.trim().toLowerCase()
    const entry = byEmail.get(email) ?? { topics: new Set<string>(), variants: 0 }
    entry.variants++
    if (!c.unsubscribeAll) {
      for (const p of c.topicPreferences) if (p.status === 'OPT_IN') entry.topics.add(p.topic)
    }
    byEmail.set(email, entry)
  }
  let caseDuplicateAddresses = 0
  const subscribers: MergedSubscriber[] = []
  for (const [email, e] of [...byEmail.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (e.variants > 1) caseDuplicateAddresses++
    if (e.topics.size === 0) continue
    subscribers.push({ email, topics: [...e.topics].sort(), variants: e.variants })
  }
  return { subscribers, caseDuplicateAddresses }
}

/** The person + EMAIL# row an address resolves to. */
export interface ResolvedContact {
  personId: string
  emailId: string
  email: string
  /** The EMAIL# row's `verified` flag (the send resolver skips unverified rows). */
  verified?: boolean
}

export type ContactResolver = (email: string) => Promise<ResolvedContact | null>

export interface PlannedSubscription {
  /** null → the subscriber-only PersonRecord planned for this address (created at apply). */
  personId: string | null
  emailId: string | null
  listId: string
  email: string
  topic: string
}

export interface SubscriptionPlan {
  toCreate: PlannedSubscription[]
  /** Opted-in addresses no PersonRecord holds → a subscriber-only record each. */
  subscriberRecordsToCreate: Array<{ email: string; topics: string[] }>
  /** Effective explicit OPT_IN topic-rows (after case merge). */
  optInRows: number
  /** Resolved subscriptions whose EMAIL# row is unverified (the send resolver would skip them). */
  unverifiedTargets: number
  anomalies: {
    /** topic → OPT_INs whose topic has no seeded list */
    topicsWithNoList: Record<string, number>
    /** (list, address) already has a registry row (opt_in OR opt_out) — left alone */
    alreadyExists: number
  }
}

const rowKey = (listId: string, email: string) => `${listId}#${email.toLowerCase()}`

/**
 * Plan the SUB# rows to create. `existingRows` holds `${listId}#${email}` for every
 * existing row on the target lists, opt_in AND opt_out, so a re-run never
 * resurrects a registry opt-out.
 */
export async function planSubscriptions(input: {
  subscribers: MergedSubscriber[]
  listIdByTopic: Map<string, string>
  resolve: ContactResolver
  existingRows?: Set<string>
}): Promise<SubscriptionPlan> {
  const existing = input.existingRows ?? new Set<string>()
  const toCreate: PlannedSubscription[] = []
  const subscriberRecordsToCreate: SubscriptionPlan['subscriberRecordsToCreate'] = []
  const topicsWithNoList: Record<string, number> = {}
  let optInRows = 0
  let alreadyExists = 0
  let unverifiedTargets = 0

  for (const sub of input.subscribers) {
    optInRows += sub.topics.length
    const resolved = await input.resolve(sub.email)
    if (!resolved) subscriberRecordsToCreate.push({ email: sub.email, topics: sub.topics })

    for (const topic of sub.topics) {
      const listId = input.listIdByTopic.get(topic)
      if (!listId) {
        topicsWithNoList[topic] = (topicsWithNoList[topic] || 0) + 1
        continue
      }
      if (existing.has(rowKey(listId, sub.email))) {
        alreadyExists++
        continue
      }
      if (resolved && resolved.verified === false) unverifiedTargets++
      toCreate.push({
        personId: resolved?.personId ?? null,
        emailId: resolved?.emailId ?? null,
        listId,
        email: sub.email,
        topic,
      })
    }
  }

  return {
    toCreate,
    subscriberRecordsToCreate,
    optInRows,
    unverifiedTargets,
    anomalies: { topicsWithNoList, alreadyExists },
  }
}

/** Counts per topic, for the printed summary (never addresses). */
export function countByTopic(rows: Array<{ topic: string }>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[r.topic] = (out[r.topic] || 0) + 1
  return out
}

// ---------------------------------------------------------------------------
// I/O — only reached from a direct invocation, never in tests.
// ---------------------------------------------------------------------------

async function runBackfill(opts: { apply: boolean }): Promise<void> {
  const { loadCredentials, backupJsonToS3, sleep } = await import('./script-env')
  loadCredentials()

  // Imported after credentials are in the environment (the clients read them at load).
  const { QueryCommand, ScanCommand } = await import('@aws-sdk/lib-dynamodb')
  const { GetContactCommand, GetContactListCommand, ListContactsCommand, ListSuppressedDestinationsCommand } =
    await import('@aws-sdk/client-sesv2')
  const { docClient, tableNames } = await import('@my/app/provider/dynamodb/config')
  const { ecclesiaIdOf } = await import('@my/app/provider/dynamodb/people-index/keys')
  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )
  const { personRepository } = await import('@my/app/provider/dynamodb/repositories/person-repository')
  const { getSesClient } = await import('../email/sesClient')
  const { inputTemplate } = await import('../email/contact-lists')
  const { resolveSubscriber } = await import('./subscriptions')

  const mode = opts.apply ? 'APPLY' : 'DRY-RUN'
  console.log(`\n=== Mailing-list backfill (${mode}) ===\n`)

  // 1) The owner: Toronto East's stable ecclesia id (exact name, no fuzzy match).
  const eccl = await docClient.send(
    new QueryCommand({
      TableName: tableNames.admin,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `ECCLESIA#${TORONTO_EAST_NAME}` },
    })
  )
  const teItem = (eccl.Items || []).find((i: any) => i.type === 'ECCLESIA')
  if (!teItem) throw new Error(`No ECCLESIA item named "${TORONTO_EAST_NAME}" — aborting`)
  const ownerId = ecclesiaIdOf(teItem as { ecclesiaId?: string; name?: string })
  console.log(`Owner: ecclesia id "${ownerId}"`)

  // 2) Existing lists.
  const allLists = await mailingListRepository.listAllLists()
  const legacy = findLegacyNameKeyedLists(allLists)
  if (legacy.length > 0) {
    throw new Error(`${legacy.length} list(s) have no ownerId (name-keyed). Re-key them first — aborting.`)
  }
  const { toSeed, skipped } = planSeedLists(allLists, ownerId)
  const listIdByTopic = buildSeedTopicLookup(allLists, ownerId)
  console.log(`Lists: ${toSeed.length} to seed, ${skipped.length} already present.`)
  for (const def of toSeed) console.log(`  · ${opts.apply ? 'will seed' : 'would seed'} "${def.name}" (topic ${def.sesTopic})`)

  // 3) SES: every contact, then get-contact each for its full explicit
  //    preferences + attributes (also the backup). ~1 call/sec (SES limit).
  const ses = getSesClient()
  const contactEmails: string[] = []
  let NextToken: string | undefined
  do {
    const page = await ses.send(new ListContactsCommand({ ...inputTemplate, PageSize: 100, NextToken }))
    for (const c of page.Contacts ?? []) if (c.EmailAddress) contactEmails.push(c.EmailAddress)
    NextToken = page.NextToken
  } while (NextToken)
  console.log(`Reading ${contactEmails.length} SES contact(s) (about ${Math.ceil(contactEmails.length * 1.1)}s)…`)

  const rawContacts: Record<string, unknown>[] = []
  const contacts: SesContactForBackfill[] = []
  for (const email of contactEmails) {
    const full = await ses.send(new GetContactCommand({ ...inputTemplate, EmailAddress: email }))
    const { $metadata: _m, ...raw } = full as any
    rawContacts.push(raw)
    const prefs = (list?: Array<{ TopicName?: string; SubscriptionStatus?: string }>) =>
      (list || [])
        .filter((p) => p.TopicName && p.SubscriptionStatus)
        .map((p) => ({ topic: p.TopicName as string, status: p.SubscriptionStatus as 'OPT_IN' | 'OPT_OUT' }))
    contacts.push({
      email,
      topicPreferences: prefs(full.TopicPreferences),
      topicDefaultPreferences: prefs(full.TopicDefaultPreferences),
      unsubscribeAll: !!full.UnsubscribeAll,
    })
    await sleep(1100)
  }
  const { subscribers, caseDuplicateAddresses } = mergeSesContacts(contacts)

  // 4) Existing registry rows (opt_in AND opt_out) on the lists that already exist.
  const existingRows = new Set<string>()
  for (const listId of new Set(listIdByTopic.values())) {
    if (isPendingListId(listId)) continue
    for (const row of await mailingListRepository.listAllSubscriptionRows(listId)) {
      existingRows.add(rowKey(listId, row.email))
    }
  }

  // 5) Plan.
  const lookupDeps = {
    getByEmail: (e: string) => personRepository.getByEmail(e),
    getAllPersonsByEmail: (e: string) => personRepository.getAllPersonsByEmail(e),
    getEmails: (id: string) => personRepository.getEmails(id),
  }
  const resolve: ContactResolver = async (email) => {
    const who = await resolveSubscriber(email, lookupDeps)
    if (!who) return null
    const row = (await personRepository.getEmails(who.personId)).find((e) => e.emailId === who.emailId)
    return { ...who, verified: row?.verified }
  }
  const plan = await planSubscriptions({ subscribers, listIdByTopic, resolve, existingRows })

  console.log(
    JSON.stringify(
      {
        sesContacts: contacts.length,
        caseDuplicateAddressesMerged: caseDuplicateAddresses,
        addressesWithExplicitOptIn: subscribers.length,
        explicitOptInRows: plan.optInRows,
        subscriptionsToCreate: plan.toCreate.length,
        subscriptionsToCreateByTopic: countByTopic(plan.toCreate),
        alreadyInRegistry: plan.anomalies.alreadyExists,
        topicsWithNoList: plan.anomalies.topicsWithNoList,
        subscriberOnlyPersonRecordsToCreate: plan.subscriberRecordsToCreate.length,
        subscriberOnlyByTopic: countByTopic(
          plan.subscriberRecordsToCreate.flatMap((s) => s.topics.map((topic) => ({ topic })))
        ),
        unverifiedTargets: plan.unverifiedTargets,
      },
      null,
      2
    )
  )

  if (!opts.apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to back up and write.\n')
    return
  }

  // 6) Back up EVERYTHING this touches before the first write.
  const stamp = new Date().toISOString().slice(0, 10)
  const prefix = `backups/${stamp}-mailing-list-backfill`
  const items: Record<string, any>[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: tableNames.admin,
        FilterExpression: 'begins_with(pkey, :person) OR begins_with(pkey, :list)',
        ExpressionAttributeValues: { ':person': 'PERSON#', ':list': 'LIST#' },
        ExclusiveStartKey: lastKey,
      })
    )
    items.push(...(page.Items || []))
    lastKey = page.LastEvaluatedKey
  } while (lastKey)
  const topicList = await ses.send(new GetContactListCommand(inputTemplate))
  const suppressed: unknown[] = []
  let supToken: string | undefined
  do {
    const page = await ses.send(new ListSuppressedDestinationsCommand({ NextToken: supToken, PageSize: 100 }))
    suppressed.push(...(page.SuppressedDestinationSummaries || []))
    supToken = page.NextToken
  } while (supToken)

  const takenAt = new Date().toISOString()
  const run = Date.now()
  console.log(`\nBacking up to s3://tee-admin-backups/${prefix}/ …`)
  backupJsonToS3(`${prefix}/dynamodb-person-and-list-${run}.json`, { table: tableNames.admin, takenAt, items })
  backupJsonToS3(`${prefix}/ses-contacts-${run}.json`, { contactList: inputTemplate.ContactListName, takenAt, contacts: rawContacts })
  const { $metadata: _tm, ...topicListRaw } = topicList as any
  backupJsonToS3(`${prefix}/ses-topic-list-${run}.json`, { takenAt, topicList: topicListRaw })
  backupJsonToS3(`${prefix}/ses-suppression-list-${run}.json`, { takenAt, suppressed })
  console.log(
    `Backed up ${items.length} PERSON#/LIST# items, ${rawContacts.length} SES contacts, the topic list, ${suppressed.length} suppressed addresses.`
  )

  // 7) Writes: lists, then subscriber-only people, then subscriptions.
  for (const def of toSeed) {
    const created = await mailingListRepository.createList({
      ownerType: 'ecclesia',
      ownerId,
      scope: 'ecclesia',
      scopeValue: ownerId,
      category: def.category,
      key: def.key,
      name: def.name,
      description: def.description,
      defaultOptIn: false,
      sesTopic: def.sesTopic,
    })
    listIdByTopic.set(def.sesTopic, created.listId)
    console.log(`  + list ${created.listId} (topic ${def.sesTopic})`)
  }

  const createdPeople = new Map<string, { personId: string; emailId: string }>()
  for (const s of plan.subscriberRecordsToCreate) {
    // Re-check: an earlier interrupted run may already have created it.
    const again = await resolveSubscriber(s.email, lookupDeps)
    if (again) {
      createdPeople.set(s.email, again)
      continue
    }
    const person = await personRepository.create({
      email: s.email,
      firstName: '',
      lastName: '',
      ecclesia: '',
      memberStatus: 'friend',
      role: 'guest',
      source: 'mailing-list-backfill',
      sourceRef: 'ses-explicit-opt-in',
    })
    const row = (await personRepository.getEmails(person.personId)).find(
      (e) => e.email.toLowerCase() === s.email
    )
    if (!row) throw new Error(`Created person ${person.personId} has no EMAIL# row — aborting`)
    createdPeople.set(s.email, { personId: person.personId, emailId: row.emailId })
    console.log(`  + subscriber-only person ${person.personId}`)
  }

  let written = 0
  for (const sub of plan.toCreate) {
    const listId = isPendingListId(sub.listId) ? listIdByTopic.get(sub.topic) : sub.listId
    if (!listId || isPendingListId(listId)) throw new Error(`No real list for topic ${sub.topic} — aborting`)
    const who = sub.personId && sub.emailId ? { personId: sub.personId, emailId: sub.emailId } : createdPeople.get(sub.email)
    if (!who) throw new Error(`No person for a planned subscription on ${listId} — aborting`)
    await mailingListRepository.subscribe({
      personId: who.personId,
      listId,
      emailId: who.emailId,
      email: sub.email,
      source: 'migration',
      basis: 'migrated',
    })
    written++
  }
  console.log(`\n  + ${written} subscription(s) written. ${createdPeople.size} subscriber-only person(s).`)
  console.log('\n=== Done. Run the parity script next. ===\n')
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
