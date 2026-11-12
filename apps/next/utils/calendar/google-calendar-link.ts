import { formatUtcBasic, zonedTimeToUtc, type ZonedStart } from './zoned-time'

/**
 * "Add to Google Calendar" URL for the Speaker Confirmation email.
 *
 * `dates` is given in UTC (`...Z/...Z`), which is unambiguous; `ctz` tells
 * Google which zone to show the event in (the hall's), so the form opens at
 * the local meeting time.
 */
export interface GoogleCalendarLinkInput {
  start: ZonedStart
  durationMinutes: number
  /** IANA zone of the hall, e.g. `America/Toronto`. */
  timezone: string
  title: string
  description?: string
  locationName?: string
  address?: string
}

export function buildGoogleCalendarUrl(input: GoogleCalendarLinkInput): string {
  const startUtc = zonedTimeToUtc(input.start, input.timezone)
  const endUtc = new Date(startUtc.getTime() + input.durationMinutes * 60_000)
  const location = [input.locationName, input.address]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(', ')

  const params: Array<[string, string]> = [
    ['action', 'TEMPLATE'],
    ['text', input.title],
    ['dates', `${formatUtcBasic(startUtc)}/${formatUtcBasic(endUtc)}`],
    ['details', input.description ?? ''],
    ['location', location],
    ['ctz', input.timezone],
  ]
  // `dates` is only digits, T, Z and `/`; keep the separator literal, as Google documents it.
  const query = params
    .map(([k, v]) => `${k}=${k === 'dates' ? v : encodeURIComponent(v)}`)
    .join('&')
  return `https://calendar.google.com/calendar/render?${query}`
}
