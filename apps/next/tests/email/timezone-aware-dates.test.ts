/**
 * Timezone-Aware Schedule Date Tests
 *
 * Tests for the new timezone-aware date handling system that stores
 * dateTime (full UTC timestamp) and sourceTimezone (IANA identifier)
 * with schedule records.
 *
 * Key requirements:
 * - Sunday Memorial must always display as Sunday (not Saturday)
 * - Wednesday Bible Class must always display as Wednesday (not Tuesday)
 * - DST transitions must be handled correctly
 * - Users can view times in their preferred timezone
 */

import { describe, test, expect } from 'vitest'
import {
  combineDateWithServiceTime,
  validateServiceDate,
  SERVICE_TIMES,
  getServiceTimeConfig,
} from '@my/app/config/schedule-times'
import { ProgramsTypes } from '@my/app/types'
import {
  formatScheduleDateTime,
  formatScheduleDateForEmail,
} from '@my/app/utils/timezone'

describe('Service Time Configuration', () => {
  test('Memorial service is configured for 11:00am Toronto on Sunday', () => {
    const config = SERVICE_TIMES[ProgramsTypes.memorial]
    expect(config.defaultTime).toBe('11:00')
    expect(config.expectedDayOfWeek).toBe(0) // Sunday
    expect(config.timezone).toBe('America/Toronto')
  })

  test('Sunday School is configured for 9:30am Toronto on Sunday', () => {
    const config = SERVICE_TIMES[ProgramsTypes.sundaySchool]
    expect(config.defaultTime).toBe('09:30')
    expect(config.expectedDayOfWeek).toBe(0) // Sunday
    expect(config.timezone).toBe('America/Toronto')
  })

  test('Bible Class is configured for 7:30pm Toronto on Wednesday', () => {
    const config = SERVICE_TIMES[ProgramsTypes.bibleClass]
    expect(config.defaultTime).toBe('19:30')
    expect(config.expectedDayOfWeek).toBe(3) // Wednesday
    expect(config.timezone).toBe('America/Toronto')
  })

  test('CYC is configured for 6:30pm Toronto on Saturday', () => {
    const config = SERVICE_TIMES[ProgramsTypes.cyc]
    expect(config.defaultTime).toBe('18:30')
    expect(config.expectedDayOfWeek).toBe(6) // Saturday
    expect(config.timezone).toBe('America/Toronto')
  })

  test('getServiceTimeConfig returns correct config', () => {
    const config = getServiceTimeConfig(ProgramsTypes.memorial)
    expect(config.name).toBe('Memorial Service')
    expect(config.displayTime).toBe('11:00 AM')
  })
})

describe('combineDateWithServiceTime', () => {
  test('converts Sunday Feb 1, 2026 11am Toronto to correct UTC', () => {
    // Feb 1, 2026 is a Sunday, during EST (UTC-5)
    // 11:00am EST = 16:00 UTC
    const result = combineDateWithServiceTime('2026-02-01', ProgramsTypes.memorial)
    expect(result).toContain('2026-02-01T16:00:00')
  })

  test('converts Wednesday Feb 4, 2026 7:30pm Toronto to correct UTC', () => {
    // Feb 4, 2026 is a Wednesday, during EST (UTC-5)
    // 7:30pm EST = 00:30 UTC next day
    const result = combineDateWithServiceTime('2026-02-04', ProgramsTypes.bibleClass)
    expect(result).toContain('2026-02-05T00:30:00')
  })

  test('handles DST transition - March 8, 2026 Memorial', () => {
    // March 8, 2026 - DST starts, clocks spring forward
    // After DST, Toronto is EDT (UTC-4)
    // 11:00am EDT = 15:00 UTC
    const result = combineDateWithServiceTime('2026-03-08', ProgramsTypes.memorial)
    expect(result).toContain('2026-03-08T15:00:00')
  })

  test('handles DST transition - November 1, 2026 Memorial', () => {
    // November 1, 2026 - DST ends, clocks fall back
    // After DST ends, Toronto is EST (UTC-5)
    // 11:00am EST = 16:00 UTC
    const result = combineDateWithServiceTime('2026-11-01', ProgramsTypes.memorial)
    expect(result).toContain('2026-11-01T16:00:00')
  })
})

describe('validateServiceDate', () => {
  test('validates Sunday date for Memorial', () => {
    // Feb 1, 2026 is a Sunday
    const result = validateServiceDate('2026-02-01', ProgramsTypes.memorial)
    expect(result.isValid).toBe(true)
    expect(result.warning).toBeUndefined()
  })

  test('rejects Saturday date for Memorial', () => {
    // Jan 31, 2026 is a Saturday
    const result = validateServiceDate('2026-01-31', ProgramsTypes.memorial)
    expect(result.isValid).toBe(false)
    expect(result.warning).toContain('Saturday')
    expect(result.warning).toContain('expected Sunday')
  })

  test('validates Wednesday date for Bible Class', () => {
    // Feb 4, 2026 is a Wednesday
    const result = validateServiceDate('2026-02-04', ProgramsTypes.bibleClass)
    expect(result.isValid).toBe(true)
  })

  test('rejects Tuesday date for Bible Class', () => {
    // Feb 3, 2026 is a Tuesday
    const result = validateServiceDate('2026-02-03', ProgramsTypes.bibleClass)
    expect(result.isValid).toBe(false)
    expect(result.warning).toContain('Tuesday')
    expect(result.warning).toContain('expected Wednesday')
  })

  test('CYC validates any day (flexible schedule)', () => {
    // CYC can be on any day, so validation should pass
    const result = validateServiceDate('2026-02-02', ProgramsTypes.cyc) // Monday
    expect(result.isValid).toBe(true)
  })
})

describe('formatScheduleDateTime', () => {
  test('formats dateTime correctly in Toronto timezone', () => {
    // Feb 1, 2026 16:00 UTC = 11:00am EST
    const result = formatScheduleDateTime({
      dateTime: '2026-02-01T16:00:00.000Z',
      eventTimezone: 'America/Toronto',
      userTimezone: 'America/Toronto',
    })
    expect(result.dayOfWeek).toBe('Sunday')
    expect(result.dateDisplay).toContain('Sunday')
    expect(result.dateDisplay).toContain('February')
    expect(result.dateDisplay).toContain('1')
    expect(result.dateDisplay).toContain('2026')
  })

  test('formats date-only string correctly', () => {
    const result = formatScheduleDateTime({
      date: '2026-02-01',
    })
    expect(result.dayOfWeek).toBe('Sunday')
    expect(result.dateDisplay).toContain('Sunday')
  })

  test('returns fallback for missing date', () => {
    const result = formatScheduleDateTime({})
    expect(result.dateDisplay).toBe('Date not available')
  })
})

describe('formatScheduleDateForEmail', () => {
  test('uses dateTime when available', () => {
    const result = formatScheduleDateForEmail(
      '2026-02-01T16:00:00.000Z',
      undefined,
      'America/Toronto'
    )
    expect(result).toContain('Sunday')
    expect(result).toContain('February')
    expect(result).toContain('1')
  })

  test('falls back to date when dateTime not available', () => {
    const result = formatScheduleDateForEmail(undefined, '2026-02-01', 'America/Toronto')
    expect(result).toContain('Sunday')
  })

  test('handles Date object', () => {
    const date = new Date(2026, 1, 1, 12, 0, 0) // Feb 1, 2026 noon local
    const result = formatScheduleDateForEmail(undefined, date, 'America/Toronto')
    expect(result).toContain('February')
    expect(result).toContain('1')
  })
})

describe('Critical: Day of week preservation', () => {
  /**
   * These tests ensure the primary bug is fixed:
   * - Sunday Memorial must NEVER display as Saturday
   * - Wednesday Bible Class must NEVER display as Tuesday
   */

  test('Sunday Memorial dates always display as Sunday', () => {
    // Test multiple Sundays across the year
    const sundayDates = [
      '2026-01-04', // Jan 4, 2026 - Sunday
      '2026-02-01', // Feb 1, 2026 - Sunday
      '2026-03-08', // Mar 8, 2026 - Sunday (DST starts)
      '2026-06-07', // Jun 7, 2026 - Sunday (summer)
      '2026-11-01', // Nov 1, 2026 - Sunday (DST ends)
      '2026-12-27', // Dec 27, 2026 - Sunday
    ]

    for (const date of sundayDates) {
      const dateTime = combineDateWithServiceTime(date, ProgramsTypes.memorial)
      const result = formatScheduleDateTime({
        dateTime,
        eventTimezone: 'America/Toronto',
        userTimezone: 'America/Toronto',
      })

      expect(result.dayOfWeek).toBe('Sunday')
    }
  })

  test('Wednesday Bible Class dates always display as Wednesday', () => {
    const wednesdayDates = [
      '2026-01-07', // Jan 7, 2026 - Wednesday
      '2026-02-04', // Feb 4, 2026 - Wednesday
      '2026-03-11', // Mar 11, 2026 - Wednesday (after DST)
      '2026-06-03', // Jun 3, 2026 - Wednesday (summer)
      '2026-11-04', // Nov 4, 2026 - Wednesday (after DST ends)
    ]

    for (const date of wednesdayDates) {
      const dateTime = combineDateWithServiceTime(date, ProgramsTypes.bibleClass)
      const result = formatScheduleDateTime({
        dateTime,
        eventTimezone: 'America/Toronto',
        userTimezone: 'America/Toronto',
      })

      expect(result.dayOfWeek).toBe('Wednesday')
    }
  })
})
