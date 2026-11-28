/**
 * Election Notice voting window (shared by the newsletter web page and email).
 *
 * Uses the real stored shape: the form writes midnight Toronto, e.g.
 * 2026-12-13T05:00:00.000Z. The notice must show for the WHOLE close day in
 * Toronto, and agree with the duration calculator that decides whether the
 * email receives the event at all.
 */

import { describe, test, expect } from 'vitest'
import { isElectionActive, electionCalendarDate } from '@my/app/utils/newsletter/election-window'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'
import { EVENT_DURATION_RULES } from '@my/app/utils/newsletter/event-display-rules'

const stored = {
  id: 'test-election-window',
  title: 'Test Election',
  type: 'election-cycle',
  status: 'published',
  publishDate: '2026-11-26T05:00:00.000Z',
  electionStartDate: '2026-11-26T05:00:00.000Z',
  electionEndDate: '2026-12-13T05:00:00.000Z',
}

// Toronto wall-clock instants, written as UTC (EST = UTC-5 in Nov/Dec)
const toronto = {
  nov25_2330: new Date('2026-11-26T04:30:00.000Z'),
  nov26_0030: new Date('2026-11-26T05:30:00.000Z'),
  dec13_0800: new Date('2026-12-13T13:00:00.000Z'),
  dec13_2330: new Date('2026-12-14T04:30:00.000Z'),
  dec14_0030: new Date('2026-12-14T05:30:00.000Z'),
}

describe('isElectionActive (stored as midnight Toronto)', () => {
  test('inactive Nov 25 23:30 Toronto (before voting opens)', () => {
    expect(isElectionActive(stored, toronto.nov25_2330)).toBe(false)
  })
  test('active Nov 26 00:30 Toronto (first voting day)', () => {
    expect(isElectionActive(stored, toronto.nov26_0030)).toBe(true)
  })
  test('active Dec 13 08:00 Toronto (last voting day)', () => {
    expect(isElectionActive(stored, toronto.dec13_0800)).toBe(true)
  })
  test('active Dec 13 23:30 Toronto (last voting day, late)', () => {
    expect(isElectionActive(stored, toronto.dec13_2330)).toBe(true)
  })
  test('inactive Dec 14 00:30 Toronto (after voting closes)', () => {
    expect(isElectionActive(stored, toronto.dec14_0030)).toBe(false)
  })
})

describe('isElectionActive (legacy midnight-UTC / plain date values)', () => {
  const legacyIso = {
    ...stored,
    electionStartDate: '2026-11-26T00:00:00.000Z',
    electionEndDate: '2026-12-13T00:00:00.000Z',
  }
  const plain = { ...stored, electionStartDate: '2026-11-26', electionEndDate: '2026-12-13' }
  const asDates = {
    ...stored,
    electionStartDate: new Date(stored.electionStartDate),
    electionEndDate: new Date(stored.electionEndDate),
  }
  const cases = [
    ['midnight UTC', legacyIso],
    ['YYYY-MM-DD', plain],
    ['Date objects', asDates],
  ] as const
  for (const [name, ev] of cases) {
    test(`${name}: same window as the stored form value`, () => {
      expect(isElectionActive(ev, toronto.nov25_2330)).toBe(false)
      expect(isElectionActive(ev, toronto.nov26_0030)).toBe(true)
      expect(isElectionActive(ev, toronto.dec13_0800)).toBe(true)
      expect(isElectionActive(ev, toronto.dec13_2330)).toBe(true)
      expect(isElectionActive(ev, toronto.dec14_0030)).toBe(false)
    })
  }

  test('electionCalendarDate reads both shapes as the same day', () => {
    expect(electionCalendarDate('2026-12-13T05:00:00.000Z')).toBe('2026-12-13')
    expect(electionCalendarDate('2026-12-13T00:00:00.000Z')).toBe('2026-12-13')
    expect(electionCalendarDate('2026-12-13')).toBe('2026-12-13')
  })
})

describe('isElectionActive edge cases', () => {
  test('uses eventTimezone when present', () => {
    // America/Regina is fixed UTC-6 (no DST). Midnight Dec 13 = 06:00Z;
    // 23:30 Dec 13 Regina = 05:30Z Dec 14 (still Dec 13 there, but Dec 14 in Toronto)
    const ev = {
      ...stored,
      eventTimezone: 'America/Regina',
      electionStartDate: '2026-11-26T06:00:00.000Z',
      electionEndDate: '2026-12-13T06:00:00.000Z',
    }
    expect(isElectionActive(ev, new Date('2026-12-14T05:30:00.000Z'))).toBe(true)
    expect(isElectionActive(ev, new Date('2026-12-14T06:30:00.000Z'))).toBe(false)
  })
  test('invalid timezone falls back to Toronto', () => {
    expect(isElectionActive({ ...stored, eventTimezone: 'Not/AZone' }, toronto.dec13_2330)).toBe(true)
  })
  test('non-election or missing dates are never active', () => {
    expect(isElectionActive({ ...stored, type: 'general' }, toronto.dec13_0800)).toBe(false)
    expect(isElectionActive({ ...stored, electionEndDate: undefined }, toronto.dec13_0800)).toBe(false)
  })
})

// The email only receives the event if the duration calculator includes it.
// It must agree with the notice at the same instants on ANY server clock
// (Vercel runs in UTC; run this file with TZ=America/Toronto and TZ=UTC).
describe('calculator agrees with the notice', () => {
  const included = (now: Date) =>
    EventDurationCalculator.shouldIncludeEvent({
      event: stored,
      rule: EVENT_DURATION_RULES['election-cycle'],
      currentDate: now,
    }).shouldInclude

  test('event reaches the email whenever the notice is active, through the close day', () => {
    for (const now of [toronto.nov26_0030, toronto.dec13_0800, toronto.dec13_2330]) {
      expect(isElectionActive(stored, now)).toBe(true)
      expect(included(now)).toBe(true)
    }
  })

  test('both drop the election once the close day is over', () => {
    expect(isElectionActive(stored, toronto.dec14_0030)).toBe(false)
    expect(included(toronto.dec14_0030)).toBe(false)
  })
})
