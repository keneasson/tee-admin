import { describe, it, expect } from 'vitest'

import {
  SEED_TOPICS,
  SEED_CATEGORY_BY_TOPIC,
  TORONTO_EAST,
  buildSeedListDefs,
  planSeedLists,
  planSubscriptions,
  type SesContactForBackfill,
  type ContactResolver,
  type ResolvedContact,
} from '../utils/mailing-lists/backfill-mailing-lists'

describe('backfill mapping — topic → consent category', () => {
  it('maps every one of the 7 topics to the documented category', () => {
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

  it('builds 7 seed defs, all Toronto East, all with a name/description + sesTopic bridge', () => {
    const defs = buildSeedListDefs()
    expect(defs).toHaveLength(7)
    expect(defs.map((d) => d.sesTopic).sort()).toEqual([...SEED_TOPICS].sort())
    for (const d of defs) {
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.description.length).toBeGreaterThan(0)
      expect(d.sesTopic).toBe(d.key) // bridge topic == slug
      expect(d.category).toBe(SEED_CATEGORY_BY_TOPIC[d.key])
    }
    expect(TORONTO_EAST.ownerName).toBe('Toronto East Ecclesia')
  })
})

describe('planSeedLists — idempotent seeding', () => {
  it('seeds all 7 when none exist', () => {
    const { toSeed, skipped } = planSeedLists([])
    expect(toSeed).toHaveLength(7)
    expect(skipped).toHaveLength(0)
  })

  it('skips topics already present (matched by ownerName + sesTopic)', () => {
    const { toSeed, skipped } = planSeedLists([
      { ownerName: 'Toronto East Ecclesia', sesTopic: 'newsletter' },
      { ownerName: 'Toronto East Ecclesia', sesTopic: 'memorial' },
      // a different tenant's newsletter must NOT count as present
      { ownerName: 'Some Other Ecclesia', sesTopic: 'bibleClass' },
    ])
    expect(skipped.map((d) => d.sesTopic).sort()).toEqual(['memorial', 'newsletter'])
    expect(toSeed).toHaveLength(5)
    expect(toSeed.map((d) => d.sesTopic)).toContain('bibleClass')
  })
})

describe('planSubscriptions — SES contacts → subscriptions (canonical source)', () => {
  const listIdByTopic = new Map<string, string>([
    ['newsletter', 'list-newsletter'],
    ['memorial', 'list-memorial'],
    ['bibleClass', 'list-bibleClass'],
    ['sundaySchool', 'list-sundaySchool'],
    ['members', 'list-members'],
    ['interEcclesia', 'list-interEcclesia'],
    ['testList', 'list-testList'],
  ])

  // A mock resolver backed by a fixed email → PersonRecord row table. Any email
  // not in the table resolves to null (unresolved), exercising the report path
  // without hitting AWS.
  function makeResolver(table: Record<string, ResolvedContact>): ContactResolver {
    return async (email: string) => table[email.toLowerCase()] ?? null
  }

  it('creates one opt_in per OPT_IN topic for a resolved contact; ignores OPT_OUT', async () => {
    const contacts: SesContactForBackfill[] = [
      {
        email: 'A@x.com',
        topicPreferences: [
          { topic: 'newsletter', status: 'OPT_IN' },
          { topic: 'memorial', status: 'OPT_IN' },
          { topic: 'bibleClass', status: 'OPT_OUT' }, // ignored
        ],
      },
    ]
    const resolve = makeResolver({
      'a@x.com': { personId: 'p1', emailId: 'e1', email: 'a@x.com' },
    })

    const plan = await planSubscriptions({ contacts, listIdByTopic, resolve })

    expect(plan.toCreate).toHaveLength(2)
    const byTopic = Object.fromEntries(plan.toCreate.map((s) => [s.topic, s]))
    expect(byTopic.newsletter).toMatchObject({
      personId: 'p1',
      listId: 'list-newsletter',
      emailId: 'e1',
      email: 'a@x.com',
    })
    expect(byTopic.memorial.listId).toBe('list-memorial')
    expect(byTopic.bibleClass).toBeUndefined()
    // subscriptionsFromSes counts OPT_IN rows only (the 2 opt-ins).
    expect(plan.subscriptionsFromSes).toBe(2)
    expect(plan.unresolvedSubscribers).toHaveLength(0)
  })

  it('reports an unresolved email (no PersonRecord) instead of dropping it', async () => {
    const contacts: SesContactForBackfill[] = [
      {
        email: 'sanjaymondol80@gmail.com',
        topicPreferences: [
          { topic: 'newsletter', status: 'OPT_IN' },
          { topic: 'bibleClass', status: 'OPT_IN' },
          { topic: 'memorial', status: 'OPT_OUT' },
        ],
      },
    ]
    const resolve = makeResolver({}) // resolves nothing

    const plan = await planSubscriptions({ contacts, listIdByTopic, resolve })

    expect(plan.toCreate).toHaveLength(0)
    expect(plan.unresolvedSubscribers).toEqual([
      { email: 'sanjaymondol80@gmail.com', topics: ['newsletter', 'bibleClass'] },
    ])
    // still counted as SES opt-in rows (2 OPT_INs), just not creatable
    expect(plan.subscriptionsFromSes).toBe(2)
  })

  it('is idempotent — skips subscriptions that already exist', async () => {
    const contacts: SesContactForBackfill[] = [
      { email: 'a@x.com', topicPreferences: [{ topic: 'newsletter', status: 'OPT_IN' }] },
    ]
    const resolve = makeResolver({
      'a@x.com': { personId: 'p1', emailId: 'e1', email: 'a@x.com' },
    })
    const existingSubKeys = new Set(['p1#list-newsletter#e1'])

    const plan = await planSubscriptions({ contacts, listIdByTopic, resolve, existingSubKeys })

    expect(plan.toCreate).toHaveLength(0)
    expect(plan.anomalies.alreadyExists).toBe(1)
  })

  it('flags an OPT_IN for a topic with no matching list as an anomaly', async () => {
    const contacts: SesContactForBackfill[] = [
      { email: 'a@x.com', topicPreferences: [{ topic: 'legacyTopic', status: 'OPT_IN' }] },
    ]
    const resolve = makeResolver({
      'a@x.com': { personId: 'p1', emailId: 'e1', email: 'a@x.com' },
    })

    const plan = await planSubscriptions({ contacts, listIdByTopic, resolve })

    expect(plan.toCreate).toHaveLength(0)
    expect(plan.anomalies.topicsWithNoList).toEqual({ legacyTopic: 1 })
  })

  it('skips a contact with no OPT_IN topics entirely (no resolve, no rows)', async () => {
    let resolveCalls = 0
    const resolve: ContactResolver = async (email) => {
      resolveCalls++
      return { personId: 'p1', emailId: 'e1', email }
    }
    const contacts: SesContactForBackfill[] = [
      { email: 'a@x.com', topicPreferences: [{ topic: 'newsletter', status: 'OPT_OUT' }] },
      { email: 'b@x.com', topicPreferences: [] },
    ]

    const plan = await planSubscriptions({ contacts, listIdByTopic, resolve })

    expect(plan.toCreate).toHaveLength(0)
    expect(plan.subscriptionsFromSes).toBe(0)
    expect(plan.unresolvedSubscribers).toHaveLength(0)
    expect(resolveCalls).toBe(0) // never resolves a contact with zero opt-ins
  })

  it('mixes resolved + unresolved contacts in one pass', async () => {
    const contacts: SesContactForBackfill[] = [
      { email: 'known@x.com', topicPreferences: [{ topic: 'newsletter', status: 'OPT_IN' }] },
      { email: 'unknown@x.com', topicPreferences: [{ topic: 'memorial', status: 'OPT_IN' }] },
    ]
    const resolve = makeResolver({
      'known@x.com': { personId: 'p1', emailId: 'e1', email: 'known@x.com' },
    })

    const plan = await planSubscriptions({ contacts, listIdByTopic, resolve })

    expect(plan.toCreate).toHaveLength(1)
    expect(plan.toCreate[0]).toMatchObject({ personId: 'p1', topic: 'newsletter' })
    expect(plan.unresolvedSubscribers).toEqual([
      { email: 'unknown@x.com', topics: ['memorial'] },
    ])
    expect(plan.subscriptionsFromSes).toBe(2)
  })
})
