/**
 * Bible Class subject ⇄ body + leader honorific tests.
 *
 * BUG HISTORY (2026-08-05):
 * - A "no class" Bible Class email went out with subject "Bible Class Tonight!"
 *   while the body read "There is no scheduled Bible class tonight." — the subject
 *   was a static per-reason string, decoupled from the template's no-class logic.
 * - The "next scheduled class" line rendered "Led by Brother attendees" — the
 *   "Brother" honorific was prepended unconditionally, even to the generic,
 *   non-name leader "attendees".
 *
 * These pin the fix: `bibleClassSubject` mirrors the body's no-class decision, and
 * `formatLeader` only adds "Brother" for actual names.
 */
import { describe, it, expect } from 'vitest'
import {
  bibleClassHasNoClass,
  bibleClassSubject,
  formatLeader,
} from 'email-builder/emails/BibleClass'
import { ProgramsTypes, type BibleClassType } from '@my/app/types'

const klass = (over: Partial<BibleClassType> = {}): BibleClassType => ({
  Key: ProgramsTypes.bibleClass,
  Presider: 'Presiding Brother',
  Speaker: 'John Smith',
  Topic: 'A study',
  Date: 'Aug 5, 2026',
  ...over,
})

describe('bibleClassHasNoClass', () => {
  it('is no-class when the speaker is empty', () => {
    expect(bibleClassHasNoClass(klass({ Speaker: '' }))).toBe(true)
  })
  it('is no-class when the topic says "no class"', () => {
    expect(bibleClassHasNoClass(klass({ Topic: 'No Class this week' }))).toBe(true)
  })
  it('is a class for a normal event', () => {
    expect(bibleClassHasNoClass(klass())).toBe(false)
  })
  it("honors override 'cancelled' over an otherwise-valid event", () => {
    expect(bibleClassHasNoClass(klass({ overrideStatus: 'cancelled' }))).toBe(true)
  })
  it("honors override 'active' over an empty speaker", () => {
    expect(bibleClassHasNoClass(klass({ Speaker: '', overrideStatus: 'active' }))).toBe(false)
  })
  it('is not no-class when there is no event at all', () => {
    expect(bibleClassHasNoClass(undefined)).toBe(false)
  })
})

describe('bibleClassSubject', () => {
  it('reads "No Bible Class Tonight" when tonight is cancelled', () => {
    expect(bibleClassSubject([klass({ Speaker: '' })])).toBe('No Bible Class Tonight')
  })
  it('reads "Bible Class Tonight!" when there is a class', () => {
    expect(bibleClassSubject([klass()])).toBe('Bible Class Tonight!')
  })
  it('subject reflects tonight (index 0), not a later listed class', () => {
    // No class tonight, a real class next — subject must still say "No ..."
    expect(bibleClassSubject([klass({ Speaker: '' }), klass()])).toBe('No Bible Class Tonight')
  })
})

describe('formatLeader', () => {
  it('adds the "Brother" honorific for an actual name', () => {
    expect(formatLeader('John Smith')).toBe('Brother John Smith')
  })
  it('does NOT add "Brother" for the generic "attendees"', () => {
    expect(formatLeader('attendees')).toBe('attendees')
  })
  it('matches generic leaders case-insensitively but keeps display casing', () => {
    expect(formatLeader('Attendees')).toBe('Attendees')
    expect(formatLeader('TBD')).toBe('TBD')
  })
  it('trims surrounding whitespace', () => {
    expect(formatLeader('  Jane Doe  ')).toBe('Brother Jane Doe')
  })
  it('returns empty string for an empty/undefined leader', () => {
    expect(formatLeader('')).toBe('')
    expect(formatLeader(undefined)).toBe('')
  })
})
