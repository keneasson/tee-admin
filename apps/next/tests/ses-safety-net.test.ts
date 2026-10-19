import { describe, it, expect } from 'vitest'
import { chooseSendTopic, DEFAULT_SAFETY_NET_TOPIC, SAFETY_NET_TOPICS } from '../utils/mailing-lists/safety-net'
import {
  lostUnsubscribeAll,
  mergeRefusals,
  planCaseDuplicates,
  safetyNetTopicList,
  switchRefusals,
  topicListProblems,
} from '../utils/mailing-lists/safety-net-switch'
import { planTopicFieldRetirement } from '../utils/mailing-lists/retire-topic-fields'

/**
 * R5 SES safety nets: one config place, guarded by a stored setting, and an
 * owner-run switch whose every refusal and plan is checked here. No SES call.
 */

const scoped = { ownerType: 'ecclesia' as const, ownerId: 'toronto-east-ecclesia', scope: 'ecclesia' as const, scopeValue: 'toronto-east-ecclesia' }

describe('chooseSendTopic — which SES topic a send names', () => {
  it('safety net OFF: the list legacy topic, or none for a list without one', () => {
    expect(chooseSendTopic({ ...scoped, sesTopic: 'memorial' }, false)).toBe('memorial')
    expect(chooseSendTopic({ ...scoped }, false)).toBeUndefined()
  })
  it('safety net ON: the safety-net topic for every list, the legacy topic is never named', () => {
    expect(chooseSendTopic({ ...scoped, sesTopic: 'memorial' }, true)).toBe(DEFAULT_SAFETY_NET_TOPIC)
    expect(chooseSendTopic({ ...scoped }, true)).toBe(DEFAULT_SAFETY_NET_TOPIC)
  })
  it('the safety nets default to OPT_IN (no preference = receives mail)', () => {
    expect(SAFETY_NET_TOPICS.every((t) => t.defaultSubscriptionStatus === 'OPT_IN')).toBe(true)
  })
})

describe('switchRefusals — (a) every list cut over with empty parity, (b) not Wed–Sat', () => {
  const bridged = (o: Record<string, unknown> = {}) => ({
    listId: 'L1',
    key: 'newsletter',
    status: 'active' as const,
    sesTopic: 'newsletter',
    sendFromRegistry: true,
    ...o,
  })

  it('all cut over, parity empty, Sunday: go', () => {
    expect(
      switchRefusals({ lists: [bridged(), { listId: 'L2', key: 'recap', status: 'active' }], parityEmpty: new Map([['L1', true]]), inSendWindow: false })
    ).toEqual([])
  })

  it('refuses a bridged list still on its SES topic', () => {
    const r = switchRefusals({ lists: [bridged({ sendFromRegistry: false })], parityEmpty: new Map([['L1', true]]), inSendWindow: false })
    expect(r.join(' ')).toMatch(/cut it over/)
  })

  it('refuses non-empty (or missing) parity', () => {
    expect(switchRefusals({ lists: [bridged()], parityEmpty: new Map([['L1', false]]), inSendWindow: false })).toHaveLength(1)
    expect(switchRefusals({ lists: [bridged()], parityEmpty: new Map(), inSendWindow: false })).toHaveLength(1)
  })

  it('refuses during the send window', () => {
    expect(switchRefusals({ lists: [bridged()], parityEmpty: new Map([['L1', true]]), inSendWindow: true }).join(' ')).toMatch(
      /Wednesday/
    )
  })

  it('archived lists do not block', () => {
    expect(
      switchRefusals({ lists: [bridged({ status: 'archived', sendFromRegistry: false })], parityEmpty: new Map(), inSendWindow: false })
    ).toEqual([])
  })
})

describe('(d) and (g): the topic list', () => {
  it('replaces the topics with the safety nets only, default OPT_IN', () => {
    expect(safetyNetTopicList()).toEqual([
      expect.objectContaining({ TopicName: DEFAULT_SAFETY_NET_TOPIC, DefaultSubscriptionStatus: 'OPT_IN' }),
    ])
  })
  it('read-back flags a leftover legacy topic, a missing safety net, or a wrong default', () => {
    expect(topicListProblems([{ TopicName: DEFAULT_SAFETY_NET_TOPIC, DefaultSubscriptionStatus: 'OPT_IN' }])).toEqual([])
    expect(
      topicListProblems([
        { TopicName: DEFAULT_SAFETY_NET_TOPIC, DefaultSubscriptionStatus: 'OPT_OUT' },
        { TopicName: 'newsletter', DefaultSubscriptionStatus: 'OPT_IN' },
      ])
    ).toHaveLength(2)
    expect(topicListProblems([])).toEqual([`Missing topic ${DEFAULT_SAFETY_NET_TOPIC}`])
  })
})

describe('(e) UnsubscribeAll survives; the separate case-duplicate merge', () => {
  it('lostUnsubscribeAll lists only contacts that had it and lost it', () => {
    const before = [
      { email: 'a@example.org', unsubscribeAll: true },
      { email: 'b@example.org', unsubscribeAll: true },
      { email: 'c@example.org', unsubscribeAll: false },
    ]
    expect(lostUnsubscribeAll(before, new Map([['a@example.org', true], ['b@example.org', false]]))).toEqual([
      'b@example.org',
    ])
  })

  it('planCaseDuplicates: keep lower case, never lose a stop, delete the variants', () => {
    const plan = planCaseDuplicates([
      { email: 'pat@example.org', unsubscribeAll: false },
      { email: 'Pat@Example.org', unsubscribeAll: true, attributesData: '{"a":1}' },
      { email: 'Sam@example.org', unsubscribeAll: false },
      { email: 'lee@example.org', unsubscribeAll: false },
    ])
    expect(plan).toEqual([
      {
        email: 'pat@example.org',
        lowerExists: true,
        unsubscribeAll: true,
        attributesData: '{"a":1}',
        deleteVariants: ['Pat@Example.org'],
      },
      { email: 'sam@example.org', lowerExists: false, unsubscribeAll: false, attributesData: undefined, deleteVariants: ['Sam@example.org'] },
    ])
  })
})

describe('mergeRefusals — case-duplicate merge runs only after the safety net, Sun–Tue', () => {
  it('refuses before the safety net (topic preferences would be dropped) and mid-switch', () => {
    expect(mergeRefusals({ safetyNet: { enabled: false }, inSendWindow: false })).toHaveLength(1)
    expect(mergeRefusals({ safetyNet: { enabled: false, switching: true }, inSendWindow: false })[0]).toMatch(/mid-way/)
  })
  it('refuses in the send window', () => {
    expect(mergeRefusals({ safetyNet: { enabled: true }, inSendWindow: true })[0]).toMatch(/Wednesday/)
  })
  it('safety net on, Sunday: go', () => {
    expect(mergeRefusals({ safetyNet: { enabled: true }, inSendWindow: false })).toEqual([])
  })
})

describe('retire-ses-topic-fields planning', () => {
  const items = [
    { pkey: 'PERSON#p1', skey: 'EMAIL#e1', sesTopicPreferences: { newsletter: true } },
    { pkey: 'PERSON#p1', skey: 'EMAIL#e2' },
    { pkey: 'PERSON#p1', skey: 'PROFILE', sesTopicPreferences: {} }, // not an EMAIL# row: untouched
    { pkey: 'LIST#L1', skey: 'DETAILS', sesTopic: 'newsletter' },
  ]

  it('before the safety net: removes sesTopicPreferences only and says why lists are kept', () => {
    const plan = planTopicFieldRetirement(items, false)
    expect(plan.removals).toEqual([{ pkey: 'PERSON#p1', skey: 'EMAIL#e1', attribute: 'sesTopicPreferences' }])
    expect(plan.listsSkippedReason).toMatch(/1 list/)
  })

  it('after the safety net: also removes each list sesTopic bridge', () => {
    const plan = planTopicFieldRetirement(items, true)
    expect(plan.removals.map((r) => r.attribute).sort()).toEqual(['sesTopic', 'sesTopicPreferences'])
    expect(plan.listsSkippedReason).toBeUndefined()
  })
})
