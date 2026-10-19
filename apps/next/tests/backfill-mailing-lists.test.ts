import { describe, it, expect } from 'vitest'

import {
  SEED_TOPICS,
  SEED_CATEGORY_BY_TOPIC,
  buildSeedListDefs,
  buildSeedTopicLookup,
  findLegacyNameKeyedLists,
  isPendingListId,
  mergeSesContacts,
  pendingListId,
  planSeedLists,
  planSubscriptions,
  type ContactResolver,
  type ResolvedContact,
  type SesContactForBackfill,
} from '../utils/mailing-lists/backfill-mailing-lists'

const TE = 'toronto-east-ecclesia'

const contact = (
  email: string,
  optIns: string[],
  extra: Partial<SesContactForBackfill> = {}
): SesContactForBackfill => ({
  email,
  topicPreferences: optIns.map((topic) => ({ topic, status: 'OPT_IN' as const })),
  ...extra,
})

const resolverFrom = (people: Record<string, ResolvedContact>): ContactResolver => async (email) =>
  people[email.toLowerCase()] ?? null

describe('seed lists', () => {
  it('maps every one of the 7 topics to its consent category', () => {
    expect(SEED_CATEGORY_BY_TOPIC).toEqual({
      bibleClass: 'reminders',
      sundaySchool: 'reminders',
      newsletter: 'newsletters',
      memorial: 'newsletters',
      interEcclesia: 'ecclesial_correspondence',
      members: 'operational',
      testList: 'operational',
    })
  })

  it('builds 7 defs whose own names never repeat the owner (display name is derived)', () => {
    const defs = buildSeedListDefs()
    expect(defs).toHaveLength(7)
    expect(defs.map((d) => d.sesTopic).sort()).toEqual([...SEED_TOPICS].sort())
    for (const d of defs) {
      expect(d.name).not.toMatch(/toronto/i)
      expect(d.sesTopic).toBe(d.key)
    }
  })

  it('seeds all 7 when the owner has none; matches existing lists by owner ID + topic', () => {
    expect(planSeedLists([], TE).toSeed).toHaveLength(7)
    const { toSeed, skipped } = planSeedLists(
      [
        { ownerType: 'ecclesia', ownerId: TE, sesTopic: 'newsletter' },
        { ownerType: 'ecclesia', ownerId: 'cambridge', sesTopic: 'memorial' }, // another owner
        { ownerType: 'organization', ownerId: TE, sesTopic: 'bibleClass' }, // same id, not an ecclesia
      ],
      TE
    )
    expect(skipped.map((d) => d.sesTopic)).toEqual(['newsletter'])
    expect(toSeed).toHaveLength(6)
  })

  it('flags rows written before lists were owned by id', () => {
    expect(findLegacyNameKeyedLists([{ ownerId: TE }, { ownerId: undefined }, {}])).toHaveLength(2)
  })

  it('topic lookup: pending markers for unseeded lists, real ids win', () => {
    const map = buildSeedTopicLookup([{ ownerType: 'ecclesia', ownerId: TE, sesTopic: 'bibleClass', listId: 'real-bc' }], TE)
    expect(map.get('bibleClass')).toBe('real-bc')
    expect(map.get('newsletter')).toBe(pendingListId('newsletter'))
    expect(isPendingListId(map.get('newsletter') as string)).toBe(true)
  })
})

describe('mergeSesContacts — lower case, case-merge, explicit opt-ins only', () => {
  it('lower-cases and merges case duplicates into one address with the union of opt-ins', () => {
    const { subscribers, caseDuplicateAddresses } = mergeSesContacts([
      contact('Reader@Example.org', ['newsletter']),
      contact('reader@example.org', ['bibleClass']),
      contact('other@example.org', ['memorial']),
    ])
    expect(caseDuplicateAddresses).toBe(1)
    expect(subscribers).toEqual([
      { email: 'other@example.org', topics: ['memorial'], variants: 1 },
      { email: 'reader@example.org', topics: ['bibleClass', 'newsletter'], variants: 2 },
    ])
  })

  it('ignores topic DEFAULTS — only explicit TopicPreferences count', () => {
    const { subscribers } = mergeSesContacts([
      contact('defaults-only@example.org', [], {
        topicDefaultPreferences: [
          { topic: 'newsletter', status: 'OPT_IN' },
          { topic: 'memorial', status: 'OPT_IN' },
        ],
      }),
    ])
    expect(subscribers).toEqual([])
  })

  it('ignores OPT_OUT and contacts with UnsubscribeAll (sends skip them today)', () => {
    const { subscribers } = mergeSesContacts([
      { email: 'out@example.org', topicPreferences: [{ topic: 'newsletter', status: 'OPT_OUT' }] },
      contact('stopped@example.org', ['newsletter'], { unsubscribeAll: true }),
      contact('Stopped2@Example.org', ['memorial'], { unsubscribeAll: true }),
      contact('stopped2@example.org', ['bibleClass']), // the live variant still counts
    ])
    expect(subscribers).toEqual([{ email: 'stopped2@example.org', topics: ['bibleClass'], variants: 2 }])
  })
})

describe('planSubscriptions', () => {
  const lookup = new Map([
    ['newsletter', 'L-NEWS'],
    ['bibleClass', 'L-BC'],
  ])

  it('one opt_in row per topic for a resolved person', async () => {
    const plan = await planSubscriptions({
      subscribers: [{ email: 'a@example.org', topics: ['bibleClass', 'newsletter'], variants: 1 }],
      listIdByTopic: lookup,
      resolve: resolverFrom({ 'a@example.org': { personId: 'p1', emailId: 'e1', email: 'a@example.org', verified: true } }),
    })
    expect(plan.toCreate).toEqual([
      { personId: 'p1', emailId: 'e1', listId: 'L-BC', email: 'a@example.org', topic: 'bibleClass' },
      { personId: 'p1', emailId: 'e1', listId: 'L-NEWS', email: 'a@example.org', topic: 'newsletter' },
    ])
    expect(plan.subscriberRecordsToCreate).toEqual([])
    expect(plan.optInRows).toBe(2)
  })

  it('an opted-in address with no PersonRecord gets a subscriber-only record — never dropped', async () => {
    const plan = await planSubscriptions({
      subscribers: [{ email: 'nobody@example.org', topics: ['newsletter'], variants: 1 }],
      listIdByTopic: lookup,
      resolve: resolverFrom({}),
    })
    expect(plan.subscriberRecordsToCreate).toEqual([{ email: 'nobody@example.org', topics: ['newsletter'] }])
    expect(plan.toCreate).toEqual([
      { personId: null, emailId: null, listId: 'L-NEWS', email: 'nobody@example.org', topic: 'newsletter' },
    ])
  })

  it('idempotent: an existing row for (list, address) — opt_in OR opt_out — is left alone', async () => {
    const plan = await planSubscriptions({
      subscribers: [{ email: 'a@example.org', topics: ['bibleClass', 'newsletter'], variants: 1 }],
      listIdByTopic: lookup,
      resolve: resolverFrom({ 'a@example.org': { personId: 'p1', emailId: 'e1', email: 'a@example.org' } }),
      // e.g. they opted out of the newsletter in the registry after the first run
      existingRows: new Set(['L-NEWS#a@example.org']),
    })
    expect(plan.toCreate.map((s) => s.topic)).toEqual(['bibleClass'])
    expect(plan.anomalies.alreadyExists).toBe(1)
  })

  it('reports topics with no list and unverified targets', async () => {
    const plan = await planSubscriptions({
      subscribers: [{ email: 'a@example.org', topics: ['mystery', 'newsletter'], variants: 1 }],
      listIdByTopic: lookup,
      resolve: resolverFrom({ 'a@example.org': { personId: 'p1', emailId: 'e1', email: 'a@example.org', verified: false } }),
    })
    expect(plan.anomalies.topicsWithNoList).toEqual({ mystery: 1 })
    expect(plan.unverifiedTargets).toBe(1)
  })
})
