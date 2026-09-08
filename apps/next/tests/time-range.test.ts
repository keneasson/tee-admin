import { describe, it, expect } from 'vitest'
import { formatTimeBlock } from '@my/ui/src/post-view/post-view-format'
import type { TimeBlock } from '@my/app/types/post'

/**
 * The commonest shape of all is a single non-recurring DATE RANGE — "Sept 18–20"
 * — often with no meaningful time (it runs until it is done). Three things used
 * to make that unexpressible: the end fields were hidden behind a disclosure and
 * only in "precise" mode, and the renderer appended only the end TIME, so a
 * multi-day range published as a single date.
 */
const block = (over: Partial<TimeBlock>): TimeBlock => ({
  id: 't1',
  kind: 'time',
  timezone: 'America/Toronto',
  ...over,
})

describe('multi-day ranges render as ranges', () => {
  it('shows both dates when the end is a different day', () => {
    const { dateLine } = formatTimeBlock(
      block({ startsAt: '2026-09-18T12:00:00.000Z', endsAt: '2026-09-20T12:00:00.000Z' })
    )
    expect(dateLine).toContain('–')
    expect(dateLine).toMatch(/18/)
    expect(dateLine).toMatch(/20/)
  })

  it('does not repeat the date for a same-day event', () => {
    const { dateLine } = formatTimeBlock(
      block({ startsAt: '2026-09-18T18:00:00.000Z', endsAt: '2026-09-18T21:00:00.000Z' })
    )
    expect(dateLine).not.toContain('–')
  })

  it('a date-only range still sorts — startsAt is a real instant', () => {
    const b = block({ startsAt: '2026-09-18T04:00:00.000Z', endsAt: '2026-09-20T04:00:00.000Z' })
    expect(Date.parse(b.startsAt!)).not.toBeNaN()
    expect(Date.parse(b.endsAt!)).toBeGreaterThan(Date.parse(b.startsAt!))
  })

  it('a DESCRIBED time has no instant — it cannot sort or expire', () => {
    const b = block({ display: 'Sept 18th-20th' })
    expect(b.startsAt).toBeUndefined()
    const { dateLine, timeLine } = formatTimeBlock(b)
    expect(dateLine).toBe('')
    expect(timeLine).toBe('Sept 18th-20th')
  })
})
