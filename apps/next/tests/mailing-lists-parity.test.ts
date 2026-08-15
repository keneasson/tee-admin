import { describe, it, expect } from 'vitest'

import { computeParityDiff } from '../utils/mailing-lists/parity'

describe('computeParityDiff', () => {
  it('reports matched + each side-only set for overlapping lists', () => {
    const ses = ['a@x.com', 'b@x.com', 'c@x.com']
    const inHouse = ['b@x.com', 'c@x.com', 'd@x.com']
    const diff = computeParityDiff(ses, inHouse)
    expect(diff.matched).toBe(2)
    expect(diff.inSesNotInHouse).toEqual(['a@x.com'])
    expect(diff.inHouseNotInSes).toEqual(['d@x.com'])
    expect(diff.sesTotal).toBe(3)
    expect(diff.inHouseTotal).toBe(3)
  })

  it('is case-insensitive and de-dupes both sides before diffing', () => {
    const ses = ['A@x.com', 'a@x.com', 'B@x.com']
    const inHouse = ['a@x.com', 'b@X.com']
    const diff = computeParityDiff(ses, inHouse)
    expect(diff.matched).toBe(2)
    expect(diff.inSesNotInHouse).toEqual([])
    expect(diff.inHouseNotInSes).toEqual([])
    expect(diff.sesTotal).toBe(2)
    expect(diff.inHouseTotal).toBe(2)
  })

  it('empty in-house side (pre-backfill) puts everyone in inSesNotInHouse', () => {
    const ses = ['a@x.com', 'b@x.com']
    const diff = computeParityDiff(ses, [])
    expect(diff.matched).toBe(0)
    expect(diff.inSesNotInHouse).toEqual(['a@x.com', 'b@x.com'])
    expect(diff.inHouseNotInSes).toEqual([])
    expect(diff.inHouseTotal).toBe(0)
  })

  it('perfect parity yields empty diff arrays', () => {
    const diff = computeParityDiff(['a@x.com', 'b@x.com'], ['b@x.com', 'a@x.com'])
    expect(diff.matched).toBe(2)
    expect(diff.inSesNotInHouse).toEqual([])
    expect(diff.inHouseNotInSes).toEqual([])
  })
})
