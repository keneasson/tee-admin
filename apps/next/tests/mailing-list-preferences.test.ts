import { describe, it, expect, vi } from 'vitest'
import { buildListPreferences, planListSave } from '../utils/mailing-lists/preferences'
import { setListSubscription, type SetSubscriptionDeps } from '../utils/mailing-lists/subscriptions'
import { listDisplayName, shortOwnerName } from '../utils/mailing-lists/owners'
import { validateNewList } from '../utils/mailing-lists/create-list'
import type { ListSubscriptionRecord, MailingListRecord, PersonRecord } from '@my/app/provider/dynamodb/types'

const list = (o: Partial<MailingListRecord>): MailingListRecord =>
  ({
    pkey: `LIST#${o.listId}`,
    skey: 'DETAILS',
    ownerType: 'ecclesia',
    ownerId: 'toronto-east-ecclesia',
    scope: 'ecclesia',
    scopeValue: 'toronto-east-ecclesia',
    category: 'newsletters',
    key: 'k',
    name: 'Newsletter',
    description: '',
    defaultOptIn: false,
    status: 'active',
    ...o,
  }) as MailingListRecord

const OWNERS: Record<string, string> = {
  'toronto-east-ecclesia': 'Toronto East Ecclesia',
  cambridge: 'Cambridge Ecclesia',
  'toronto-area-cyc': 'Toronto Area CYC',
}

describe('display names are derived from the owner, never stored', () => {
  it('"<owner> <list>" without the word Ecclesia', () => {
    expect(listDisplayName('Toronto East Ecclesia', 'Newsletter')).toBe('Toronto East Newsletter')
    expect(listDisplayName('Cambridge Ecclesia', 'Memorial Recap')).toBe('Cambridge Memorial Recap')
    expect(listDisplayName('Toronto Area', 'CYC')).toBe('Toronto Area CYC')
    expect(shortOwnerName('Ecclesia')).toBe('Ecclesia')
  })
})

describe('buildListPreferences — any number of lists, grouped by owner', () => {
  const allLists = [
    list({ listId: 'te-news', name: 'Newsletter', sesTopic: 'newsletter' }),
    list({ listId: 'te-bc', name: 'Bible Class', category: 'reminders', sesTopic: 'bibleClass', sendFromRegistry: true }),
    list({ listId: 'te-members', name: 'Members', category: 'operational', sesTopic: 'members' }),
    list({ listId: 'cam-recap', ownerId: 'cambridge', name: 'Memorial Recap', scope: 'region', scopeValue: 'canada_east' }),
    list({ listId: 'cyc', ownerType: 'organization', ownerId: 'toronto-area-cyc', name: 'News', scope: 'global', scopeValue: '' }),
    list({ listId: 'cam-old', ownerId: 'cambridge', name: 'Old', status: 'archived' }),
  ]

  const groups = buildListPreferences({
    allLists,
    offeredIds: new Set(['te-news', 'te-bc', 'te-members', 'cam-recap', 'cam-old']),
    registryStatus: new Map([
      ['te-news', 'opt_out'], // registry says out, but SES still governs this list
      ['te-bc', 'opt_in'],
      ['cyc', 'opt_in'], // not offered by scope, but they already subscribe → shown
    ]),
    sesOptIns: new Set(['newsletter']),
    ownerName: (l) => OWNERS[l.ownerId],
  })

  it('shows only self-serve, active lists that are offered or already subscribed', () => {
    const ids = groups.flatMap((g) => g.lists.map((l) => l.listId)).sort()
    expect(ids).toEqual(['cam-recap', 'cyc', 'te-bc', 'te-news'])
  })

  it('groups by owner with derived names', () => {
    expect(groups.map((g) => g.ownerName)).toEqual(['Cambridge', 'Toronto Area CYC', 'Toronto East'])
    expect(groups[2].lists.map((l) => l.name)).toEqual(['Toronto East Bible Class', 'Toronto East Newsletter'])
  })

  it('state = what decides delivery: SES topic until cut over, registry after', () => {
    const state = Object.fromEntries(groups.flatMap((g) => g.lists.map((l) => [l.listId, l.subscribed])))
    expect(state).toEqual({ 'te-news': true, 'te-bc': true, 'cam-recap': false, cyc: true })
  })
})

describe('planListSave — never trusts client list ids', () => {
  const allLists = [
    list({ listId: 'te-news', sesTopic: 'newsletter' }),
    list({ listId: 'cam-recap', ownerId: 'cambridge' }),
    list({ listId: 'te-members', category: 'operational', sesTopic: 'members' }),
    list({ listId: 'arch', status: 'archived' }),
  ]
  it('keeps self-serve lists, drops unknown/operational/archived/non-boolean, maps bridged topics', () => {
    const { changes, sesTopics } = planListSave(
      { 'te-news': false, 'cam-recap': true, 'te-members': true, arch: true, nope: true, 'te-x': 'yes' },
      allLists
    )
    expect(changes.map((c) => [c.list.listId, c.subscribed])).toEqual([
      ['te-news', false],
      ['cam-recap', true],
    ])
    expect(sesTopics).toEqual({ newsletter: false })
  })
})

describe('setListSubscription — writes the registry by address', () => {
  const person = { personId: 'p1' } as PersonRecord
  const row = (o: Partial<ListSubscriptionRecord>) =>
    ({ pkey: 'PERSON#p1', skey: 'SUB#L#e1', status: 'opt_in', ...o }) as ListSubscriptionRecord

  const deps = (rows: ListSubscriptionRecord[], o: Partial<SetSubscriptionDeps> = {}): SetSubscriptionDeps => ({
    getByEmail: vi.fn(async () => person),
    getAllPersonsByEmail: vi.fn(async () => []),
    getEmails: vi.fn(async () => [{ emailId: 'e1', email: 'reader@example.org' }]),
    getListSubscriptionsForEmail: vi.fn(async () => rows),
    setSubscriptionStatus: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => undefined),
    ...o,
  })

  it('subscribe with no row: writes one opt_in under the resolved person (self / express)', async () => {
    const d = deps([])
    expect(await setListSubscription({ listId: 'L', email: 'Reader@Example.org', subscribed: true }, d)).toBe('subscribed')
    expect(d.subscribe).toHaveBeenCalledWith({
      personId: 'p1',
      listId: 'L',
      emailId: 'e1',
      email: 'reader@example.org',
      source: 'self',
      basis: 'express',
    })
  })

  it('unsubscribe flips EVERY row for the address (household), never deletes', async () => {
    const d = deps([row({ pkey: 'PERSON#p1' }), row({ pkey: 'PERSON#p2', skey: 'SUB#L#e9' })])
    expect(await setListSubscription({ listId: 'L', email: 'reader@example.org', subscribed: false }, d)).toBe('unsubscribed')
    expect(d.setSubscriptionStatus).toHaveBeenCalledTimes(2)
    expect((d.setSubscriptionStatus as any).mock.calls.every((c: any[]) => c[1] === 'opt_out')).toBe(true)
    expect(d.subscribe).not.toHaveBeenCalled()
  })

  it('re-subscribe flips an opt_out row back instead of writing a second row', async () => {
    const d = deps([row({ status: 'opt_out' })])
    expect(await setListSubscription({ listId: 'L', email: 'reader@example.org', subscribed: true }, d)).toBe('subscribed')
    expect(d.setSubscriptionStatus).toHaveBeenCalledWith(expect.objectContaining({ skey: 'SUB#L#e1' }), 'opt_in')
    expect(d.subscribe).not.toHaveBeenCalled()
  })

  it('no-ops: unsubscribe with no row; same state', async () => {
    expect(await setListSubscription({ listId: 'L', email: 'x@example.org', subscribed: false }, deps([]))).toBe('unchanged')
    expect(await setListSubscription({ listId: 'L', email: 'x@example.org', subscribed: true }, deps([row({})]))).toBe('unchanged')
  })

  it('no PersonRecord holds the address: reports it, writes nothing', async () => {
    const d = deps([], { getByEmail: vi.fn(async () => null) })
    expect(await setListSubscription({ listId: 'L', email: 'x@example.org', subscribed: true }, d)).toBe('no-person')
    expect(d.subscribe).not.toHaveBeenCalled()
  })
})

describe('validateNewList — admin creates a list for an ecclesia or organization', () => {
  const owners = [
    { ownerType: 'ecclesia' as const, ownerId: 'cambridge', name: 'Cambridge Ecclesia' },
    { ownerType: 'organization' as const, ownerId: 'toronto-area-cyc', name: 'Toronto Area CYC' },
  ]
  const base = {
    ownerType: 'ecclesia',
    ownerId: 'cambridge',
    name: ' Memorial Recap ',
    description: 'Sunday recap',
    category: 'newsletters',
    scope: 'region',
    scopeValue: 'canada_east',
    defaultOptIn: true,
  }

  it('accepts a valid list and trims the name', () => {
    const v = validateNewList(base, owners, [])
    expect(v).toEqual({ ok: true, value: { ...base, name: 'Memorial Recap' } })
  })

  it('an ecclesia-scoped list is offered to that ecclesia (scopeValue = owner id)', () => {
    const v = validateNewList({ ...base, scope: 'ecclesia', scopeValue: 'something-else' }, owners, [])
    expect(v.ok && v.value.scopeValue).toBe('cambridge')
  })

  it.each([
    [{ ownerId: 'unknown' }, /owner was not found/],
    [{ name: 'x' }, /2–80/],
    [{ category: 'operational' }, /newsletters/],
    [{ scope: 'region', scopeValue: 'atlantis' }, /region/],
    [{ ownerType: 'organization', ownerId: 'toronto-area-cyc', scope: 'ecclesia' }, /Only an ecclesia/],
  ])('rejects %o', (patch, msg) => {
    const v = validateNewList({ ...base, ...patch }, owners, [])
    expect(v.ok).toBe(false)
    expect(!v.ok && v.error).toMatch(msg)
  })

  it('rejects a duplicate active name for the same owner', () => {
    const v = validateNewList(base, owners, [
      { ownerType: 'ecclesia', ownerId: 'cambridge', name: 'memorial recap', status: 'active' },
    ])
    expect(v.ok).toBe(false)
  })
})
