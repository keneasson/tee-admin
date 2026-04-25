/**
 * Funeral Duration Rules Tests
 *
 * These tests verify the business rules for how funeral events display in the newsletter.
 *
 * RULES:
 * 1. First 2 newsletters (14 days from publish): ALWAYS show, even if service has passed
 * 2. After 2-newsletter window: Only show on Thursday before service (if service hasn't passed)
 * 3. After 2-newsletter window + service passed: EXCLUDE
 * 4. Backdating publish date can reduce the number of postings
 *
 * The "2-newsletter window" is calculated as 14 days from the publishDate.
 * This guarantees at least 2 Thursday newsletters regardless of which day the event is published.
 */

import { describe, test, expect } from 'vitest'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'

// Helper to create a funeral event
function createFuneralEvent(options: {
  title?: string
  serviceDate: Date
  publishDate: Date
}) {
  return {
    id: 'test-funeral-1',
    title: options.title || 'Test Funeral',
    type: 'funeral',
    serviceDate: options.serviceDate,
    publishDate: options.publishDate,
    status: 'published',
  }
}

// Helper to create a funeral duration rule
const funeralRule = {
  displayDuration: '2_weeks_then_thursday_before' as const,
  priority: 2,
  includeInSummary: true,
  requiresCTA: false,
}

// Helper to get a specific day of the week
function getDateOnDay(baseDate: Date, targetDay: number): Date {
  const result = new Date(baseDate)
  const currentDay = result.getDay()
  const diff = targetDay - currentDay
  result.setDate(result.getDate() + diff)
  return result
}

// Helper to get Thursday of a given week
function getThursday(baseDate: Date): Date {
  return getDateOnDay(baseDate, 4) // 4 = Thursday
}

describe('Funeral Duration Rules', () => {
  // ==========================================================================
  // Rule 1: First 2 newsletters - ALWAYS show (even if service passed)
  // ==========================================================================

  describe('Within 2-newsletter window (first 14 days from publish)', () => {
    test('shows funeral published today with upcoming service', () => {
      const today = new Date('2026-01-16') // Thursday
      const serviceDate = new Date('2026-01-25') // Next Saturday

      const event = createFuneralEvent({
        title: 'Upcoming Service Funeral',
        serviceDate,
        publishDate: today,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: today,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('2-newsletter window')
    })

    test('shows funeral published today even if service already passed', () => {
      const today = new Date('2026-01-16') // Thursday
      const serviceDate = new Date('2026-01-14') // Tuesday (2 days ago)

      const event = createFuneralEvent({
        title: 'Fast Service Funeral',
        serviceDate,
        publishDate: today,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: today,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('2-newsletter window')
    })

    test('shows funeral on day 7 (second newsletter) even if service passed', () => {
      const publishDate = new Date('2026-01-09') // Thursday week 1
      const currentDate = new Date('2026-01-16') // Thursday week 2 (day 7)
      const serviceDate = new Date('2026-01-11') // Saturday (service already passed)

      const event = createFuneralEvent({
        title: 'Week 2 Funeral',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('2-newsletter window')
    })

    test('shows funeral on day 14 (end of window) even if service passed', () => {
      const publishDate = new Date('2026-01-02') // Thursday week 1
      const currentDate = new Date('2026-01-16') // Thursday week 3 (day 14)
      const serviceDate = new Date('2026-01-10') // Friday (service already passed)

      const event = createFuneralEvent({
        title: 'Day 14 Funeral',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('2-newsletter window')
    })
  })

  // ==========================================================================
  // Rule 2: After 2-newsletter window - Only Thursday before service
  // ==========================================================================

  describe('After 2-newsletter window with upcoming service', () => {
    test('excludes funeral on regular Thursday (not Thursday before service)', () => {
      const publishDate = new Date('2026-01-02') // Thursday 3 weeks ago
      const currentDate = new Date('2026-01-23') // Thursday (21 days later, outside 14-day window)
      const serviceDate = new Date('2026-01-31') // Service is Jan 31 (Saturday)
      // Thursday before service would be Jan 29

      const event = createFuneralEvent({
        title: 'Waiting for Thursday Before Service',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(false)
      expect(result.reason).toContain('waiting for Thursday before service')
    })

    test('shows funeral on Thursday before service (final reminder)', () => {
      const publishDate = new Date('2026-01-02') // Thursday 3+ weeks ago
      const serviceDate = new Date('2026-01-25') // Saturday Jan 25
      const thursdayBeforeService = new Date('2026-01-23') // Thursday Jan 23

      const event = createFuneralEvent({
        title: 'Final Reminder Funeral',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: thursdayBeforeService,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('Final reminder')
    })

    test('shows funeral on Thursday before service when service is on Thursday', () => {
      const publishDate = new Date('2026-01-02') // Thursday 3+ weeks ago
      const serviceDate = new Date('2026-01-30') // Thursday Jan 30
      // Thursday before a Thursday service = previous Thursday (Jan 23)
      const thursdayBeforeService = new Date('2026-01-23')

      const event = createFuneralEvent({
        title: 'Thursday Service Funeral',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: thursdayBeforeService,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('Final reminder')
    })
  })

  // ==========================================================================
  // Rule 3: After 2-newsletter window + service passed = EXCLUDE
  // ==========================================================================

  describe('After 2-newsletter window with passed service', () => {
    test('excludes funeral when service passed and outside 2-newsletter window', () => {
      const publishDate = new Date('2026-01-02') // Thursday 3 weeks ago
      const currentDate = new Date('2026-01-23') // Thursday (21 days later, outside 14-day window)
      const serviceDate = new Date('2026-01-10') // Service was Jan 10 (passed)

      const event = createFuneralEvent({
        title: 'Old Passed Funeral',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(false)
      expect(result.reason).toContain('has passed')
    })

    test('excludes funeral even on what would be Thursday before service if service already passed', () => {
      const publishDate = new Date('2025-12-26') // 3 weeks ago
      const serviceDate = new Date('2026-01-11') // Saturday (already passed)
      const currentDate = new Date('2026-01-16') // This Thursday

      const event = createFuneralEvent({
        title: 'Missed Final Reminder',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(false)
      expect(result.reason).toContain('has passed')
    })
  })

  // ==========================================================================
  // Rule 4: Backdating publish date to control postings
  // ==========================================================================

  describe('Backdating publish date', () => {
    test('backdating publish date by 7 days still shows in 2 newsletters', () => {
      const publishDate = new Date('2026-01-09') // Thursday week 1
      const serviceDate = new Date('2026-01-31') // Upcoming Saturday (far out)

      const event = createFuneralEvent({
        title: 'Backdated 7 Days Funeral',
        serviceDate,
        publishDate,
      })

      // Day 7 from publish (Jan 16) - still within 14-day window
      const resultDay7 = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: new Date('2026-01-16'), // Day 7
        firstIncludedDate: undefined,
      })
      expect(resultDay7.shouldInclude).toBe(true)
      expect(resultDay7.reason).toContain('2-newsletter window')

      // Day 14 from publish (Jan 23) - still within 14-day window
      const resultDay14 = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: new Date('2026-01-23'), // Day 14
        firstIncludedDate: undefined,
      })
      expect(resultDay14.shouldInclude).toBe(true)
      expect(resultDay14.reason).toContain('2-newsletter window')

      // Day 21 from publish (Jan 30) - outside window, not Thursday before service (Jan 31)
      const resultDay21 = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: new Date('2026-01-30'), // Day 21, also Thursday before service!
        firstIncludedDate: undefined,
      })
      // This shows because it's Thursday before service
      expect(resultDay21.shouldInclude).toBe(true)
      expect(resultDay21.reason).toContain('Final reminder')
    })

    test('backdating publish date by 14+ days skips to Thursday-before-service only', () => {
      const today = new Date('2026-01-23') // Thursday (day 22 from publish)
      const publishDate = new Date('2026-01-01') // Backdate by 22 days
      const serviceDate = new Date('2026-01-31') // Saturday Jan 31

      const event = createFuneralEvent({
        title: 'Skip to Final Reminder',
        serviceDate,
        publishDate,
      })

      // Today is outside the 2-newsletter window and not Thursday before service
      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: today,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(false)
      expect(result.reason).toContain('waiting for Thursday before service')
    })
  })

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge cases', () => {
    test('handles funeral with no publish date (includes by default)', () => {
      const today = new Date('2026-01-16')
      const serviceDate = new Date('2026-01-25')

      const event = {
        id: 'no-publish-date',
        title: 'No Publish Date Funeral',
        type: 'funeral',
        serviceDate,
        // No publishDate
      }

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: today,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('No publish date')
    })

    test('handles funeral with no service date (excludes after window)', () => {
      const today = new Date('2026-01-23') // 21 days from publish
      const publishDate = new Date('2026-01-02') // 3 weeks ago

      const event = {
        id: 'no-service-date',
        title: 'No Service Date Funeral',
        type: 'funeral',
        publishDate,
        // No serviceDate
      }

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: today,
        firstIncludedDate: undefined,
      })

      // Outside 14-day window, no service date to check Thursday against
      // Should be excluded since we can't determine Thursday before service
      expect(result.shouldInclude).toBe(false)
    })

    test('service on Saturday - Thursday before is 2 days earlier', () => {
      const publishDate = new Date('2026-01-02')
      const serviceDate = new Date('2026-01-25') // Saturday
      const thursdayBefore = new Date('2026-01-23') // Thursday, 2 days before

      const event = createFuneralEvent({
        title: 'Saturday Service',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: thursdayBefore,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
    })

    test('service on Sunday - Thursday before is 3 days earlier', () => {
      const publishDate = new Date('2026-01-02')
      const serviceDate = new Date('2026-01-26') // Sunday
      const thursdayBefore = new Date('2026-01-23') // Thursday, 3 days before

      const event = createFuneralEvent({
        title: 'Sunday Service',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: thursdayBefore,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
    })

    test('service on Monday - Thursday before is 4 days earlier', () => {
      const publishDate = new Date('2026-01-02')
      const serviceDate = new Date('2026-01-27') // Monday
      const thursdayBefore = new Date('2026-01-23') // Thursday, 4 days before

      const event = createFuneralEvent({
        title: 'Monday Service',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: thursdayBefore,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
    })

    test('service on Wednesday - Thursday before is 6 days earlier', () => {
      const publishDate = new Date('2026-01-02')
      const serviceDate = new Date('2026-01-29') // Wednesday
      const thursdayBefore = new Date('2026-01-23') // Thursday, 6 days before

      const event = createFuneralEvent({
        title: 'Wednesday Service',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate: thursdayBefore,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
    })
  })

  // ==========================================================================
  // Real-world Scenarios (from the user's screenshot)
  // ==========================================================================

  describe('Real-world scenarios', () => {
    test('David McKay - service Jan 3, today Jan 16 - should be EXCLUDED', () => {
      const publishDate = new Date('2025-12-20') // Assume published ~2 weeks before service
      const currentDate = new Date('2026-01-16') // Today
      const serviceDate = new Date('2026-01-03') // Service already passed

      const event = createFuneralEvent({
        title: 'In Loving Memory of Brother David McKay',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(false)
      expect(result.reason).toContain('has passed')
    })

    test('Hammy Neblett - service Jan 10, today Jan 16 - should be EXCLUDED', () => {
      const publishDate = new Date('2025-12-27') // Assume published ~2 weeks before service
      const currentDate = new Date('2026-01-16') // Today
      const serviceDate = new Date('2026-01-10') // Service already passed

      const event = createFuneralEvent({
        title: 'In loving memory of Hammy Neblett',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(false)
      expect(result.reason).toContain('has passed')
    })

    test('New funeral - published today with service next week - should be INCLUDED', () => {
      const publishDate = new Date('2026-01-16') // Published today
      const currentDate = new Date('2026-01-16') // Today
      const serviceDate = new Date('2026-01-24') // Service next Saturday

      const event = createFuneralEvent({
        title: 'Recently Published Funeral',
        serviceDate,
        publishDate,
      })

      const result = EventDurationCalculator.shouldIncludeEvent({
        event,
        rule: funeralRule,
        currentDate,
        firstIncludedDate: undefined,
      })

      expect(result.shouldInclude).toBe(true)
      expect(result.reason).toContain('2-newsletter window')
    })
  })
})
