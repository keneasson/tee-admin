import { describe, it, expect } from 'vitest'
import {
  toDirectoryPerson,
  resolveNames,
} from '@my/app/utils/name-resolver-directory'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import type { DirectoryPerson } from '@my/app/utils/name-resolver'

// Real-shaped PersonRecord fixture (only the fields the adapter reads matter,
// but we include the full key set to stay honest about the record shape).
function personRecord(over: Partial<PersonRecord> & Pick<PersonRecord, 'personId' | 'firstName' | 'lastName' | 'ecclesia'>): PersonRecord {
  const { personId, firstName, lastName, ecclesia } = over
  return {
    pkey: `PERSON#${personId}`,
    skey: 'PROFILE',
    gsi1pk: `EMAIL#${firstName}.${lastName}@example.com`.toLowerCase(),
    gsi1sk: 'PERSON',
    gsi2pk: `ECCLESIA#${ecclesia}`,
    gsi2sk: `${lastName}#${firstName}#${personId}`.toLowerCase(),
    gsi3pk: `NAME#${lastName}`.toLowerCase(),
    gsi3sk: `${firstName}#${personId}`.toLowerCase(),
    primaryEmail: `${firstName}.${lastName}@example.com`.toLowerCase(),
    displayName: `${firstName} ${lastName}`,
    memberStatus: 'member' as PersonRecord['memberStatus'],
    ...over,
  } as PersonRecord
}

const records: PersonRecord[] = [
  personRecord({ personId: 'p1', firstName: 'Ken', lastName: 'Example', ecclesia: 'Toronto East' }),
  personRecord({ personId: 'p2', firstName: 'Alan', lastName: 'Mockup', ecclesia: 'Greenaway Hamilton' }),
  personRecord({ personId: 'p3', firstName: 'Brad', lastName: 'Tester', ecclesia: 'Toronto East' }),
  personRecord({ personId: 'p4', firstName: 'John', lastName: 'Smith', ecclesia: 'Toronto East' }),
  personRecord({ personId: 'p5', firstName: 'John', lastName: 'Smith', ecclesia: 'Toronto West' }),
]

describe('toDirectoryPerson', () => {
  it('projects a PersonRecord down to the minimal DirectoryPerson shape', () => {
    const dp = toDirectoryPerson(records[0])
    expect(dp).toEqual({
      personId: 'p1',
      firstName: 'Ken',
      lastName: 'Example',
      ecclesia: 'Toronto East',
      displayName: 'Ken Example',
    })
    // Must not leak auth/PII fields from the record.
    expect((dp as unknown as Record<string, unknown>).primaryEmail).toBeUndefined()
    expect((dp as unknown as Record<string, unknown>).hashedPassword).toBeUndefined()
  })
})

describe('resolveNames', () => {
  const candidates: DirectoryPerson[] = records.map(toDirectoryPerson)

  it('groups matched / typo / ambiguous / not-found across a batch', () => {
    const names = [
      'Brad Tester', // exact -> matched
      'Bro. Alan Mockup', // honorific + visitor -> matched
      'kent example', // typo -> Ken Example
      'John Smith', // ambiguous -> p4/p5
      'Zebediah Nomatchson', // not-found (visitor to add)
    ]
    const r = resolveNames(names, candidates)

    expect(r.matched.map((m) => m.person.personId).sort()).toEqual(['p2', 'p3'])
    expect(r.typos).toHaveLength(1)
    expect(r.typos[0].suggestions[0].person.personId).toBe('p1')
    expect(r.ambiguous).toHaveLength(1)
    expect(r.ambiguous[0].candidates.map((c) => c.personId).sort()).toEqual(['p4', 'p5'])
    expect(r.notFound.map((n) => n.input)).toEqual(['Zebediah Nomatchson'])
  })

  it('dedupes repeated names and skips placeholders + blanks', () => {
    const names = ['Brad Tester', 'Brad Tester', 'BRAD TESTER', 'TBD', '', '   ', 'attendees']
    const r = resolveNames(names, candidates)
    expect(r.matched).toHaveLength(1)
    expect(r.matched[0].person.personId).toBe('p3')
    expect(r.typos).toHaveLength(0)
    expect(r.ambiguous).toHaveLength(0)
    expect(r.notFound).toHaveLength(0)
  })

  it('keeps the first raw spelling of a deduped name as the reported input', () => {
    const r = resolveNames(['Zebediah Nomatchson', 'zebediah nomatchson'], candidates)
    expect(r.notFound).toHaveLength(1)
    expect(r.notFound[0].input).toBe('Zebediah Nomatchson')
  })
})
