import { getTimezoneCityName } from '@my/app/utils/timezone'
import type { InviteSlot, NoMeetingReason, SpeakerInviteStatus, SpeakerInviteType } from './types'

/** What the inviter picks in the composer, and how the list names each type. */
export const INVITE_TYPE_LABEL: Record<SpeakerInviteType, string> = {
  memorial: 'Memorial exhortation',
  bible_class: 'Bible Class',
  lecture: 'Lecture',
}

/** "An invitation to {phrase} at {ecclesia}" (spec §1). */
export const INVITE_TYPE_PHRASE: Record<SpeakerInviteType, string> = {
  memorial: 'exhort at the Memorial',
  bible_class: 'lead Bible Class',
  lecture: 'give a Lecture',
}

export const INVITE_STATUS_LABEL: Record<SpeakerInviteStatus, string> = {
  sent: 'Waiting for a reply',
  accepted: 'Accepted',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const REASON_LABEL: Record<NoMeetingReason, string> = {
  NO_SCHEDULE_ROW: 'No meeting scheduled',
  CANCELLED: 'Meeting cancelled',
  NO_SERVICE_AT_HALL: 'No service at the hall',
  SPECIAL_OCCASION: 'Special occasion',
}

/** "Sunday, November 15, 2026" for a YYYY-MM-DD (no timezone drift). */
export function formatDate(date: string, opts: { short?: boolean } = {}): string {
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    weekday: opts.short ? 'short' : 'long',
    month: opts.short ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "11:00 a.m." for an HH:mm local time; '' when the schedule has no time. */
export function formatTime(time: string | undefined): string {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return ''
  const [h, m] = time.split(':').map(Number)
  const d = new Date(Date.UTC(2000, 0, 1, h, m))
  return d.toLocaleTimeString('en-CA', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' })
}

/** "Sunday, November 15, 2026 at 11:00 a.m. (Toronto time)". */
export function formatWhen(date: string, time?: string, tz?: string): string {
  const t = formatTime(time)
  const zone = tz ? ` (${getTimezoneCityName(tz)} time)` : ''
  return t ? `${formatDate(date)} at ${t}${zone}` : formatDate(date)
}

/** The label a non-open slot carries in a list (never hidden, ADR-0005). */
export function slotLabel(slot: InviteSlot): string {
  if (slot.state === 'OPEN') return 'Open'
  if (slot.state === 'FILLED') return slot.speakerName ? `Filled: ${slot.speakerName}` : 'Filled'
  const reason = slot.reason ? REASON_LABEL[slot.reason] : 'No meeting'
  return slot.reasonNote ? `${reason}: ${slot.reasonNote}` : reason
}

/** The name the page addresses: "Brother {Surname}", else the first name. */
export function brotherName(invitee: { firstName?: string; lastName?: string } | null | undefined): string {
  const last = invitee?.lastName?.trim()
  if (last) return `Brother ${last}`
  const first = invitee?.firstName?.trim()
  return first ? first : 'the invited speaker'
}

export function firstWord(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? ''
}

/** Today in the viewer's calendar, YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function addDaysISO(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/**
 * Fallback "Add to Google Calendar" link, used only until the invite API sends
 * its own `googleCalendarUrl`. Local `dates` (no `Z`) plus `ctz` open the form
 * at the hall's local time.
 */
export function googleCalendarFallback(input: {
  title: string
  date: string
  time?: string
  tz?: string
  location?: string
  durationMinutes: number
}): string | null {
  if (!input.time || !/^\d{2}:\d{2}$/.test(input.time)) return null
  const [h, m] = input.time.split(':').map(Number)
  const [y, mo, d] = input.date.split('-').map(Number)
  // Wall-clock time carried in a UTC Date purely for formatting.
  const start = new Date(Date.UTC(y, mo - 1, d, h, m))
  const end = new Date(start.getTime() + input.durationMinutes * 60_000)
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').slice(0, 15)
  const params = [
    `action=TEMPLATE`,
    `text=${encodeURIComponent(input.title)}`,
    `dates=${fmt(start)}/${fmt(end)}`,
    `location=${encodeURIComponent(input.location ?? '')}`,
    ...(input.tz ? [`ctz=${encodeURIComponent(input.tz)}`] : []),
  ]
  return `https://calendar.google.com/calendar/render?${params.join('&')}`
}
