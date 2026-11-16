import { describe, expect, it } from 'vitest'
import {
  addressFirstName,
  addressFullName,
  addressLastName,
  hasPreferredName,
} from '@my/app/utils/preferred-name'

describe('preferred name for addressing a person (#334)', () => {
  const legal = { firstName: 'Benjamin', lastName: 'Sample' }

  it('uses the legal name when no preferred name is set', () => {
    expect(hasPreferredName(legal)).toBe(false)
    expect(addressFirstName(legal)).toBe('Benjamin')
    expect(addressFullName(legal)).toBe('Benjamin Sample')
  })

  it('a preferred first name alone keeps the legal last name', () => {
    const p = { ...legal, preferredFirstName: 'Ben', preferredLastName: '' }
    expect(hasPreferredName(p)).toBe(true)
    expect(addressFirstName(p)).toBe('Ben')
    expect(addressLastName(p)).toBe('Sample')
    expect(addressFullName(p)).toBe('Ben Sample')
  })

  it('a preferred last name alone keeps the legal first name', () => {
    expect(addressFullName({ ...legal, preferredLastName: 'Sampson' })).toBe('Benjamin Sampson')
  })

  it('whitespace-only preferred names count as not set', () => {
    const p = { ...legal, preferredFirstName: '  ', preferredLastName: ' ' }
    expect(hasPreferredName(p)).toBe(false)
    expect(addressFullName(p)).toBe('Benjamin Sample')
  })

  it('no person, or a person with no last name, still gives a sensible name', () => {
    expect(addressFullName(null)).toBe('')
    expect(addressFirstName(undefined)).toBe('')
    expect(addressFullName({ firstName: 'Ruth', lastName: '' })).toBe('Ruth')
  })
})
