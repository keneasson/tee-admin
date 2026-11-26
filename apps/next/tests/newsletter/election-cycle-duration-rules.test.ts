/**
 * Election Cycle Duration Rules Tests
 *
 * An election-cycle event drives the "Election Notice" in the newsletter.
 * Its display rule is `until_event_date`, which must use the voting window
 * (electionStartDate -> electionEndDate), NOT the publish date. Before the fix,
 * the calculator fell back to publishDate, so the newsletter EMAIL dropped the
 * election the day after it was published while voting was still open.
 *
 * Dates are stored as "YYYY-MM-DD" (midnight UTC); "now" is the reader's local
 * time. Run with TZ=America/Toronto to exercise the real timezone.
 */

import { describe, test, expect } from 'vitest'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'
import { EVENT_DURATION_RULES, shouldDisplayEvent } from '@my/app/utils/newsletter/event-display-rules'

const electionRule = EVENT_DURATION_RULES['election-cycle']

function createElectionEvent() {
  return {
    id: 'test-election-1',
    title: 'Test Election',
    type: 'election-cycle',
    status: 'published',
    publishDate: '2026-11-26',
    electionStartDate: '2026-11-26',
    electionEndDate: '2026-12-13',
  }
}

// Local-time "now" (month is 0-based)
const at = (year: number, month: number, day: number, hour = 9) => new Date(year, month, day, hour, 0)

function include(currentDate: Date): boolean {
  return EventDurationCalculator.shouldIncludeEvent({
    event: createElectionEvent(),
    rule: electionRule,
    currentDate,
  }).shouldInclude
}

describe('Election Cycle Duration Rules', () => {
  test('election-cycle rule is until_event_date', () => {
    expect(electionRule.displayDuration).toBe('until_event_date')
  })

  test('included on publish / voting-open day', () => {
    expect(include(at(2026, 10, 26))).toBe(true)
  })

  test('included on the day after publish', () => {
    expect(include(at(2026, 10, 27))).toBe(true)
    expect(include(at(2026, 10, 28))).toBe(true)
  })

  test('included mid-window (Thursday newsletters)', () => {
    expect(include(at(2026, 11, 3))).toBe(true)
    expect(include(at(2026, 11, 10))).toBe(true)
  })

  test('included on the last day of voting, morning and evening', () => {
    expect(include(at(2026, 11, 13, 8))).toBe(true)
    expect(include(at(2026, 11, 13, 22))).toBe(true)
  })

  test('excluded after the election end date', () => {
    expect(include(at(2026, 11, 14))).toBe(false)
    expect(include(at(2026, 11, 20))).toBe(false)
  })

  test('displayUntilDate is the election end date', () => {
    const result = EventDurationCalculator.shouldIncludeEvent({
      event: createElectionEvent(),
      rule: electionRule,
      currentDate: at(2026, 11, 3),
    })
    expect(result.displayUntilDate?.toISOString().slice(0, 10)).toBe('2026-12-13')
  })

  test('shared shouldDisplayEvent keeps the election through the window', () => {
    const event = createElectionEvent() as any
    expect(shouldDisplayEvent(event, at(2026, 11, 3))).toBe(true)
    expect(shouldDisplayEvent(event, at(2026, 11, 14))).toBe(false)
  })

  test('works with Date objects as well as date strings', () => {
    const event = {
      ...createElectionEvent(),
      publishDate: new Date('2026-11-26T00:00:00.000Z'),
      electionStartDate: new Date('2026-11-26T00:00:00.000Z'),
      electionEndDate: new Date('2026-12-13T00:00:00.000Z'),
    }
    const r = (d: Date) =>
      EventDurationCalculator.shouldIncludeEvent({ event, rule: electionRule, currentDate: d }).shouldInclude
    expect(r(at(2026, 11, 3))).toBe(true)
    expect(r(at(2026, 11, 14))).toBe(false)
  })
})
