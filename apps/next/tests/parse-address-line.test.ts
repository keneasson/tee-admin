import { describe, it, expect } from 'vitest'
import { parseAddressLine } from '@my/app/utils/parse-address-line'

/**
 * The address that broke the directory. It is complete and correctly written —
 * the form simply had nowhere to put it, because province and city were only
 * ever set by the Google Places callback, and Places is unconfigured in
 * production and fails silently.
 */
describe('parseAddressLine — the Grand River case', () => {
  it('parses "51 William St, Paris, ON N3L 1L2" fully', () => {
    expect(parseAddressLine('51 William St, Paris, ON N3L 1L2')).toEqual({
      streetAddress: '51 William St',
      city: 'Paris',
      province: 'ON',
      postalCode: 'N3L 1L2',
      country: 'CA',
    })
  })

  it('accepts the province spelled out, and a separated postal code', () => {
    expect(parseAddressLine('51 William St, Paris, Ontario, N3L 1L2')).toMatchObject({
      city: 'Paris',
      province: 'ON',
      postalCode: 'N3L 1L2',
    })
  })

  it('handles a postal code with no space', () => {
    expect(parseAddressLine('1 Main St, Barrie, ON L4M3A1').postalCode).toBe('L4M 3A1')
  })

  it('handles city and province glued together', () => {
    expect(parseAddressLine('Paris ON')).toMatchObject({ city: 'Paris', province: 'ON' })
  })

  it('handles just city and province', () => {
    expect(parseAddressLine('Paris, ON')).toMatchObject({ city: 'Paris', province: 'ON' })
  })

  it('recognises a US ZIP', () => {
    expect(parseAddressLine('100 Broad St, Hartford, CT 06103')).toMatchObject({
      postalCode: '06103',
      country: 'US',
    })
  })
})

describe('it stays conservative rather than guessing key material', () => {
  it('leaves province unset when there is none to find', () => {
    const parsed = parseAddressLine('51 William St, Paris')
    expect(parsed.province).toBeUndefined()
    expect(parsed.city).toBe('Paris')
  })

  it('returns nothing for empty input rather than inventing fields', () => {
    expect(parseAddressLine('')).toEqual({})
    expect(parseAddressLine(undefined as unknown as string)).toEqual({})
  })

  it('never returns an empty-string province or city — they are key material', () => {
    for (const input of ['', '   ', ',,,', 'Somewhere']) {
      const p = parseAddressLine(input)
      expect(p.province ?? 'unset').not.toBe('')
      expect(p.city ?? 'unset').not.toBe('')
    }
  })
})
