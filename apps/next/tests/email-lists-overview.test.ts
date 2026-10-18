import { describe, it, expect } from 'vitest'
import { buildEmailListsOverview, personMatches, type OverviewCardInput } from '@my/app/utils/email-lists-overview'

const topics = [
  { name: 'newsletter', displayName: 'Newsletter' },
  { name: 'memorial', displayName: 'Memorial' },
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
    expect(o.findings.sesUnsubscribedNoPerson).toBe(1)
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

  it('filters by name, ecclesia or address', () => {
    const [p] = build().people
    expect(personMatches(p, 'exam')).toBe(true)
    expect(personMatches(p, 'toronto')).toBe(true)
    expect(personMatches(p, 'home@')).toBe(true)
    expect(personMatches(p, 'zzz')).toBe(false)
  })
})
