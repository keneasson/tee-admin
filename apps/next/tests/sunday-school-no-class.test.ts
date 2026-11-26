import { describe, it, expect, vi } from 'vitest'
import { isValidScheduleRow, sundaySchoolClassRuns } from '@my/app/utils/schedule-row-rules'
import { fillScheduleGaps } from '@my/app/utils/fill-schedule-gaps'

const rows: Record<string, any>[] = [
  { Date: '2026-12-20', Refreshments: 'Family A' },
  { Date: '2026-12-27', Refreshments: '', 'Holidays and Special Events': 'No Sunday School' },
  { Date: '2027-01-03', Refreshments: '  ', 'Holidays and Special Events': 'Christmas break' },
  { Date: '2027-01-10', Refreshments: '' },
]

vi.mock('@my/app/provider/dynamodb/schedule-service', () => ({
  ScheduleService: class {
    async getScheduleData() {
      return { content: rows }
    }
  },
}))

describe('isValidScheduleRow — sundaySchool', () => {
  it('keeps a class row and does not flag it', () => {
    const e: any = { Refreshments: 'Family A' }
    expect(isValidScheduleRow(e, 'sundaySchool')).toBe(true)
    expect(e.noClass).toBeUndefined()
  })
  it('keeps a blank-Refreshments row with a holiday note, marked noClass (raw or transformed key)', () => {
    const raw: any = { Refreshments: '', 'Holidays and Special Events': 'No Sunday School' }
    expect(isValidScheduleRow(raw, 'sundaySchool')).toBe(true)
    expect(raw.noClass).toBe(true)
    const flat: any = { Refreshments: '', HolidaysAndSpecialEvents: 'Christmas break' }
    expect(isValidScheduleRow(flat, 'sundaySchool')).toBe(true)
    expect(flat.noClass).toBe(true)
  })
  it('drops a row with neither Refreshments nor a note', () => {
    expect(isValidScheduleRow({ Refreshments: '' }, 'sundaySchool')).toBe(false)
    expect(isValidScheduleRow({ Refreshments: ' ', HolidaysAndSpecialEvents: ' ' }, 'sundaySchool')).toBe(false)
  })
})

describe('fill does not duplicate a no-class week', () => {
  it('treats the no-class row as that week being covered', () => {
    const sundays = [{ defaultTime: '09:30', displayTime: '9:30am', expectedDayOfWeek: 0 }]
    const real: any[] = [
      { id: 'a', date: '2026-12-20', Refreshments: 'Family A' },
      { id: 'b', date: '2026-12-27', Refreshments: '', noClass: true },
      { id: 'c', date: '2027-01-10', Refreshments: 'Family B' },
    ]
    const out = fillScheduleGaps(real, sundays, { type: 'sundaySchool', today: '2026-12-18' })
    expect(out.map((r) => r.date)).toEqual(['2026-12-20', '2026-12-27', '2027-01-03', '2027-01-10'])
    expect(out.filter((r) => r.isPlaceholder).map((r) => r.date)).toEqual(['2027-01-03'])
  })
})

describe('exhorter heads-up Sunday School', () => {
  it('sundaySchoolClassRuns needs Refreshments and respects a cancelled override', () => {
    expect(sundaySchoolClassRuns({ Refreshments: 'Family A' })).toBe(true)
    expect(sundaySchoolClassRuns({ Refreshments: '' })).toBe(false)
    expect(sundaySchoolClassRuns({ Refreshments: 'Family A', overrideStatus: 'cancelled' })).toBe(false)
  })
  it('resolveSundaySchoolForDate is undefined for a no-class week and defined for a class week', async () => {
    const { resolveSundaySchoolForDate } = await import('../utils/email/exhorter-heads-up')
    expect(await resolveSundaySchoolForDate('2026-12-27', null)).toBeUndefined()
    expect(await resolveSundaySchoolForDate('2027-01-10', null)).toBeUndefined() // blank, no note
    expect(await resolveSundaySchoolForDate('2026-12-20', null)).toBeDefined()
  })
})
