import { describe, it, expect } from 'vitest'
import {
  cleanContactField,
  cleanPostalCode,
  cleanProvince,
} from '@my/app/utils/clean-contact-field'

/**
 * People paste addresses out of emails, and what arrives carries the
 * punctuation of the line it was cut from. `460 Rymal Road West, Suite 351,`
 * was stored with its trailing comma and there was no way to correct it.
 *
 * The cleaning must be minimal: a stray separator at the edge is a joiner with
 * nothing to join, but punctuation INSIDE a value is part of the address and
 * must survive.
 */
describe('a pasted value loses only what is meaningless', () => {
  it('drops the trailing comma that started all this', () => {
    expect(cleanContactField('460 Rymal Road West, Suite 351,')).toBe(
      '460 Rymal Road West, Suite 351'
    )
  })

  it('drops leading separators and surrounding whitespace', () => {
    expect(cleanContactField('  , 460 Rymal Road West ')).toBe('460 Rymal Road West')
  })

  it('collapses runs of spaces from a ragged paste', () => {
    expect(cleanContactField('Hamilton,    ON')).toBe('Hamilton,    ON'.replace(/\s{2,}/g, ' '))
    expect(cleanContactField('460   Rymal   Road')).toBe('460 Rymal Road')
  })

  it('returns undefined for something with nothing in it', () => {
    expect(cleanContactField('')).toBeUndefined()
    expect(cleanContactField('   ')).toBeUndefined()
    expect(cleanContactField(' , ')).toBeUndefined()
    expect(cleanContactField(undefined)).toBeUndefined()
    expect(cleanContactField(42)).toBeUndefined()
  })
})

describe('punctuation that is part of the address survives', () => {
  it('keeps commas and separators INSIDE the value', () => {
    expect(cleanContactField('460 Rymal Road West, Suite 351')).toBe(
      '460 Rymal Road West, Suite 351'
    )
  })

  it('keeps a rural route, a period, a hyphen and an apostrophe', () => {
    expect(cleanContactField('RR#1')).toBe('RR#1')
    expect(cleanContactField('1443 Elizabeth St.')).toBe('1443 Elizabeth St.')
    expect(cleanContactField('Unit 3-B')).toBe('Unit 3-B')
    expect(cleanContactField("12 O'Connor Drive")).toBe("12 O'Connor Drive")
  })

  it('does not reorder, re-case or expand anything', () => {
    expect(cleanContactField('460 rymal road west')).toBe('460 rymal road west')
  })
})

describe('postal code and province', () => {
  it('upper-cases a postal code and trims the comma', () => {
    expect(cleanPostalCode('l9b 0b2,')).toBe('L9B 0B2')
  })

  it('upper-cases a two-letter province but leaves a full name alone', () => {
    expect(cleanProvince('on')).toBe('ON')
    expect(cleanProvince(' on,')).toBe('ON')
    expect(cleanProvince('Ontario')).toBe('Ontario')
  })

  it('leaves a blank province undefined rather than guessing', () => {
    // Province is KEY MATERIAL — an empty one has corrupted a record before.
    // Returning undefined lets the caller reject it; inventing one would not.
    expect(cleanProvince('  ')).toBeUndefined()
  })
})
