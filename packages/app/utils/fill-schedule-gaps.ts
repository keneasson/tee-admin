/**
 * Fill schedule gaps: every expected service date from today up to the last
 * stored row gets a row. Dates with no stored row get a placeholder flagged
 * `isPlaceholder: true` (shown greyed as "Coming soon"). Real rows are never
 * changed. The expected weekday comes from the service-time config (seasonal
 * periods included); dates no period covers (e.g. a summer recess) are not filled.
 *
 * Placeholders carry NO people, so redaction passes over them harmlessly. Anything
 * that consumes schedule rows for other purposes (newsletter, emails) should skip
 * rows where `isPlaceholder` is true.
 */
import type { ServiceTimePeriod } from '../config/schedule-fields'

export interface FillableRow {
  date: string // YYYY-MM-DD
  isPlaceholder?: boolean
  [key: string]: any
}

const DAY_MS = 86400000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const toUtcMs = (d: string) => Date.parse(`${d}T00:00:00Z`)
const fromUtcMs = (ms: number) => new Date(ms).toISOString().split('T')[0]

/** Today's date (YYYY-MM-DD) in the given timezone. */
export function todayInTimezone(timezone = 'America/Toronto', now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * The period covering a date, or null when none does. A seasonal period wins
 * when its month range matches; otherwise the year-round period (no months).
 * Unlike getActiveSchedulePeriod this does NOT fall back to the first entry, so
 * a schedule made only of seasonal periods has genuine "not held" months.
 */
export function periodForDate(schedule: ServiceTimePeriod[], date: string): ServiceTimePeriod | null {
  const month = Number(date.slice(5, 7))
  for (const p of schedule ?? []) {
    if (p.startMonth == null || p.endMonth == null) continue
    const inRange =
      p.startMonth <= p.endMonth
        ? month >= p.startMonth && month <= p.endMonth
        : month >= p.startMonth || month <= p.endMonth
    if (inRange) return p
  }
  return (schedule ?? []).find((p) => p.startMonth == null || p.endMonth == null) ?? null
}

export interface FillScheduleGapsOptions {
  /** Schedule type written onto placeholders (same value the real rows use). */
  type: string
  /** Display name for the placeholder's `event` field. */
  eventName?: string
  location?: string
  /** Today as YYYY-MM-DD (defaults to today in America/Toronto). */
  today?: string
}

export function fillScheduleGaps<T extends FillableRow>(
  rows: T[],
  schedule: ServiceTimePeriod[],
  options: FillScheduleGapsOptions
): T[] {
  const today = options.today ?? todayInTimezone()
  const real = rows.filter((r) => !r.isPlaceholder)
  const realDates = real.map((r) => r.date).filter((d) => DATE_RE.test(d))
  if (realDates.length === 0) return rows

  const last = realDates.reduce((a, b) => (b > a ? b : a))
  if (last < today) return rows

  const realMs = realDates.map(toUtcMs)
  const placeholders: T[] = []

  for (let ms = toUtcMs(today); ms <= toUtcMs(last); ms += DAY_MS) {
    const date = fromUtcMs(ms)
    const period = periodForDate(schedule, date)
    if (!period) continue
    if (new Date(ms).getUTCDay() !== period.expectedDayOfWeek) continue
    // A real row within 3 days (same week, e.g. a service moved by a day or two)
    // covers this slot.
    if (realMs.some((r) => Math.abs(r - ms) <= 3 * DAY_MS)) continue
    placeholders.push({
      id: `${options.type}-placeholder-${date}`,
      date,
      time: period.displayTime || '',
      event: options.eventName ?? '',
      location: options.location ?? '',
      type: options.type,
      isNextEvent: false,
      hasConflict: false,
      userHighlight: false,
      isPlaceholder: true,
    } as unknown as T)
  }

  if (placeholders.length === 0) return rows
  return [...rows, ...placeholders].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}
