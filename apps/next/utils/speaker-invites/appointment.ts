import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { getTenantById, type TenantConfig } from '@my/app/config/tenants'
import { getTimezoneCityName } from '@my/app/utils/timezone'
import type {
  InviteProgramId,
  OnlineMeeting,
  SpeakerInviteRecord,
  SpeakerInviteType,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import { LEGACY_LENGTH_MINUTES, inviteWording } from '@my/app/provider/dynamodb/invite-program-types'
import { inviteTypeNoun } from 'email-builder/components/SpeakerInviteParts'
import { buildIcs } from '../calendar/ics'
import { buildGoogleCalendarUrl } from '../calendar/google-calendar-link'
import { getEcclesiaByName, type EcclesiaData } from '../dynamodb/locations'
import { DEFAULT_TEE_ZOOM, resolveHallAddress } from '../email/exhorter-heads-up'
import type { SlotDetail } from './slots'

/**
 * The appointment as calendars and emails describe it: which brand, which
 * hall, how long, and the stable .ics identity. Shared by the email seam and
 * the hosted `.ics` route so the two can never disagree.
 */

/** How long each core appointment is blocked out in a calendar (a program's own `lengthMinutes` wins). */
export const SPEAKER_APPOINTMENT_MINUTES: Record<SpeakerInviteType, number> = LEGACY_LENGTH_MINUTES

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

/** Ways to attend online: the occurrence's override first, as the heads-up does. */
export function onlineMeetingsFor(type: InviteProgramId, ecclesia: string, slot: SlotDetail | undefined): OnlineMeeting[] {
  const options = (slot?.override?.attendOptions ?? []).filter((o) => o.mode !== 'in_person')
  if (options.length > 0) {
    return options.map((o) => ({
      label: o.label,
      ...(o.url ? { url: o.url } : {}),
      ...(o.meetingId ? { meetingId: o.meetingId } : {}),
      ...(o.password ? { password: o.password } : {}),
      ...(o.dialInNumber ? { dialInNumber: o.dialInNumber } : {}),
    }))
  }
  const row = slot?.row ?? {}
  if (type === 'bible_class' && row.ZoomURL) {
    return [
      {
        label: 'Online',
        url: String(row.ZoomURL),
        ...(row.MeetingID ? { meetingId: String(row.MeetingID) } : {}),
        ...(row.MeetingPwd ? { password: String(row.MeetingPwd) } : {}),
      },
    ]
  }
  if (type === 'memorial' && HOME_ECCLESIA.isHomeEcclesia(ecclesia)) {
    const z = DEFAULT_TEE_ZOOM
    return [{ label: z.label, url: z.url, meetingId: z.meetingId, password: z.password, dialInNumber: z.dialInNumber }]
  }
  return []
}

/** "{noun} at {Ecclesia}". `type` is a core id or a program name (see `inviteTypeNoun`). */
export function appointmentTitle(type: InviteProgramId, ecclesiaName: string): string {
  return `${inviteTypeNoun(type)} at ${ecclesiaName}`
}

export interface AppointmentWhen {
  type: InviteProgramId
  date: string // YYYY-MM-DD
  time: string // HH:mm ('' → schedule has no time)
  tz: string
  /** The program's name as sent; omitted = the core type's label. */
  name?: string
  /** The program's length; omitted = the core type's length. */
  lengthMinutes?: number
}

/** The invite's appointment as calendars describe it (wording + length from its program snapshot). */
export function appointmentWhenOf(invite: SpeakerInviteRecord, date: string, time: string, tz: string): AppointmentWhen {
  const w = inviteWording(invite)
  return { type: invite.type, date, time, tz, name: w.name, lengthMinutes: w.lengthMinutes }
}

function minutesOf(w: AppointmentWhen): number {
  return w.lengthMinutes ?? inviteWording({ type: w.type }).lengthMinutes
}

/** A start the calendar helpers accept; a missing time falls back to noon so the day is right. */
function zonedStartOf(w: AppointmentWhen) {
  return { date: w.date, time: w.time || '12:00' }
}

export function googleCalendarUrlFor(w: AppointmentWhen, place: AppointmentPlace, description?: string): string {
  return buildGoogleCalendarUrl({
    start: zonedStartOf(w),
    durationMinutes: minutesOf(w),
    timezone: w.tz,
    title: appointmentTitle(w.name ?? w.type, place.ecclesiaName),
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
    durationMinutes: minutesOf(w),
    timezone: w.tz,
    title: appointmentTitle(w.name ?? w.type, place.ecclesiaName),
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
