/**
 * Wall-clock ↔ instant helpers for speaker invitations. Pure (Intl only).
 */

/** Offset (ms) of `tz` from UTC at the given instant. */
function tzOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - instant.getTime()
}

/**
 * The instant at which `date` (YYYY-MM-DD) `time` (HH:mm, '' = midnight) occurs
 * in `tz`. Two-pass so a DST change between the guess and the answer is handled.
 */
export function zonedStart(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  const naive = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
  let guess = naive - tzOffsetMs(new Date(naive), tz)
  guess = naive - tzOffsetMs(new Date(guess), tz)
  return new Date(guess)
}

/** HH:mm of an instant in `tz`. */
export function localHHmm(instant: string | Date, tz: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}

/** YYYY-MM-DD of an instant in `tz`. */
export function localISODate(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}

export function isISODate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`))
}

export function isHHmm(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s)
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
