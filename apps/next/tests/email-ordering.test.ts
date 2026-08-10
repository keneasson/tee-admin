import { describe, it, expect } from 'vitest'
import { moveEmailToFront } from '@my/ui/src/profile/email-ordering'

/**
 * "Set as preferred" == move the chosen address to index 0, then PUT the whole
 * ordered set. These cover the pure ordering helper that model relies on.
 */
describe('moveEmailToFront', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('moves a middle item to the front, preserving relative order of the rest', () => {
    expect(moveEmailToFront(list, 'c').map((e) => e.id)).toEqual(['c', 'a', 'b'])
    expect(moveEmailToFront(list, 'b').map((e) => e.id)).toEqual(['b', 'a', 'c'])
  })

  it('is a no-op (new array) when the item is already first', () => {
    const out = moveEmailToFront(list, 'a')
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(list) // returns a copy, never mutates input
  })

  it('returns a copy unchanged when the id is not found', () => {
    const out = moveEmailToFront(list, 'zzz')
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(list)
  })

  it('does not mutate the input array', () => {
    const input = [{ id: 'x' }, { id: 'y' }]
    moveEmailToFront(input, 'y')
    expect(input.map((e) => e.id)).toEqual(['x', 'y'])
  })
})
