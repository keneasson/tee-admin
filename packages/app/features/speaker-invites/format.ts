import { getTimezoneCityName } from '@my/app/utils/timezone'
import { NO_MEETING_REASON_LABEL } from '@my/app/provider/dynamodb/speaker-invite-types'
import type { Slot } from './types'

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

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD (no timezone drift). */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

/** "Nov 15, 2026", optionally with the short weekday ("Sat, Nov 14, 2026"). */
export function formatShortDate(date: string, withWeekday: boolean): string {
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    ...(withWeekday ? { weekday: 'short' as const } : {}),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export interface UsualMeeting {
  weekday: number | null
  time: string | null
  /** "Sundays · 11:00 a.m."; '' when the list is empty. */
  label: string
}

/**
 * The ecclesia's regular day and time for this meeting: the most common
 * (weekday, time) among the listed slots. Derived from the schedule itself, so
 * it reads "Sundays · 11:00 a.m." for a Memorial and "Wednesdays · 7:30 p.m."
 * for a Wednesday Bible Class, with no per-ecclesia constant. Slots that differ
 * (a Saturday study day, a seasonal 10 a.m.) still show their own day/time.
 */
export function usualMeeting(slots: Pick<Slot, 'date' | 'time'>[]): UsualMeeting {
  const counts = new Map<string, number>()
  for (const s of slots) {
    const key = `${weekdayOf(s.date)}|${s.time ?? ''}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [key, n] of counts) {
    if (n > bestCount) {
      best = key
      bestCount = n
    }
  }
  if (!best) return { weekday: null, time: null, label: '' }
  const [wd, time] = best.split('|')
  const weekday = Number(wd)
  // 2023-01-01 was a Sunday.
  const dayName = new Date(Date.UTC(2023, 0, 1 + weekday, 12)).toLocaleDateString('en-CA', { timeZone: 'UTC', weekday: 'long' })
  const t = formatTime(time || undefined)
  return { weekday, time: time || null, label: t ? `${dayName}s · ${t}` : `${dayName}s` }
}

/** A slot's date, with the weekday/time only where they differ from the usual meeting. */
export function slotWhen(slot: Pick<Slot, 'date' | 'time'>, usual: UsualMeeting): string {
  const date = formatShortDate(slot.date, usual.weekday !== null && weekdayOf(slot.date) !== usual.weekday)
  const t = slot.time && slot.time !== usual.time ? formatTime(slot.time) : ''
  return t ? `${date} · ${t}` : date
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
export function slotLabel(slot: Slot): string {
  if (slot.state === 'OPEN') return 'Open'
  if (slot.state === 'FILLED') return slot.speakerName ? `Filled: ${slot.speakerName}` : 'Filled'
  const reason = slot.reason ? NO_MEETING_REASON_LABEL[slot.reason] : 'No meeting'
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

/** What a signed-in admin who isn't an RB/Rep sees instead of a broken page (403). */
export const NOT_AN_INVITER = 'Speaker invitations are sent by the Recording Brother or Rep of an ecclesia.'
