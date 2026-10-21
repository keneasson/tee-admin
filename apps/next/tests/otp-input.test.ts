import { describe, it, expect } from 'vitest'
import { applyOtpInput } from '@my/app/utils/otp-input'

const empty = ['', '', '', '', '', '']

describe('applyOtpInput', () => {
  it('types one digit and moves on', () => {
    expect(applyOtpInput(empty, 0, '4')).toEqual({ digits: ['4', '', '', '', '', ''], focus: 1 })
  })

  it('a full code pasted into ANY box fills from the first box', () => {
    for (const box of [0, 3, 5]) {
      expect(applyOtpInput(empty, box, '123456')?.digits).toEqual(['1', '2', '3', '4', '5', '6'])
    }
  })

  it('ignores spaces and dashes in a pasted code', () => {
    expect(applyOtpInput(empty, 2, '123 456')?.digits).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('typing over a filled box keeps the new digit', () => {
    const d = ['1', '2', '3', '', '', '']
    expect(applyOtpInput(d, 1, '27')?.digits).toEqual(['1', '7', '3', '', '', ''])
  })

  it('a partial paste fills from the box it went into', () => {
    expect(applyOtpInput(['1', '2', '', '', '', ''], 2, '345')).toEqual({
      digits: ['1', '2', '3', '4', '5', ''],
      focus: 5,
    })
  })

  it('rejects letters; clearing a box empties it', () => {
    expect(applyOtpInput(empty, 0, 'a')).toBeNull()
    expect(applyOtpInput(['1', '', '', '', '', ''], 0, '')?.digits).toEqual(empty)
  })
})
