/**
 * Election voting window - shared by the newsletter web page and the
 * newsletter email so both show the Election Notice on exactly the same days.
 *
 * The window is whole CALENDAR DAYS in the event's timezone, inclusive of
 * both ends: active from the start of the start day through the end of the
 * close day.
 *
 * Stored values come in two shapes:
 * - midnight in the event timezone (what the form writes today), e.g.
 *   2026-12-13T05:00:00.000Z for Dec 13 in Toronto
 * - midnight UTC (legacy "YYYY-MM-DD" values), e.g. 2026-12-13T00:00:00.000Z
 *
 * To read the intended calendar day robustly: a plain "YYYY-MM-DD" string or
 * a value that is exactly midnight UTC is taken as its UTC date; anything else
 * is taken as its date in the event timezone. Reading a midnight-UTC value in
 * Toronto would land on the PREVIOUS day, which is why it gets the UTC rule.
 *
 * Pure: no platform imports, safe for web, native and email rendering.
 */

export const DEFAULT_ELECTION_TIMEZONE = 'America/Toronto'

type DateInput = Date | string | number | null | undefined

/** YYYY-MM-DD of an instant in a given IANA timezone. */
function ymdInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** The calendar day (YYYY-MM-DD) a stored election date means. */
export function electionCalendarDate(value: DateInput, timeZone: string = DEFAULT_ELECTION_TIMEZONE): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return null
  const isMidnightUtc =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  return isMidnightUtc ? date.toISOString().slice(0, 10) : ymdInTimeZone(date, timeZone)
}

type ElectionLike = {
  type?: string
  electionStartDate?: DateInput
  electionEndDate?: DateInput
  eventTimezone?: string
}

function resolveTimeZone(timeZone: string | undefined): string {
  const tz = timeZone || DEFAULT_ELECTION_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_ELECTION_TIMEZONE
  }
}

/**
 * True while voting is open: now is on or after the start day and on or
 * before the close day, both in the event timezone (default America/Toronto).
 */
export function isElectionActive(event: ElectionLike, now: Date = new Date()): boolean {
  if (event.type !== 'election-cycle') return false
  const timeZone = resolveTimeZone(event.eventTimezone)
  const start = electionCalendarDate(event.electionStartDate, timeZone)
  const end = electionCalendarDate(event.electionEndDate, timeZone)
  if (!start || !end) return false
  const today = ymdInTimeZone(now, timeZone)
  return start <= today && today <= end
}

/**
 * True until the close day is over in the event timezone, i.e. the same end
 * edge as isElectionActive. Used by the newsletter duration calculator so the
 * email keeps the election exactly as long as the notice shows, whatever the
 * server's own clock timezone is. Null when the event has no close date.
 */
export function isOnOrBeforeElectionClose(event: ElectionLike, now: Date = new Date()): boolean | null {
  const timeZone = resolveTimeZone(event.eventTimezone)
  const end = electionCalendarDate(event.electionEndDate, timeZone)
  if (!end) return null
  return ymdInTimeZone(now, timeZone) <= end
}
