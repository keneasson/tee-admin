import type { RecurrenceRule } from '@my/app/types/meetings'

/**
 * Given a recurrence rule, compute the next occurrence strictly after `afterDate`.
 * Returns null if the rule has ended (past endDate with no future occurrences).
 */
export function computeNextOccurrence(
  rule: RecurrenceRule,
  afterDate: Date
): Date | null {
  const endDate = rule.endDate ? parseDate(rule.endDate) : null
  const startDate = parseDate(rule.startDate)
  const exceptions = new Set(rule.exceptions ?? [])

  // Begin searching from the day after afterDate
  let candidate = new Date(afterDate)
  candidate.setDate(candidate.getDate() + 1)

  // If candidate is before startDate, jump to startDate
  if (candidate < startDate) {
    candidate = new Date(startDate)
  }

  // Safety: don't search more than ~5 years ahead
  const maxSearch = new Date(afterDate)
  maxSearch.setFullYear(maxSearch.getFullYear() + 5)

  while (candidate <= maxSearch) {
    if (endDate && candidate > endDate) {
      return null
    }

    if (matchesRule(rule, candidate, startDate) && !exceptions.has(toISODate(candidate))) {
      return candidate
    }

    candidate.setDate(candidate.getDate() + 1)
  }

  return null
}

/**
 * Compute all occurrences of a recurrence rule within [from, to] inclusive.
 */
export function computeOccurrences(
  rule: RecurrenceRule,
  from: Date,
  to: Date
): Date[] {
  const results: Date[] = []
  const endDate = rule.endDate ? parseDate(rule.endDate) : null
  const startDate = parseDate(rule.startDate)
  const exceptions = new Set(rule.exceptions ?? [])

  let candidate = new Date(from)
  // If candidate is before startDate, jump to startDate
  if (candidate < startDate) {
    candidate = new Date(startDate)
  }

  while (candidate <= to) {
    if (endDate && candidate > endDate) {
      break
    }

    if (matchesRule(rule, candidate, startDate) && !exceptions.has(toISODate(candidate))) {
      results.push(new Date(candidate))
    }

    candidate.setDate(candidate.getDate() + 1)
  }

  return results
}

/**
 * Check if a specific date is an occurrence of the recurrence rule.
 */
export function isOccurrenceDate(
  rule: RecurrenceRule,
  date: Date
): boolean {
  const startDate = parseDate(rule.startDate)
  const endDate = rule.endDate ? parseDate(rule.endDate) : null
  const exceptions = new Set(rule.exceptions ?? [])

  if (date < startDate) return false
  if (endDate && date > endDate) return false
  if (exceptions.has(toISODate(date))) return false

  return matchesRule(rule, date, startDate)
}

// ─── Internal Helpers ───────────────────────────────────────────

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year!, month! - 1, day!)
}

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Get the day of the week (0=Sun..6=Sat) for a date.
 */
function getDayOfWeek(d: Date): number {
  return d.getDay()
}

/**
 * Get which week-of-month occurrence this weekday falls on.
 * E.g., the 2nd Wednesday of the month returns 2.
 */
function getWeekOfMonth(d: Date): number {
  return Math.ceil(d.getDate() / 7)
}

/**
 * Check if a date is the last occurrence of its weekday in the month.
 */
function isLastWeekdayOfMonth(d: Date): boolean {
  const nextWeek = new Date(d)
  nextWeek.setDate(nextWeek.getDate() + 7)
  return nextWeek.getMonth() !== d.getMonth()
}

/**
 * Count the number of weeks between two dates (floored).
 */
function weeksBetween(a: Date, b: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  return Math.floor((b.getTime() - a.getTime()) / msPerWeek)
}

/**
 * Check if a candidate date matches the recurrence rule pattern.
 * Does NOT check exceptions or endDate — caller handles those.
 */
function matchesRule(rule: RecurrenceRule, candidate: Date, startDate: Date): boolean {
  const { frequency, dayOfWeek, weekOfMonth, monthsOfYear } = rule

  switch (frequency) {
    case 'weekly': {
      if (dayOfWeek !== undefined && getDayOfWeek(candidate) !== dayOfWeek) return false
      // Must be on a week boundary from startDate
      const weeks = weeksBetween(startDate, candidate)
      if (weeks < 0) return false
      // For weekly: every 1 week
      return getDayOfWeek(candidate) === (dayOfWeek ?? getDayOfWeek(startDate))
    }

    case 'biweekly': {
      const dow = dayOfWeek ?? getDayOfWeek(startDate)
      if (getDayOfWeek(candidate) !== dow) return false
      const weeks = weeksBetween(startDate, candidate)
      return weeks >= 0 && weeks % 2 === 0
    }

    case 'monthly': {
      return matchesMonthlyPattern(candidate, dayOfWeek, weekOfMonth, startDate)
    }

    case 'quarterly': {
      if (!matchesMonthlyPattern(candidate, dayOfWeek, weekOfMonth, startDate)) return false
      // Must be in a month that is a multiple of 3 from the start month
      const monthDiff =
        (candidate.getFullYear() - startDate.getFullYear()) * 12 +
        (candidate.getMonth() - startDate.getMonth())
      return monthDiff >= 0 && monthDiff % 3 === 0
    }

    case 'semi_annual': {
      if (monthsOfYear && !monthsOfYear.includes(candidate.getMonth() + 1)) return false
      return matchesMonthlyPattern(candidate, dayOfWeek, weekOfMonth, startDate)
    }

    case 'annual': {
      // Same month and day pattern as startDate, or use dayOfWeek/weekOfMonth
      if (candidate.getMonth() !== startDate.getMonth()) return false
      if (dayOfWeek !== undefined && weekOfMonth !== undefined) {
        return matchesMonthlyPattern(candidate, dayOfWeek, weekOfMonth, startDate)
      }
      return candidate.getDate() === startDate.getDate()
    }

    default:
      return false
  }
}

function matchesMonthlyPattern(
  candidate: Date,
  dayOfWeek: number | undefined,
  weekOfMonth: number | undefined,
  startDate: Date
): boolean {
  const dow = dayOfWeek ?? getDayOfWeek(startDate)
  if (getDayOfWeek(candidate) !== dow) return false

  if (weekOfMonth === -1) {
    return isLastWeekdayOfMonth(candidate)
  }

  const wom = weekOfMonth ?? getWeekOfMonth(startDate)
  return getWeekOfMonth(candidate) === wom
}
