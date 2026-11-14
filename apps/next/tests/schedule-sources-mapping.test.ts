/**
 * toScheduleRows: raw source rows → schedule rows through a registry entry's
 * column mapping (docs/ECCLESIA_SCHEDULES.md §Mapping). Pure; placeholder data.
 */
import { describe, it, expect } from 'vitest'
import { parseScheduleDate, toScheduleRows } from '@my/app/provider/schedule-sources/mapping'
import type { RegistryEntry } from '@my/app/provider/schedule-sources/types'

const entry: RegistryEntry = {
  ecclesiaId: 'example-ecclesia',
  scheduleId: 'memorial',
  name: 'Memorial Service',
  kind: 'memorial',
  active: true,
  source: { kind: 'google-sheets', spreadsheetId: 'placeholder-sheet', tab: 'Rota' },
  mapping: {
    dateColumn: 'Sunday',
    timeColumn: 'Starts',
    fields: [
      { column: 'Speaker', key: 'Exhort', label: 'Exhort', rosterRole: true },
      { column: 'Chair', key: 'Preside', label: 'Preside', rosterRole: true },
      { column: 'Hymn', key: 'Hymn-opening', label: 'Opening Hymn', rosterRole: false },
    ],
  },
}

const map = toScheduleRows(entry, 'Example Ecclesia')

describe('toScheduleRows', () => {
  it('keys data by catalogue key, keeps the source date cell, drops unmapped columns', () => {
    const [row] = map([
      { Sunday: '2026-11-15', Starts: '11:00', Speaker: 'Ann Example', Chair: 'Bob Example', Hymn: 12, Notes: 'x' },
    ])
    expect(row).toEqual({
      ecclesia: 'Example Ecclesia',
      date: '2026-11-15',
      type: 'memorial',
      time: '11:00',
      scheduleData: { Date: '2026-11-15', Exhort: 'Ann Example', Preside: 'Bob Example', 'Hymn-opening': '12' },
    })
  })

  it('skips rows without a parseable date; empty cells are left out; time defaults to 09:00', () => {
    const rows = map([
      { Sunday: '', Speaker: 'Ann Example' },
      { Sunday: 'not a date', Speaker: 'Ann Example' },
      { Sunday: '2026-11-22', Speaker: '  ', Chair: null, Hymn: undefined },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].scheduleData).toEqual({ Date: '2026-11-22' })
    expect(rows[0].time).toBe('09:00')
  })

  it('matches headers case- and space-insensitively when not exact', () => {
    const [row] = map([{ ' sunday ': '2026-11-29', SPEAKER: 'Ann Example' }])
    expect(row.date).toBe('2026-11-29')
    expect(row.scheduleData.Exhort).toBe('Ann Example')
  })

  it('is pure: same input, same output, input untouched', () => {
    const input = [{ Sunday: '2026-11-15', Speaker: 'Ann Example' }]
    const copy = JSON.parse(JSON.stringify(input))
    expect(map(input)).toEqual(map(input))
    expect(input).toEqual(copy)
  })
})

describe('parseScheduleDate', () => {
  it('takes ISO dates as written and reads other formats as a local calendar date', () => {
    expect(parseScheduleDate('2026-11-15')).toBe('2026-11-15')
    expect(parseScheduleDate('2026-11-15T23:30:00Z')).toBe('2026-11-15')
    expect(parseScheduleDate('November 15, 2026')).toBe('2026-11-15')
    expect(parseScheduleDate('11/15/2026')).toBe('2026-11-15')
    expect(parseScheduleDate('')).toBeNull()
    expect(parseScheduleDate('soon')).toBeNull()
  })
})
