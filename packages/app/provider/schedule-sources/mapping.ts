/**
 * Raw source rows → schedule rows, through a registry entry's column mapping
 * (docs/ECCLESIA_SCHEDULES.md §Mapping). PURE: no I/O, no clock, no config.
 *
 *   - date: `mapping.dateColumn`; a row with no parseable date is skipped
 *   - time: `mapping.timeColumn` when set and filled, else '09:00'
 *   - data: each mapped field with a non-empty cell, keyed by its CATALOGUE key
 *     (so every ecclesia's rows read the same, whatever its headers say), plus
 *     `Date` holding the source date cell as written
 *   - columns that are not mapped are dropped
 */
import type { RawRow, RegistryEntry, ScheduleRowInput } from './types'

function cell(row: RawRow, column: string | undefined): string {
  if (!column) return ''
  let value = row[column]
  if (value === undefined) {
    const want = column.trim().toLowerCase()
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === want)
    value = key === undefined ? undefined : row[key]
  }
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A cell → `YYYY-MM-DD`, or null. ISO dates are taken as written (no timezone shift). */
export function parseScheduleDate(value: string): string | null {
  if (!value) return null
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  // Same as SheetTransformer.parseDate: the sheet's local calendar date.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const toScheduleRows =
  (entry: RegistryEntry, ecclesia: string) =>
  (rows: RawRow[]): ScheduleRowInput[] => {
    const out: ScheduleRowInput[] = []
    for (const row of rows) {
      const rawDate = cell(row, entry.mapping.dateColumn)
      const date = parseScheduleDate(rawDate)
      if (!date) continue

      const scheduleData: Record<string, string> = { Date: rawDate }
      for (const field of entry.mapping.fields) {
        const value = cell(row, field.column)
        if (value !== '') scheduleData[field.key] = value
      }

      out.push({
        ecclesia,
        date,
        type: entry.kind,
        scheduleData,
        time: cell(row, entry.mapping.timeColumn) || '09:00',
      })
    }
    return out
  }
