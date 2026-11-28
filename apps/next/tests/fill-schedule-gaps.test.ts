import { describe, it, expect } from 'vitest'
import { fillScheduleGaps, periodForDate } from '@my/app/utils/fill-schedule-gaps'
import { redactScheduleData } from '@my/app/utils/redact-schedule'
import { ANONYMOUS_VIEWER } from '@my/app/utils/viewer-pii'

const sundays = [{ defaultTime: '11:00', displayTime: '11:00am', expectedDayOfWeek: 0 }]
const opts = { type: 'memorial', eventName: 'Memorial', today: '2026-11-26' } // a Thursday
const row = (date: string, extra: any = {}) => ({ id: `r-${date}`, date, Exhort: 'Alex Example', ...extra })

describe('fillScheduleGaps', () => {
  it('fills missing weeks between real rows, in order', () => {
    const out = fillScheduleGaps([row('2026-11-29'), row('2026-12-20')], sundays, opts)
    expect(out.map((r) => r.date)).toEqual(['2026-11-29', '2026-12-06', '2026-12-13', '2026-12-20'])
    expect(out.filter((r) => r.isPlaceholder).map((r) => r.date)).toEqual(['2026-12-06', '2026-12-13'])
  })

  it('adds nothing when there is no gap', () => {
    const rows = [row('2026-11-29'), row('2026-12-06'), row('2026-12-13')]
    expect(fillScheduleGaps(rows, sundays, opts)).toEqual(rows)
  })

  it('fills from today when the first real row is later', () => {
    const out = fillScheduleGaps([row('2026-12-13')], sundays, opts)
    expect(out.map((r) => r.date)).toEqual(['2026-11-29', '2026-12-06', '2026-12-13'])
  })

  it('never fills past the last stored row or before today', () => {
    const out = fillScheduleGaps([row('2026-11-22'), row('2026-12-06')], sundays, opts)
    expect(out.map((r) => r.date)).toEqual(['2026-11-22', '2026-11-29', '2026-12-06'])
    expect(fillScheduleGaps([row('2026-11-15')], sundays, opts).length).toBe(1)
  })

  it('does not fill months no period covers (recess)', () => {
    const schedule = [{ startMonth: 9, endMonth: 6, defaultTime: '09:30', displayTime: '9:30am', expectedDayOfWeek: 0 }]
    const out = fillScheduleGaps([row('2026-06-07'), row('2026-09-13')], schedule, { ...opts, today: '2026-06-01' })
    expect(out.filter((r) => r.isPlaceholder).map((r) => r.date)).toEqual(['2026-06-14', '2026-06-21', '2026-06-28', '2026-09-06'])
    expect(periodForDate(schedule, '2026-07-12')).toBeNull()
  })

  it('uses the seasonal period weekday when one applies', () => {
    const schedule = [
      { defaultTime: '11:00', displayTime: '11:00am', expectedDayOfWeek: 0 },
      { startMonth: 7, endMonth: 8, defaultTime: '10:00', displayTime: '10:00am', expectedDayOfWeek: 3 },
    ]
    const out = fillScheduleGaps([row('2026-06-21'), row('2026-07-12')], schedule, { ...opts, today: '2026-06-21' })
    // June uses Sundays; July uses Wednesdays (07-01, 07-08); no July Sunday slots
    expect(out.filter((r) => r.isPlaceholder).map((r) => r.date)).toEqual(['2026-06-28', '2026-07-01', '2026-07-08'])
  })

  it('does not duplicate a service moved a day within the same week', () => {
    const out = fillScheduleGaps([row('2026-11-29'), row('2026-12-07'), row('2026-12-13')], sundays, opts)
    expect(out.filter((r) => r.isPlaceholder)).toEqual([])
  })

  it('leaves real rows untouched and flags only placeholders', () => {
    const real = row('2026-11-29', { isNextEvent: true })
    const out = fillScheduleGaps([real, row('2026-12-13')], sundays, opts)
    expect(out[0]).toBe(real)
    const ph = out.find((r) => r.isPlaceholder)!
    expect(ph).toMatchObject({ date: '2026-12-06', type: 'memorial', time: '11:00am', isNextEvent: false })
  })

  it('returns input when there are no real rows', () => {
    expect(fillScheduleGaps([], sundays, opts)).toEqual([])
  })

  it('redaction still works on real rows and does not break placeholders', () => {
    const out = fillScheduleGaps([row('2026-11-29'), row('2026-12-13')], sundays, opts)
    const safe = redactScheduleData(out, ANONYMOUS_VIEWER, 'public-web')
    expect(safe[0].Exhort).toBe('Alex')
    expect(safe[1].isPlaceholder).toBe(true)
    expect(safe[1].date).toBe('2026-12-06')
  })
})
