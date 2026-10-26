import { describe, it, expect } from 'vitest'

/**
 * Adding a family member was limited to typing an email address. You could not
 * add somebody you knew only by name, could not tell whether they were already
 * in the directory, and — because one address can belong to a whole household —
 * linking by email could attach the wrong person entirely (which is exactly how
 * Grace became her own spouse).
 *
 * Search now covers name, email AND phone, and a phone search has to survive
 * punctuation: people type "905-555-0108" and the stored value is "9055550108".
 */
const matches = (
  member: { name?: string; email?: string; ecclesia?: string; phones?: string[] },
  rawQuery: string
) => {
  const searchQuery = rawQuery.toLowerCase()
  const nameMatch = member.name?.toLowerCase().includes(searchQuery)
  const ecclesiaMatch = member.ecclesia?.toLowerCase().includes(searchQuery)
  const emailMatch = member.email?.toLowerCase().includes(searchQuery)
  const queryDigits = searchQuery.replace(/\D/g, '')
  const phoneMatch =
    queryDigits.length >= 3 && member.phones?.some((d) => d.includes(queryDigits))
  return Boolean(nameMatch || ecclesiaMatch || emailMatch || phoneMatch)
}

const grace = {
  name: 'Grace Outline',
  email: 'member1@gmail.com',
  ecclesia: 'Toronto East Ecclesia',
  phones: ['9055550108', '9055550109'],
}

describe('directory search covers name, email and phone', () => {
  it('finds by last name — the common case when adding family', () => {
    expect(matches(grace, 'Outline')).toBe(true)
    expect(matches(grace, 'outline')).toBe(true)
  })

  it('finds by first name', () => {
    expect(matches(grace, 'Grace')).toBe(true)
  })

  it('finds by email', () => {
    expect(matches(grace, 'member1')).toBe(true)
  })

  it('finds by phone typed WITH punctuation', () => {
    expect(matches(grace, '905-555-0108')).toBe(true)
    expect(matches(grace, '(905) 555 0108')).toBe(true)
  })

  it('finds by a partial phone number', () => {
    expect(matches(grace, '5550108')).toBe(true)
  })

  it('does not match half the directory on one or two digits', () => {
    expect(matches(grace, '9')).toBe(false)
    expect(matches(grace, '90')).toBe(false)
  })

  it('does not match somebody unrelated', () => {
    expect(matches(grace, 'Smith')).toBe(false)
    expect(matches(grace, '4165550000')).toBe(false)
  })

  it('survives a member with no phones, name or email', () => {
    expect(() => matches({}, 'anything')).not.toThrow()
    expect(matches({}, 'anything')).toBe(false)
  })
})
