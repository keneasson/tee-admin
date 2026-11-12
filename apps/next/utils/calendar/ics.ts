import { formatUtcBasic, zonedTimeToUtc, type ZonedStart } from './zoned-time'

/**
 * RFC 5545 iCalendar builder for speaker appointments (hosted .ics link in the
 * Speaker Confirmation email, docs/SPEAKER_INVITATIONS.md §8).
 *
 * TIME ZONES: times are emitted in UTC (`...Z`), not `TZID=` + VTIMEZONE.
 * A UTC instant is unambiguous, so Apple Calendar, Google import and Outlook
 * all place it correctly and show it in the reader's own zone (a Toronto
 * reader sees 11:00am; a visitor from Winnipeg sees 10:00am, which is right).
 * `TZID=` would need a VTIMEZONE whose DST rules we would have to generate per
 * IANA zone with no library; Apple trusts the embedded VTIMEZONE, so a wrong
 * one moves the meeting. `X-WR-TIMEZONE` names the host zone as a display hint.
 *
 * UPDATES: `uid` must be stable per booking, and `sequence` must go up on every
 * change, so a re-imported file replaces the earlier entry. `method: 'CANCEL'`
 * emits `METHOD:CANCEL` + `STATUS:CANCELLED` with the same UID.
 */

export interface IcsOrganizer {
  name?: string
  email: string
}

export interface BuildIcsInput {
  /** Stable per booking, e.g. `speaker-invite-{inviteId}@tee-admin.com`. */
  uid: string
  /** 0 on first issue; increment on every change or cancel. */
  sequence: number
  method: 'PUBLISH' | 'CANCEL'
  /** Local wall-clock start in `timezone`. */
  start: ZonedStart
  durationMinutes: number
  /** IANA zone of the hall, e.g. `America/Toronto`. */
  timezone: string
  title: string
  description?: string
  /** Hall name, e.g. "Toronto East Christadelphian Hall". */
  locationName?: string
  /** Full street address. */
  address?: string
  /** Link back to the manage page. */
  url?: string
  organizer?: IcsOrganizer
  /** DTSTAMP; defaults to now. Injected for deterministic tests. */
  now?: Date
}

const CRLF = '\r\n'
const PRODID = '-//Echad Hub//Speaker Invitations//EN'

/** Escape a TEXT value (RFC 5545 §3.3.11): backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/** A parameter value (e.g. CN=) — quoted when it holds `:;,`; DQUOTE is not allowed inside. */
function paramValue(value: string): string {
  const clean = value.replace(/["\r\n]/g, '')
  return /[:;,]/.test(clean) ? `"${clean}"` : clean
}

/**
 * Fold a content line to at most 75 octets per physical line (RFC 5545 §3.1).
 * Continuation lines start with one space, which counts toward their 75.
 * Never splits a UTF-8 multi-byte character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ''
  let currentBytes = 0
  let limit = 75
  for (const ch of line) {
    const bytes = encoder.encode(ch).length
    if (currentBytes + bytes > limit) {
      out.push(current)
      current = ' '
      currentBytes = 1
      limit = 75
    }
    current += ch
    currentBytes += bytes
  }
  out.push(current)
  return out.join(CRLF)
}

export function buildIcs(input: BuildIcsInput): string {
  if (!Number.isInteger(input.sequence) || input.sequence < 0) {
    throw new Error('sequence must be a non-negative integer')
  }
  if (!(input.durationMinutes > 0)) throw new Error('durationMinutes must be positive')

  const startUtc = zonedTimeToUtc(input.start, input.timezone)
  const endUtc = new Date(startUtc.getTime() + input.durationMinutes * 60_000)
  const cancelled = input.method === 'CANCEL'
  const location = [input.locationName, input.address]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ')

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${input.method}`,
    `X-WR-TIMEZONE:${input.timezone}`,
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${formatUtcBasic(input.now ?? new Date())}`,
    `DTSTART:${formatUtcBasic(startUtc)}`,
    `DTEND:${formatUtcBasic(endUtc)}`,
    `SUMMARY:${escapeIcsText(cancelled ? `Cancelled: ${input.title}` : input.title)}`,
  ]
  if (input.description) lines.push(`DESCRIPTION:${escapeIcsText(input.description)}`)
  if (location) lines.push(`LOCATION:${escapeIcsText(location)}`)
  if (input.url) lines.push(`URL:${input.url}`)
  if (input.organizer) {
    const cn = input.organizer.name ? `;CN=${paramValue(input.organizer.name)}` : ''
    lines.push(`ORGANIZER${cn}:mailto:${input.organizer.email}`)
  }
  lines.push(
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  )

  return lines.map(foldIcsLine).join(CRLF) + CRLF
}
