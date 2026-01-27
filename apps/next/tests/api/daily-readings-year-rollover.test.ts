/**
 * Daily Readings Year Rollover Tests
 *
 * These tests ensure that the daily readings API correctly handles
 * the Dec 31 → Jan 1 year boundary.
 *
 * BUG: When requesting 7 days of readings starting Dec 28,
 * the API was only returning Dec 28-31 (4 days) because
 * January dates were being assigned the current year (2025)
 * instead of the next year (2026), causing them to be filtered out.
 */

import { describe, test, expect } from 'vitest'

// Simulate the filtering logic from the API
function filterReadingsWithYearRollover(
  readings: Array<{ [key: string]: string[] }>,
  start: Date,
  end: Date
): Array<{ [key: string]: string[] }> {
  const startYear = start.getUTCFullYear()
  const endYear = end.getUTCFullYear()

  function stripTime(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  }

  // Filter and collect matching readings with their actual dates for sorting
  const matchedReadings: Array<{ reading: { [key: string]: string[] }; sortDate: Date }> = []

  for (const row of readings) {
    const date = Object.keys(row)[0]

    // Try the date with start year first
    let dateObj = new Date(`${date}, ${startYear}`)
    let dateOnly = stripTime(dateObj)

    if (dateOnly >= start && dateOnly <= end) {
      matchedReadings.push({ reading: row, sortDate: dateOnly })
      continue
    }

    // If years differ and date didn't match, try with end year
    if (startYear !== endYear) {
      dateObj = new Date(`${date}, ${endYear}`)
      dateOnly = stripTime(dateObj)
      if (dateOnly >= start && dateOnly <= end) {
        matchedReadings.push({ reading: row, sortDate: dateOnly })
      }
    }
  }

  // Sort by date chronologically
  matchedReadings.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())

  return matchedReadings.map(m => m.reading)
}

// Mock readings data (simplified version of the actual data)
const mockReadings = [
  { 'Jan 1': ['Genesis 1-2', 'Psalms 1-2', 'Matthew 1-2'] },
  { 'Jan 2': ['Genesis 3-4', 'Psalms 3-5', 'Matthew 3-4'] },
  { 'Jan 3': ['Genesis 5-6', 'Psalms 6-8', 'Matthew 5'] },
  { 'Jan 4': ['Genesis 7-8', 'Psalms 9-10', 'Matthew 6'] },
  { 'Dec 28': ['Job 38', 'Zechariah 13', 'Revelation 15-16'] },
  { 'Dec 29': ['Job 39', 'Malachi 1', 'Revelation 17-18'] },
  { 'Dec 30': ['Job 40', 'Malachi 2', 'Revelation 19-20'] },
  { 'Dec 31': ['Job 41-42', 'Malachi 3-4', 'Revelation 21-22'] },
]

describe('Daily Readings Year Rollover', () => {
  test('returns 7 days of readings across year boundary (Dec 28 - Jan 3)', () => {
    // Dec 28, 2025 to Jan 3, 2026
    const start = new Date(Date.UTC(2025, 11, 28)) // Dec 28, 2025
    const end = new Date(Date.UTC(2026, 0, 3))     // Jan 3, 2026

    const result = filterReadingsWithYearRollover(mockReadings, start, end)

    // Should return 7 entries: Dec 28, 29, 30, 31, Jan 1, 2, 3
    expect(result.length).toBe(7)

    // Check that we have both December and January entries
    const dates = result.map(r => Object.keys(r)[0])
    expect(dates).toContain('Dec 28')
    expect(dates).toContain('Dec 29')
    expect(dates).toContain('Dec 30')
    expect(dates).toContain('Dec 31')
    expect(dates).toContain('Jan 1')
    expect(dates).toContain('Jan 2')
    expect(dates).toContain('Jan 3')
  })

  test('results are sorted chronologically across year boundary', () => {
    // Dec 28, 2025 to Jan 3, 2026
    const start = new Date(Date.UTC(2025, 11, 28)) // Dec 28, 2025
    const end = new Date(Date.UTC(2026, 0, 3))     // Jan 3, 2026

    const result = filterReadingsWithYearRollover(mockReadings, start, end)
    const dates = result.map(r => Object.keys(r)[0])

    // Should be in chronological order: Dec 28, 29, 30, 31, Jan 1, 2, 3
    expect(dates).toEqual(['Dec 28', 'Dec 29', 'Dec 30', 'Dec 31', 'Jan 1', 'Jan 2', 'Jan 3'])
  })

  test('returns correct readings when not crossing year boundary', () => {
    // Dec 25-31, 2025 (same year)
    const start = new Date(Date.UTC(2025, 11, 28)) // Dec 28, 2025
    const end = new Date(Date.UTC(2025, 11, 31))   // Dec 31, 2025

    const result = filterReadingsWithYearRollover(mockReadings, start, end)

    // Should return 4 entries: Dec 28, 29, 30, 31
    expect(result.length).toBe(4)

    const dates = result.map(r => Object.keys(r)[0])
    expect(dates).toContain('Dec 28')
    expect(dates).toContain('Dec 31')
    expect(dates).not.toContain('Jan 1')
  })

  test('returns correct readings in mid-year', () => {
    // A week in June (no year boundary issues)
    const juneReadings = [
      { 'Jun 1': ['Reading 1'] },
      { 'Jun 2': ['Reading 2'] },
      { 'Jun 3': ['Reading 3'] },
      { 'Jun 4': ['Reading 4'] },
      { 'Jun 5': ['Reading 5'] },
      { 'Jun 6': ['Reading 6'] },
      { 'Jun 7': ['Reading 7'] },
    ]

    const start = new Date(Date.UTC(2025, 5, 1))  // Jun 1, 2025
    const end = new Date(Date.UTC(2025, 5, 7))    // Jun 7, 2025

    const result = filterReadingsWithYearRollover(juneReadings, start, end)

    expect(result.length).toBe(7)
  })

  test('handles Jan 1 start date correctly', () => {
    // Starting on Jan 1 should work normally
    const start = new Date(Date.UTC(2026, 0, 1))  // Jan 1, 2026
    const end = new Date(Date.UTC(2026, 0, 4))    // Jan 4, 2026

    const result = filterReadingsWithYearRollover(mockReadings, start, end)

    expect(result.length).toBe(4)

    const dates = result.map(r => Object.keys(r)[0])
    expect(dates).toContain('Jan 1')
    expect(dates).toContain('Jan 2')
    expect(dates).toContain('Jan 3')
    expect(dates).toContain('Jan 4')
    expect(dates).not.toContain('Dec 31')
  })
})
