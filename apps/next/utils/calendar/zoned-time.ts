/**
 * Wall-clock time in an IANA time zone → the UTC instant it names.
 *
 * No dependency: `Intl.DateTimeFormat` knows every zone's offsets (including
 * DST) from the runtime's ICU data, so we ask it what the offset is at a
 * guessed instant and correct once. Used by the .ics and Google Calendar
 * builders, which both emit UTC times.
 */

/** A meeting's local start, as the schedule stores it. */
export interface ZonedStart {
  /** `YYYY-MM-DD`, the calendar date in `timezone`. */
  date: string
  /** `HH:mm` 24-hour wall-clock time in `timezone`. */
  time: string
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone)
  if (!f) {
    // Throws RangeError for an unknown zone, which is what we want.
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(timeZone, f)
  }
  return f
}

/** Offset of `timeZone` from UTC at `instantMs`, in ms (Toronto in winter = -5h). */
function offsetMs(instantMs: number, timeZone: string): number {
  const parts: Record<string, number> = {}
  for (const p of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value)
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  const wholeSeconds = Math.floor(instantMs / 1000) * 1000
  return asUtc - wholeSeconds
}

function parseStart({ date, time }: ZonedStart): [number, number, number, number, number] {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!d) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`)
  if (!t) throw new Error(`Invalid time "${time}", expected HH:mm`)
  return [Number(d[1]), Number(d[2]), Number(d[3]), Number(t[1]), Number(t[2])]
}

/**
 * The UTC instant of `start` read as wall-clock time in `timeZone`.
 * A time that does not exist (inside a spring-forward gap) resolves to the
 * instant one offset-correction lands on; meetings are never scheduled there.
 */
export function zonedTimeToUtc(start: ZonedStart, timeZone: string): Date {
  const [y, mo, d, h, mi] = parseStart(start)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const firstOffset = offsetMs(guess, timeZone)
  let result = guess - firstOffset
  const secondOffset = offsetMs(result, timeZone)
  if (secondOffset !== firstOffset) result = guess - secondOffset
  return new Date(result)
}

/** `20260301T160000Z` — the RFC 5545 UTC DATE-TIME form (also Google's `dates`). */
export function formatUtcBasic(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
