import { describe, it, expect } from 'vitest'
import {
  normalizeName,
  isPlaceholderName,
  editDistance,
  resolveScheduleName,
  type DirectoryPerson,
} from '@my/app/utils/name-resolver'

const people: DirectoryPerson[] = [
  { personId: 'p1', firstName: 'Ken', lastName: 'Example', ecclesia: 'Toronto East' },
  { personId: 'p2', firstName: 'Alan', lastName: 'Mockup', ecclesia: 'Greenaway Hamilton' },
  { personId: 'p3', firstName: 'Brad', lastName: 'Tester', ecclesia: 'Toronto East' },
  { personId: 'p4', firstName: 'John', lastName: 'Smith', ecclesia: 'Toronto East' },
  { personId: 'p5', firstName: 'John', lastName: 'Smith', ecclesia: 'Toronto West' }, // duplicate name
]

describe('normalizeName', () => {
  it('lowercases, strips honorifics + punctuation, splits first/last', () => {
    expect(normalizeName('Bro. Alan Mockup')).toMatchObject({ first: 'alan', last: 'mockup', full: 'alan mockup' })
    expect(normalizeName('Brad Tester')).toMatchObject({ first: 'brad', last: 'tester' })
    expect(normalizeName('  Sister  Jane   Doe ')).toMatchObject({ first: 'jane', last: 'doe' })
  })
  it('handles a single name (first === last)', () => {
    expect(normalizeName('Hakime')).toMatchObject({ first: 'hakime', last: 'hakime', tokens: ['hakime'] })
  })
  it('drops a middle name for first/last but keeps all tokens', () => {
    const n = normalizeName('John Michael Smith')
    expect(n.first).toBe('john')
    expect(n.last).toBe('smith')
    expect(n.tokens).toEqual(['john', 'michael', 'smith'])
  })
})

describe('isPlaceholderName', () => {
  it('flags non-person placeholders', () => {
    expect(isPlaceholderName('TBD')).toBe(true)
    expect(isPlaceholderName('attendees')).toBe(true)
    expect(isPlaceholderName('')).toBe(true)
    expect(isPlaceholderName('  ')).toBe(true)
  })
  it('does not flag real names', () => {
    expect(isPlaceholderName('Ken Example')).toBe(false)
    expect(isPlaceholderName('Hakime')).toBe(false)
  })
})

describe('editDistance', () => {
  it('computes Levenshtein distance', () => {
    expect(editDistance('ken', 'kent')).toBe(1)
    expect(editDistance('kent example', 'ken example')).toBe(1)
    expect(editDistance('abc', 'abc')).toBe(0)
    expect(editDistance('', 'abc')).toBe(3)
  })
})

describe('resolveScheduleName', () => {
  it('exact match', () => {
    const r = resolveScheduleName('Brad Tester', people)
    expect(r.status).toBe('matched')
    if (r.status === 'matched') expect(r.person.personId).toBe('p3')
  })

  it('matches through an honorific + a visitor from another ecclesia', () => {
    const r = resolveScheduleName('Bro. Alan Mockup', people)
    expect(r.status).toBe('matched')
    if (r.status === 'matched') {
      expect(r.person.personId).toBe('p2')
      expect(r.person.ecclesia).toBe('Greenaway Hamilton')
    }
  })

  it('flags a typo with the likely person ("kent example" → Ken Example)', () => {
    const r = resolveScheduleName('kent example', people)
    expect(r.status).toBe('typo')
    if (r.status === 'typo') {
      expect(r.suggestions[0].person.personId).toBe('p1')
      expect(r.suggestions[0].distance).toBe(1)
    }
  })

  it('flags ambiguity when two people share a name', () => {
    const r = resolveScheduleName('John Smith', people)
    expect(r.status).toBe('ambiguous')
    if (r.status === 'ambiguous') expect(r.candidates.map((c) => c.personId).sort()).toEqual(['p4', 'p5'])
  })

  it('not-found for an unknown name (a visitor to add)', () => {
    expect(resolveScheduleName('Zebediah Nomatchson', people).status).toBe('not-found')
  })

  it('not-found (skip) for placeholders', () => {
    expect(resolveScheduleName('TBD', people).status).toBe('not-found')
    expect(resolveScheduleName('attendees', people).status).toBe('not-found')
    expect(resolveScheduleName('', people).status).toBe('not-found')
  })

  it('does not false-positive a real different person as a typo', () => {
    // "Brad Tester" vs "John Smith" are far apart — must not match.
    const r = resolveScheduleName('Brad Tester', [{ personId: 'x', firstName: 'John', lastName: 'Smith' }])
    expect(r.status).toBe('not-found')
  })
})
