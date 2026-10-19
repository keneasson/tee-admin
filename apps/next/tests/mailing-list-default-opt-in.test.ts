import { describe, it, expect, vi } from 'vitest'
import {
  ecclesiasInScope,
  eligiblePeopleForList,
  isDefaultEligiblePerson,
} from '../utils/mailing-lists/default-opt-in'
import {
  defaultOptInCandidates,
  resolveListRecipients,
  type ResolveDeps,
} from '../utils/email/resolve-list-recipients'
import { buildListPreferences } from '../utils/mailing-lists/preferences'
import { setListSubscription, type SetSubscriptionDeps } from '../utils/mailing-lists/subscriptions'
import type { MailingListRecord } from '@my/app/provider/dynamodb/types'

/**
 * defaultOptIn (R5): an eligible person with NO row on a defaultOptIn list is
 * treated as subscribed (source 'default'); an explicit opt-out always wins.
 */

const ECCLESIAS = [
  { name: 'Toronto East Ecclesia', ecclesiaId: 'toronto-east-ecclesia', country: 'CA', province: 'ON' },
  { name: 'Cambridge Ecclesia', country: 'CA', province: 'ON' },
  { name: 'London Ecclesia', country: 'GB', region: 'uk' },
]

describe('ecclesiasInScope — the same ladder the preferences page offers', () => {
  it('ecclesia scope: the one ecclesia, by id (slug fallback for items without an id)', () => {
    expect(ecclesiasInScope({ scope: 'ecclesia', scopeValue: 'cambridge-ecclesia' }, ECCLESIAS).map((e) => e.name)).toEqual([
      'Cambridge Ecclesia',
    ])
  })

  it('global scope: every ecclesia', () => {
    expect(ecclesiasInScope({ scope: 'global', scopeValue: '' }, ECCLESIAS)).toHaveLength(3)
  })

  it('region scope uses the stored region, else the country/province default', () => {
    const uk = ecclesiasInScope({ scope: 'region', scopeValue: 'uk' }, ECCLESIAS)
    expect(uk.map((e) => e.name)).toEqual(['London Ecclesia'])
    const east = ecclesiasInScope({ scope: 'region', scopeValue: 'canada_east' }, ECCLESIAS)
    expect(east.map((e) => e.name)).toEqual(['Toronto East Ecclesia', 'Cambridge Ecclesia'])
  })
})

describe('eligiblePeopleForList', () => {
  it('people of the in-scope ecclesias, primary address lower-cased, deceased and address-less left out', async () => {
    const people = await eligiblePeopleForList(
      { scope: 'ecclesia', scopeValue: 'toronto-east-ecclesia' },
      {
        listEcclesias: async () => ECCLESIAS,
        peopleOfEcclesia: async (name) =>
          name === 'Toronto East Ecclesia'
            ? [
                { personId: 'p1', primaryEmail: 'One@Example.org', role: 'member' },
                { personId: 'p2', primaryEmail: 'two@example.org', role: 'deceased' },
                { personId: 'p3', primaryEmail: '', role: 'member' },
              ]
            : [{ personId: 'p9', primaryEmail: 'other@example.org', role: 'member' }],
      }
    )
    expect(people).toEqual([{ personId: 'p1', email: 'one@example.org' }])
    expect(isDefaultEligiblePerson({ role: 'deceased', primaryEmail: 'x@example.org' })).toBe(false)
  })
})

describe('defaultOptInCandidates (pure)', () => {
  const eligible = [
    { personId: 'p1', email: 'one@example.org' },
    { personId: 'p2', email: 'two@example.org' },
    { personId: 'p3', email: 'shared@example.org' },
    { personId: 'p4', email: 'four@example.org' },
  ]
  it('only people with NO row on the list, and never an address someone opted out of', () => {
    const rows = [
      { personId: 'p2', email: 'two-other@example.org', status: 'opt_out' as const }, // p2 chose (any address)
      { personId: 'p7', email: 'shared@example.org', status: 'opt_out' as const }, // household opt-out
      { personId: 'p4', email: 'four@example.org', status: 'opt_in' as const }, // already explicit
    ]
    expect(defaultOptInCandidates(eligible, rows)).toEqual([{ personId: 'p1', email: 'one@example.org', emailId: '' }])
  })
})

describe('resolveListRecipients with defaultOptIn', () => {
  const baseDeps = (o: Partial<ResolveDeps> = {}): ResolveDeps => ({
    listSubscribers: vi.fn(async () => [{ email: 'explicit@example.org', personId: 'pX', emailId: 'eX' }]),
    getEmailsForPerson: vi.fn(async (personId: string) =>
      personId === 'pX'
        ? [{ emailId: 'eX', verified: true, email: 'explicit@example.org' }]
        : personId === 'p1'
          ? [{ emailId: 'e1', verified: true, email: 'one@example.org' }]
          : [{ emailId: 'e2', verified: false, email: 'unverified@example.org' }]
    ),
    getSuppressed: vi.fn(async () => new Set<string>()),
    listAllRows: vi.fn(async () => [{ email: 'explicit@example.org', personId: 'pX', status: 'opt_in' as const }]),
    eligiblePeople: vi.fn(async () => [
      { personId: 'p1', email: 'one@example.org' },
      { personId: 'p2', email: 'unverified@example.org' },
      { personId: 'pX', email: 'explicit@example.org' },
    ]),
    ...o,
  })
  const list = { listId: 'L1', defaultOptIn: true, scope: 'ecclesia' as const, scopeValue: 'toronto-east-ecclesia' }

  it('adds eligible people with no row, filtered like everyone else (unverified dropped)', async () => {
    const res = await resolveListRecipients(list, baseDeps())
    expect(res.recipients.map((r) => r.email).sort()).toEqual(['explicit@example.org', 'one@example.org'])
    expect(res.recipients.find((r) => r.email === 'one@example.org')?.emailId).toBe('e1')
    expect(res.stats.defaultOptIn).toBe(2)
  })

  it('defaultOptIn false (or a bare listId): no default candidates and the extra reads never happen', async () => {
    const d = baseDeps()
    const res = await resolveListRecipients({ ...list, defaultOptIn: false }, d)
    expect(res.recipients.map((r) => r.email)).toEqual(['explicit@example.org'])
    expect(d.eligiblePeople).not.toHaveBeenCalled()
    await resolveListRecipients('L1', d)
    expect(d.listAllRows).not.toHaveBeenCalled()
  })
})

describe('preferences: a defaultOptIn list shows as subscribed until the person chooses', () => {
  const l = (o: Partial<MailingListRecord>) =>
    ({
      listId: 'L1',
      ownerType: 'ecclesia',
      ownerId: 'cambridge-ecclesia',
      category: 'newsletters',
      status: 'active',
      name: 'Memorial Recap',
      description: '',
      defaultOptIn: true,
      ...o,
    }) as MailingListRecord

  it('no row + offered → subscribed; an opt_out row → not subscribed', () => {
    const show = (registryStatus: Map<string, 'opt_in' | 'opt_out'>) =>
      buildListPreferences({
        allLists: [l({})],
        offeredIds: new Set(['L1']),
        registryStatus,
        ownerName: () => 'Cambridge Ecclesia',
      })[0].lists[0].subscribed
    expect(show(new Map())).toBe(true)
    expect(show(new Map([['L1', 'opt_out']]))).toBe(false)
  })

  it('leaving a defaultOptIn list with no row writes an explicit opt_out row', async () => {
    const subscribe = vi.fn()
    const deps: SetSubscriptionDeps = {
      getByEmail: vi.fn(async () => ({ personId: 'p1' }) as any),
      getAllPersonsByEmail: vi.fn(async () => []),
      getEmails: vi.fn(async () => [{ emailId: 'e1', email: 'one@example.org' }]),
      getListSubscriptionsForEmail: vi.fn(async () => []),
      setSubscriptionStatus: vi.fn(),
      subscribe,
    }
    expect(
      await setListSubscription({ listId: 'L1', email: 'one@example.org', subscribed: false, defaultOptIn: true }, deps)
    ).toBe('unsubscribed')
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ listId: 'L1', status: 'opt_out', source: 'self' }))
  })
})
