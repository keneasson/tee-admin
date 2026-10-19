import { describe, it, expect } from 'vitest'
import { buildEmailListsOverview, personMatches, type OverviewCardInput } from '@my/app/utils/email-lists-overview'

const topics = [
  { name: 'newsletter', displayName: 'Newsletter', defaultOptIn: true },
  { name: 'memorial', displayName: 'Memorial', defaultOptIn: false },
]

// A household: two people, one shared inbox (the #267 shape). Fake addresses.
const husband: OverviewCardInput = {
  personId: 'p-husband',
  displayName: 'Dan Example',
  firstName: 'Dan',
  lastName: 'Example',
  ecclesia: 'Toronto East Ecclesia',
  primaryEmail: 'home@example.org',
  emails: [
    { email: 'home@example.org', emailType: 'primary', order: 0, sesStatus: 'active', loginExcluded: true },
    { email: 'dan.work@example.org', emailType: 'archived', order: 1, sesStatus: 'bounced' },
  ],
}
const wife: OverviewCardInput = {
  personId: 'p-wife',
  displayName: 'Rae Example',
  firstName: 'Rae',
  lastName: 'Example',
  ecclesia: 'Toronto East Ecclesia',
  primaryEmail: 'home@example.org',
  emails: [{ email: 'Home@Example.org', emailType: 'primary', order: 0, sesStatus: 'active' }],
}
const loner: OverviewCardInput = {
  personId: 'p-loner',
  displayName: 'Lou Other',
  firstName: 'Lou',
  lastName: 'Other',
  ecclesia: 'Guelph Ecclesia',
  primaryEmail: 'lou@example.org',
  emails: [{ email: 'lou@example.org', emailType: 'primary', order: 0, sesStatus: 'active' }],
}

function build() {
  return buildEmailListsOverview({
    cards: [husband, wife, loner],
    sesContacts: [
      { email: 'home@example.org', topics: { newsletter: 'OPT_IN', memorial: 'OPT_OUT' } },
      { email: 'stranger@example.org', topics: { newsletter: 'OPT_IN' } },
      { email: 'gone@example.org', topics: { newsletter: 'OPT_OUT' } },
      { email: 'Case@Example.org', topics: { memorial: 'OPT_IN' } },
      { email: 'case@example.org', topics: {} },
      // No explicit preferences: "subscribed" only via the topic default.
      { email: 'defaults@example.org', topics: {} },
      { email: 'quit@example.org', topics: {}, unsubscribeAll: true },
    ],
    suppressed: [{ email: 'LOU@example.org', reason: 'BOUNCE' }],
    topics,
    now: new Date('2026-10-17T00:00:00Z'),
  })
}

describe('Email Lists overview (PersonRecords only)', () => {
  it('gives one card per PERSON; a shared household address shows on each holder, no phantom person', () => {
    const o = build()
    // Sorted by last, then first name.
    expect(o.people.map((p) => p.personId)).toEqual(['p-husband', 'p-wife', 'p-loner'])
    expect(o.counts.people).toBe(3)
    const h = o.people.find((p) => p.personId === 'p-husband')!
    const w = o.people.find((p) => p.personId === 'p-wife')!
    expect(h.emails.find((e) => e.email === 'home@example.org')?.sharedWith).toEqual(['p-wife'])
    expect(w.emails.find((e) => e.email === 'home@example.org')?.sharedWith).toEqual(['p-husband'])
    expect(o.findings.sharedAddresses).toEqual([{ email: 'home@example.org', personIds: ['p-husband', 'p-wife'] }])
    // Both see the SES subscription of the inbox they share.
    expect(h.emails[0].ses.topics).toEqual({ newsletter: true, memorial: false })
    expect(w.emails[0].ses.topics).toEqual({ newsletter: true, memorial: false })
  })

  it('reports SES contacts no person holds — subscribed ones as findings', () => {
    const o = build()
    expect(o.findings.sesSubscribedNoPerson).toEqual([
      { email: 'case@example.org', topics: ['memorial'], suppressed: undefined },
      { email: 'stranger@example.org', topics: ['newsletter'], suppressed: undefined },
    ])
    expect(o.findings.sesUnsubscribedNoPerson).toBe(3)
  })

  it('reports letter-case duplicate SES contacts', () => {
    expect(build().findings.sesCaseDuplicates).toEqual([{ email: 'case@example.org', variants: ['Case@Example.org', 'case@example.org'] }])
  })

  it('reports a suppressed address still marked active on the person', () => {
    const o = build()
    expect(o.findings.suppressedButMarkedActive).toEqual([{ email: 'lou@example.org', reason: 'BOUNCE', personIds: ['p-loner'] }])
    const lou = o.people.find((p) => p.personId === 'p-loner')!
    expect(lou.emails[0].flags).toEqual(expect.arrayContaining(['suppressed', 'suppressed-but-marked-active', 'not-in-ses']))
    expect(lou.findingCount).toBe(2)
  })

  it('keeps bounced/archived status visible but does not flag an archived address as missing from SES', () => {
    const h = build().people.find((p) => p.personId === 'p-husband')!
    const work = h.emails.find((e) => e.email === 'dan.work@example.org')!
    expect(work.archived).toBe(true)
    expect(work.personSesStatus).toBe('bounced')
    expect(work.flags).toEqual(['bounced-on-person'])
    expect(build().findings.personEmailNotInSes).toEqual([{ email: 'lou@example.org', personIds: ['p-loner'] }])
  })

  it('counts only EXPLICIT opt-ins as subscribed (as the send path does); no preference = receives nothing', () => {
    // The send path filters with UseDefaultIfPreferenceUnavailable: false.
    expect(build().findings.sesNoExplicitPreference).toEqual([
      { email: 'defaults@example.org', personIds: [] },
    ])
    expect(build().findings.sesSubscribedNoPerson.map((x) => x.email)).not.toContain('defaults@example.org')
    const o = buildEmailListsOverview({
      cards: [loner],
      sesContacts: [{ email: 'lou@example.org', topics: {} }],
      suppressed: [],
      topics,
    })
    expect(o.findings.sesNoExplicitPreference).toEqual([{ email: 'lou@example.org', personIds: ['p-loner'] }])
    expect(o.people[0].emails[0].flags).toContain('no-explicit-preference')
    expect(o.people[0].emails[0].ses).toMatchObject({ inSes: true, noExplicitPreference: true, topics: { newsletter: false, memorial: false } })
    // A state, not a problem to fix.
    expect(o.people[0].findingCount).toBe(0)
  })

  it('filters by name, ecclesia or address', () => {
    const [p] = build().people
    expect(personMatches(p, 'exam')).toBe(true)
    expect(personMatches(p, 'toronto')).toBe(true)
    expect(personMatches(p, 'home@')).toBe(true)
    expect(personMatches(p, 'zzz')).toBe(false)
  })
})

describe('Email Lists overview — registry source (R5)', () => {
  const lists = [
    { name: 'L-NEWS', displayName: 'Toronto East Newsletter', defaultOptIn: false },
    { name: 'L-MEM', displayName: 'Toronto East Memorial Recap', defaultOptIn: false },
  ]
  const buildRegistry = () =>
    buildEmailListsOverview({
      cards: [husband, wife, loner],
      sesContacts: [
        // Legacy topic prefs are ignored; the safety-net opt-out is not.
        { email: 'home@example.org', topics: { memorial: 'OPT_IN' } },
        { email: 'lou@example.org', topics: { safetyNetDefault: 'OPT_OUT' } },
        { email: 'Case@Example.org', topics: {} },
        { email: 'case@example.org', topics: {} },
      ],
      suppressed: [],
      topics: lists,
      subscriptionSource: 'registry',
      subscriptions: { 'home@example.org': ['L-NEWS'], 'ghost@example.org': ['L-MEM'] },
      safetyNetTopics: ['safetyNetDefault'],
    })

  it('subscription columns come from the registry, not from SES topic preferences', () => {
    const o = buildRegistry()
    const home = o.people.find((p) => p.personId === 'p-husband')!.emails.find((e) => e.email === 'home@example.org')!
    expect(home.ses.topics).toEqual({ 'L-NEWS': true, 'L-MEM': false })
    expect(home.flags).not.toContain('no-explicit-preference')
  })

  it('no "not in SES" / "no explicit preference" findings: SES topics no longer decide', () => {
    const o = buildRegistry()
    expect(o.findings.personEmailNotInSes).toEqual([])
    expect(o.findings.sesNoExplicitPreference).toEqual([])
    expect(o.people.flatMap((p) => p.emails.flatMap((e) => e.flags))).not.toContain('not-in-ses')
  })

  it('flags a safety-net opt-out, still reports case duplicates, and a subscribed address no person holds', () => {
    const o = buildRegistry()
    const lou = o.people.find((p) => p.personId === 'p-loner')!.emails[0]
    expect(lou.flags).toContain('safety-net-opt-out')
    expect(o.findings.sesCaseDuplicates.map((d) => d.email)).toEqual(['case@example.org'])
    expect(o.findings.sesSubscribedNoPerson).toEqual([
      { email: 'ghost@example.org', topics: ['Toronto East Memorial Recap'], suppressed: undefined },
    ])
  })
})
