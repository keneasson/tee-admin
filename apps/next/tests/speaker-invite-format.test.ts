import { describe, expect, it } from 'vitest'
import { slotWhen, usualMeeting } from '@my/app/features/speaker-invites/format'

// 2026-11-15, -22, -29 are Sundays; 2026-11-14 is a Saturday; 2026-11-18 a Wednesday.
const sunday = (date: string, time = '11:00') => ({ date, time })

describe('usualMeeting', () => {
  it('names the regular day and time once', () => {
    const usual = usualMeeting([sunday('2026-11-15'), sunday('2026-11-22'), sunday('2026-11-29')])
    expect(usual.label).toBe('Sundays · 11:00 a.m.')
  })

  it('works for a Wednesday evening Bible Class', () => {
    const usual = usualMeeting([
      { date: '2026-11-18', time: '19:30' },
      { date: '2026-11-25', time: '19:30' },
    ])
    expect(usual.label).toBe('Wednesdays · 7:30 p.m.')
  })

  it('is empty for an empty list', () => {
    expect(usualMeeting([]).label).toBe('')
  })
})

describe('slotWhen', () => {
  const slots = [sunday('2026-11-15'), sunday('2026-11-22'), sunday('2026-11-29'), { date: '2026-11-14', time: '10:00' }]
  const usual = usualMeeting(slots)

  it('drops the weekday and time on a regular meeting', () => {
    expect(slotWhen(sunday('2026-11-22'), usual)).toBe('Nov 22, 2026')
  })

  it('keeps the weekday and time where they differ from the usual', () => {
    expect(slotWhen({ date: '2026-11-14', time: '10:00' }, usual)).toBe('Sat, Nov 14, 2026 · 10:00 a.m.')
  })

  it('keeps only the time on a regular day at an unusual time', () => {
    expect(slotWhen(sunday('2026-11-29', '10:00'), usual)).toBe('Nov 29, 2026 · 10:00 a.m.')
  })
})
