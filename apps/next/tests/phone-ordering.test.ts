import { describe, it, expect } from 'vitest'
import { movePhoneToFront } from '@my/ui/src/profile/phone-ordering'
import type { PhoneEntry } from '@my/ui/src/profile/phone-manager'

/**
 * "Set as preferred" == move the chosen number to index 0, then PUT the whole
 * ordered set. These cover the pure ordering helper that model relies on.
 */
describe('movePhoneToFront', () => {
  const list: PhoneEntry[] = [
    { id: 'a', type: 'mobile', number: '1111111111' },
    { id: 'b', type: 'home', number: '2222222222' },
    { id: 'c', type: 'work', number: '3333333333' },
  ]

  it('moves a middle item to the front, preserving relative order of the rest', () => {
    expect(movePhoneToFront(list, 'c').map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(movePhoneToFront(list, 'b').map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('is a no-op (new array) when the item is already first', () => {
    const out = movePhoneToFront(list, 'a')
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(list) // returns a copy, never mutates input
  })

  it('returns a copy unchanged when the id is not found', () => {
    const out = movePhoneToFront(list, 'zzz')
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(list)
  })

  it('does not mutate the input array', () => {
    const input: PhoneEntry[] = [
      { id: 'x', type: 'mobile', number: '4444444444' },
      { id: 'y', type: 'other', number: '5555555555' },
    ]
    movePhoneToFront(input, 'y')
    expect(input.map((p) => p.id)).toEqual(['x', 'y'])
  })
})
