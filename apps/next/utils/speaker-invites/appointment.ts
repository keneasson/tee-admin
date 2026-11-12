import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { getTenantById, type TenantConfig } from '@my/app/config/tenants'
import { getTimezoneCityName } from '@my/app/utils/timezone'
import type { SpeakerInviteRecord, SpeakerInviteType } from '@my/app/provider/dynamodb/speaker-invite-types'
import { inviteTypeNoun } from 'email-builder/components/SpeakerInviteParts'
import { buildIcs } from '../calendar/ics'
import { buildGoogleCalendarUrl } from '../calendar/google-calendar-link'
import { getEcclesiaByName, type EcclesiaData } from '../dynamodb/locations'
import { resolveHallAddress } from '../email/exhorter-heads-up'

/**
 * The appointment as calendars and emails describe it: which brand, which
 * hall, how long, and the stable .ics identity. Shared by the email seam and
 * the hosted `.ics` route so the two can never disagree.
 */

/** How long each kind of appointment is blocked out in a calendar. */
export const SPEAKER_APPOINTMENT_MINUTES: Record<SpeakerInviteType, number> = {
  memorial: 90,
  bible_class: 90,
  lecture: 60,
}

/**
 * The brand an ecclesia's speaker email goes out under (one From per brand):
 * the home ecclesia → its own domain; every other ecclesia → Echad Hub.
 */
export function tenantForEcclesia(ecclesia: string): TenantConfig {
  return HOME_ECCLESIA.isHomeEcclesia(ecclesia) ? getTenantById('tee') : getTenantById('echadhub')
}

/** Links in the email point at the brand's own domain (as the render's homeUrl does). */
export function baseUrlFor(tenant: TenantConfig): string {
  return `https://${tenant.senderDomain}`
}

export function icsUid(inviteId: string, tenant: TenantConfig): string {
  return `speaker-invite-${inviteId}@${tenant.senderDomain}`
}

/** Goes up with every recorded change, so a re-imported .ics replaces the old entry. */
export function icsSequence(invite: Pick<SpeakerInviteRecord, 'history'>): number {
  return invite.history?.length ?? 0
}

export interface AppointmentPlace {
  ecclesiaName: string
  hallName?: string
  address?: string
  ecclesiaData: EcclesiaData | null
}

export async function appointmentPlace(ecclesia: string): Promise<AppointmentPlace> {
  const data = await getEcclesiaByName(ecclesia).catch(() => null)
  return {
    ecclesiaName: data?.name || ecclesia,
    ...(data?.venue?.trim() ? { hallName: data.venue.trim() } : {}),
    ...(resolveHallAddress(data) ? { address: resolveHallAddress(data) } : {}),
    ecclesiaData: data,
  }
}

export function appointmentTitle(type: SpeakerInviteType, ecclesiaName: string): string {
  return `${inviteTypeNoun(type)} at ${ecclesiaName}`
}

export interface AppointmentWhen {
  type: SpeakerInviteType
  date: string // YYYY-MM-DD
  time: string // HH:mm ('' → schedule has no time)
  tz: string
}

/** A start the calendar helpers accept; a missing time falls back to noon so the day is right. */
function zonedStartOf(w: AppointmentWhen) {
  return { date: w.date, time: w.time || '12:00' }
}

export function googleCalendarUrlFor(w: AppointmentWhen, place: AppointmentPlace, description?: string): string {
  return buildGoogleCalendarUrl({
    start: zonedStartOf(w),
    durationMinutes: SPEAKER_APPOINTMENT_MINUTES[w.type],
    timezone: w.tz,
    title: appointmentTitle(w.type, place.ecclesiaName),
    ...(description ? { description } : {}),
    ...(place.hallName ? { locationName: place.hallName } : {}),
    ...(place.address ? { address: place.address } : {}),
  })
}

export function icsFor(
  invite: SpeakerInviteRecord,
  w: AppointmentWhen,
  place: AppointmentPlace,
  tenant: TenantConfig,
  opts: { url?: string; organizer?: { name?: string; email: string }; now?: Date } = {}
): string {
  return buildIcs({
    uid: icsUid(invite.inviteId, tenant),
    sequence: icsSequence(invite),
    method: invite.status === 'cancelled' ? 'CANCEL' : 'PUBLISH',
    start: zonedStartOf(w),
    durationMinutes: SPEAKER_APPOINTMENT_MINUTES[w.type],
    timezone: w.tz,
    title: appointmentTitle(w.type, place.ecclesiaName),
    ...(place.hallName ? { locationName: place.hallName } : {}),
    ...(place.address ? { address: place.address } : {}),
    ...(opts.url ? { url: opts.url } : {}),
    ...(opts.organizer ? { organizer: opts.organizer } : {}),
    ...(opts.now ? { now: opts.now } : {}),
  })
}

// ---------------------------------------------------------------------------
// Display strings
// ---------------------------------------------------------------------------

/** "Sunday, November 15, 2026" — the date as written, independent of server zone. */
export function dateDisplay(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/** "11:00" → "11:00am", "19:30" → "7:30pm"; '' stays ''. */
export function timeDisplay(time: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '')
  if (!m) return ''
  const h = Number(m[1])
  const suffix = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]}${suffix}`
}

/** "Eastern Time (Toronto)". */
export function timezoneDisplay(tz: string): string {
  let generic = ''
  try {
    generic =
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longGeneric' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    generic = ''
  }
  const city = getTimezoneCityName(tz)
  return generic ? `${generic} (${city})` : city
}

export function whenDisplay(w: Pick<AppointmentWhen, 'date' | 'time'>): string {
  const t = timeDisplay(w.time)
  return t ? `${dateDisplay(w.date)} at ${t}` : dateDisplay(w.date)
}
