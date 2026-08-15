import { describe, it, expect } from 'vitest'

import {
  SEED_TOPICS,
  SEED_CATEGORY_BY_TOPIC,
  TORONTO_EAST,
  buildSeedListDefs,
  planSeedLists,
  planSubscriptions,
  type EmailItemForBackfill,
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

describe('planSubscriptions — sesTopicPreferences → subscriptions', () => {
  const listIdByTopic = new Map<string, string>([
    ['newsletter', 'list-newsletter'],
    ['memorial', 'list-memorial'],
    ['bibleClass', 'list-bibleClass'],
    ['sundaySchool', 'list-sundaySchool'],
    ['members', 'list-members'],
    ['interEcclesia', 'list-interEcclesia'],
    ['testList', 'list-testList'],
  ])

  it('creates one opt_in per topic where the pref is exactly true', () => {
    const emailItems: EmailItemForBackfill[] = [
      {
        pkey: 'PERSON#p1',
        emailId: 'e1',
        email: 'a@x.com',
        sesTopicPreferences: {
          newsletter: true,
          memorial: true,
          bibleClass: false, // opted out → not created
        },
      },
    ]
    const plan = planSubscriptions({ emailItems, listIdByTopic })
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
  })

  it('is idempotent — skips subscriptions that already exist', () => {
    const emailItems: EmailItemForBackfill[] = [
      { pkey: 'PERSON#p1', emailId: 'e1', email: 'a@x.com', sesTopicPreferences: { newsletter: true } },
    ]
    const existingSubKeys = new Set(['p1#list-newsletter#e1'])
    const plan = planSubscriptions({ emailItems, listIdByTopic, existingSubKeys })
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.anomalies.alreadyExists).toBe(1)
  })

  it('flags an opt-in for a topic with no matching list as an anomaly', () => {
    const emailItems: EmailItemForBackfill[] = [
      { pkey: 'PERSON#p1', emailId: 'e1', email: 'a@x.com', sesTopicPreferences: { legacyTopic: true } },
    ]
    const plan = planSubscriptions({ emailItems, listIdByTopic })
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.anomalies.topicsWithNoList).toEqual({ legacyTopic: 1 })
  })

  it('flags EMAIL# items whose pkey is not a PERSON# key', () => {
    const emailItems: EmailItemForBackfill[] = [
      { pkey: 'USER#a@x.com', emailId: 'e1', email: 'a@x.com', sesTopicPreferences: { newsletter: true } },
    ]
    const plan = planSubscriptions({ emailItems, listIdByTopic })
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.anomalies.emailsWithNoPerson).toEqual([{ pkey: 'USER#a@x.com', email: 'a@x.com' }])
  })

  it('handles missing/empty sesTopicPreferences without creating anything', () => {
    const emailItems: EmailItemForBackfill[] = [
      { pkey: 'PERSON#p1', emailId: 'e1', email: 'a@x.com' },
      { pkey: 'PERSON#p2', emailId: 'e2', email: 'b@x.com', sesTopicPreferences: {} },
    ]
    const plan = planSubscriptions({ emailItems, listIdByTopic })
    expect(plan.toCreate).toHaveLength(0)
    expect(plan.anomalies.emailsWithNoPerson).toHaveLength(0)
  })
})
