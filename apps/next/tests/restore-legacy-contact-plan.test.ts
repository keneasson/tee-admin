import { describe, it, expect } from 'vitest'

import {
  affectedPersonIds,
  chooseLegacyPhone,
  matchLegacyRow,
  buildPersonIndex,
  parseLegacyAddress,
  planRestore,
  splitLegacyEmails,
  type LegacyDirectoryRow,
  type PersonSnapshot,
} from '../utils/people/restore-legacy-contact-plan'

// Fictional data only (example.org, invented streets and numbers).

describe('parseLegacyAddress', () => {
  it('keeps a city and province alone as a partial address (street and postal code to come)', () => {
    expect(parseLegacyAddress('Windsor, ON')).toEqual({
      street1: '',
      city: 'Windsor',
      province: 'ON',
      postalCode: '',
      country: 'Canada',
    })
  })

  it('parses "<street>\\n<City>, <PROV> <POSTAL>"', () => {
    expect(parseLegacyAddress('12 Example Street \nBrampton, ON L6X 1A1')).toEqual({
      street1: '12 Example Street',
      city: 'Brampton',
      province: 'ON',
      postalCode: 'L6X 1A1',
      country: 'Canada',
    })
  })

  it('normalizes a postal code with no space and lower case', () => {
    expect(parseLegacyAddress('5 Sample Rd. \nOakville,on l6h2b2')?.postalCode).toBe('L6H 2B2')
  })

  it('keeps extra street lines as street2', () => {
    expect(parseLegacyAddress('1000 Test Avenue \nPH#2 \nMississauga, ON L5B 3C3')).toMatchObject({
      street1: '1000 Test Avenue',
      street2: 'PH#2',
      city: 'Mississauga',
    })
  })

  it('parses a multi-word city', () => {
    expect(parseLegacyAddress('9 Fake Cres. \nRichmond Hill, ON L4C 0A0')?.city).toBe('Richmond Hill')
  })

  it('parses a US address with a trailing country line or suffix', () => {
    expect(parseLegacyAddress('1234 NE 100th Place \nSalem, OR 97301 \nUSA')).toEqual({
      street1: '1234 NE 100th Place',
      city: 'Salem',
      province: 'OR',
      postalCode: '97301',
      country: 'USA',
    })
    expect(parseLegacyAddress('42 Elm Lane \nAustin, TX 73301, U.S.A.')?.country).toBe('USA')
  })

  it('returns null for anything that does not parse cleanly', () => {
    expect(parseLegacyAddress('')).toBeNull()
    expect(parseLegacyAddress(null)).toBeNull()
    expect(parseLegacyAddress('Toronto, ZZ')).toBeNull() // city only, not a province
    expect(parseLegacyAddress('12 Example St, Toronto, ON')).toBeNull() // fused street, no postal code
    expect(parseLegacyAddress('12 Example St, Unit 4 Toronto, ON M1M 1M1')).toBeNull() // city fused into one line
    expect(parseLegacyAddress('P.O. Box 1234 \nSomewhere, Elsewhere \nFar Away')).toBeNull()
    expect(parseLegacyAddress('12 Example St \nToronto, ZZ M1M 1M1')).toBeNull() // not a province
    expect(parseLegacyAddress('12 Example St \nToronto, ON M1M 1M1 \nUSA')).toBeNull() // CA locality + US country
  })
})

describe('chooseLegacyPhone', () => {
  it('takes a single plain number as the home phone (digits only)', () => {
    expect(chooseLegacyPhone('416-555-0101')).toEqual({ number: '4165550101', type: 'home' })
    expect(chooseLegacyPhone('1-905-555-0102')).toEqual({ number: '9055550102', type: 'home' })
    expect(chooseLegacyPhone('416-555- 0103')).toEqual({ number: '4165550103', type: 'home' })
  })

  it('prefers the first unlabelled number over labelled cells', () => {
    expect(chooseLegacyPhone('416-555-0101 \nAlex (C) 647-555-0102', 'Alex')).toEqual({
      number: '4165550101',
      type: 'home',
    })
  })

  it('takes the number labelled with the person\'s first name', () => {
    const raw = 'Alex (C) 647-555-0102 Sam (C) 647-555-0103'
    expect(chooseLegacyPhone(raw, 'Sam')).toEqual({ number: '6475550103', type: 'mobile' })
    expect(chooseLegacyPhone('Alex 905-555-0104 \nSam 905-555-0105', 'Alex')).toEqual({
      number: '9055550104',
      type: 'home',
    })
  })

  it('marks a cell-only number as mobile', () => {
    expect(chooseLegacyPhone('(C) 416-555-0106')).toEqual({ number: '4165550106', type: 'mobile' })
    expect(chooseLegacyPhone('416-555-0107 (C) \n416-555-0108 (C)')).toEqual({ number: '4165550107', type: 'mobile' })
  })

  it('ignores annotation lines and dates', () => {
    expect(chooseLegacyPhone('416-555-0109 \n(address updated 2020-12-03)')).toEqual({
      number: '4165550109',
      type: 'home',
    })
  })

  it('returns null when it cannot tell which number is theirs', () => {
    expect(chooseLegacyPhone('Alex (C) 647-555-0102 Sam (C) 647-555-0103', 'Jordan')).toBeNull()
    expect(chooseLegacyPhone('Work: 416-555-0110')).toBeNull()
    expect(chooseLegacyPhone('call the office')).toBeNull()
    expect(chooseLegacyPhone('')).toBeNull()
  })
})

describe('splitLegacyEmails', () => {
  it('splits on newlines, semicolons and spaces, lower-cases and dedupes', () => {
    expect(splitLegacyEmails('\nA@Example.org \nb@example.org;a@example.org')).toEqual([
      'a@example.org',
      'b@example.org',
    ])
    expect(splitLegacyEmails('')).toEqual([])
  })
})

const person = (over: Partial<PersonSnapshot> & { personId: string }): PersonSnapshot => ({
  firstName: 'First',
  lastName: 'Last',
  emails: [],
  addressCount: 0,
  phoneCount: 0,
  ...over,
})

describe('matchLegacyRow', () => {
  const people = [
    person({ personId: 'p-alex', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org'] }),
    person({ personId: 'p-sam', firstName: 'Sam', lastName: 'Sample', emails: ['shared@example.org'] }),
    person({ personId: 'p-pat', firstName: 'Pat', lastName: 'Sample', emails: ['shared@example.org'] }),
    person({ personId: 'p-jo1', firstName: 'Jo', lastName: 'Twin', emails: ['jo1@example.org'] }),
    person({ personId: 'p-jo2', firstName: 'Jo', lastName: 'Twin', emails: ['jo2@example.org'] }),
    person({ personId: 'p-rene', firstName: 'René', lastName: 'Example', emails: [] }),
  ]
  const index = buildPersonIndex(people)

  it('matches by email when exactly one person holds it (case-insensitive)', () => {
    expect(matchLegacyRow({ sk: 'x', email: 'ALEX@example.org', firstName: 'Alex', lastName: 'Sample' }, index)).toEqual({
      kind: 'matched',
      personId: 'p-alex',
      by: 'email',
    })
  })

  it('falls back to an exact normalized name when the email is shared', () => {
    expect(matchLegacyRow({ sk: 'x', email: 'shared@example.org', firstName: ' pat ', lastName: 'SAMPLE' }, index)).toEqual({
      kind: 'matched',
      personId: 'p-pat',
      by: 'name',
    })
  })

  it('matches by name with no email, ignoring accents', () => {
    expect(matchLegacyRow({ sk: 'x', email: '', firstName: 'Rene', lastName: 'Example' }, index)).toMatchObject({
      kind: 'matched',
      personId: 'p-rene',
    })
  })

  it('lists a shared email with no unique name', () => {
    expect(matchLegacyRow({ sk: 'x', email: 'shared@example.org', firstName: 'Lee', lastName: 'Other' }, index)).toEqual({
      kind: 'ambiguous',
      reason: 'email-held-by-several',
    })
  })

  it('lists a name held by several people', () => {
    expect(matchLegacyRow({ sk: 'x', email: 'nobody@example.org', firstName: 'Jo', lastName: 'Twin' }, index)).toEqual({
      kind: 'ambiguous',
      reason: 'name-held-by-several',
    })
  })

  it('gives a row written with a relative\'s inbox (same last name) to the NAMED person', () => {
    // alex@ is held only by Alex Sample; the row is Sam Sample's entry.
    expect(matchLegacyRow({ sk: 'x', email: 'alex@example.org', firstName: 'Sam', lastName: 'Sample' }, index)).toEqual({
      kind: 'matched',
      personId: 'p-sam',
      by: 'name',
    })
  })

  it('lists a row whose email and name point at different, unrelated people', () => {
    expect(matchLegacyRow({ sk: 'x', email: 'alex@example.org', firstName: 'Rene', lastName: 'Example' }, index)).toEqual({
      kind: 'ambiguous',
      reason: 'email-and-name-disagree',
    })
    // shared email held by Sam + Pat, but the name is a third person
    expect(matchLegacyRow({ sk: 'x', email: 'shared@example.org', firstName: 'Alex', lastName: 'Sample' }, index)).toEqual({
      kind: 'ambiguous',
      reason: 'email-and-name-disagree',
    })
  })

  it('reports no match', () => {
    expect(matchLegacyRow({ sk: 'x', email: 'new@example.org', firstName: 'New', lastName: 'Person' }, index)).toEqual({
      kind: 'no-match',
    })
  })
})

describe('planRestore', () => {
  const ADDR = '12 Example Street \nBrampton, ON L6X 1A1'
  const row = (over: Partial<LegacyDirectoryRow>): LegacyDirectoryRow => ({
    sk: 'USER#x#1',
    firstName: 'Alex',
    lastName: 'Sample',
    email: 'alex@example.org',
    address: ADDR,
    phone: '905-555-0101',
    ...over,
  })

  it('adds an address and a phone to a person who has neither', () => {
    const plan = planRestore([row({})], [person({ personId: 'p1', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org'] })])
    expect(plan.addresses).toHaveLength(1)
    expect(plan.addresses[0]).toMatchObject({ personId: 'p1', value: { city: 'Brampton', postalCode: 'L6X 1A1' } })
    expect(plan.phones).toEqual([{ kind: 'phone', personId: 'p1', rowIndexes: [0], value: { number: '9055550101', type: 'home' } }])
    expect(plan.counts).toMatchObject({ addressesToAdd: 1, phonesToAdd: 1, peopleAffected: 1, matchedByEmail: 1 })
    expect(affectedPersonIds(plan)).toEqual(['p1'])
  })

  it('fills EMPTY only: never touches a person who already has an address or phone', () => {
    const plan = planRestore(
      [row({})],
      [person({ personId: 'p1', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org'], addressCount: 1, phoneCount: 2 })]
    )
    expect(plan.addresses).toEqual([])
    expect(plan.phones).toEqual([])
    expect(plan.counts).toMatchObject({ alreadyHasAddress: 1, alreadyHasPhone: 1, peopleAffected: 0 })
  })

  it('fills only the missing field', () => {
    const plan = planRestore(
      [row({})],
      [person({ personId: 'p1', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org'], addressCount: 1 })]
    )
    expect(plan.addresses).toEqual([])
    expect(plan.phones).toHaveLength(1)
  })

  it('is idempotent: once written, a re-plan adds nothing', () => {
    const rows = [row({})]
    const before = person({ personId: 'p1', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org'] })
    const first = planRestore(rows, [before])
    expect(first.addresses.length + first.phones.length).toBe(2)
    const after = { ...before, addressCount: first.addresses.length, phoneCount: first.phones.length }
    const second = planRestore(rows, [after])
    expect(second.addresses.length + second.phones.length).toBe(0)
  })

  it('lists unparseable values and unmatched rows without writing them', () => {
    const plan = planRestore(
      [
        row({ address: 'somewhere downtown', phone: 'ask at the door' }),
        row({ sk: 'USER#y#1', email: 'ghost@example.org', firstName: 'Ghost', lastName: 'Row' }),
      ],
      [person({ personId: 'p1', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org'] })]
    )
    expect(plan.addresses).toEqual([])
    expect(plan.phones).toEqual([])
    expect(plan.counts.listedByReason).toEqual({ 'address-unparseable': 1, 'phone-unparseable': 1, 'no-match': 1 })
  })

  it('writes one value when several rows for a person agree, and lists them when they disagree', () => {
    const p = person({ personId: 'p1', firstName: 'Alex', lastName: 'Sample', emails: ['alex@example.org', 'alex2@example.org'] })
    const agree = planRestore(
      [row({}), row({ sk: 'USER#alex2#1', email: 'alex2@example.org', address: '12 Example Street\nBrampton, ON L6X1A1' })],
      [p]
    )
    expect(agree.addresses).toHaveLength(1)
    expect(agree.addresses[0]!.rowIndexes).toEqual([0, 1])

    const disagree = planRestore(
      [row({}), row({ sk: 'USER#alex2#1', email: 'alex2@example.org', address: '99 Other Road \nToronto, ON M1M 1M1', phone: '416-555-0199' })],
      [p]
    )
    expect(disagree.addresses).toEqual([])
    expect(disagree.phones).toEqual([])
    expect(disagree.counts.listedByReason).toEqual({ 'address-conflict': 2, 'phone-conflict': 2 })
  })

  it('restores a household address to the spouse who lacks it (the other already has it)', () => {
    // The shared inbox is held by both spouses; each row is matched by name.
    const plan = planRestore(
      [
        row({ firstName: 'Sam', email: 'home@example.org', phone: 'Sam (C) 647-555-0102 Pat (C) 647-555-0103' }),
        row({ sk: 'USER#home#2', firstName: 'Pat', email: 'home@example.org', phone: 'Sam (C) 647-555-0102 Pat (C) 647-555-0103' }),
      ],
      [
        person({ personId: 'p-sam', firstName: 'Sam', lastName: 'Sample', emails: ['home@example.org'] }),
        person({ personId: 'p-pat', firstName: 'Pat', lastName: 'Sample', emails: ['home@example.org'], addressCount: 1, phoneCount: 1 }),
      ]
    )
    expect(plan.addresses.map((a) => a.personId)).toEqual(['p-sam'])
    expect(plan.phones).toEqual([
      { kind: 'phone', personId: 'p-sam', rowIndexes: [0], value: { number: '6475550102', type: 'mobile' } },
    ])
    expect(plan.counts.matchedByName).toBe(2)
  })

  it('ignores rows with no address and no phone', () => {
    const plan = planRestore([row({ address: '', phone: '' })], [person({ personId: 'p1', emails: ['alex@example.org'] })])
    expect(plan.counts.rowsWithContact).toBe(0)
    expect(plan.listed).toEqual([])
  })
})
