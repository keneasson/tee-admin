import { ScheduleRepository } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { speakerInviteRepository } from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import {
  applyOverrideToProgramItem,
  fetchServiceOverrides,
  normalizeToISODate,
  overrideKey,
} from '@my/app/utils/service-overrides/merge'
import { isPlaceholderName, normalizeName, resolveScheduleName } from '@my/app/utils/name-resolver'
import { toDirectoryPerson } from '@my/app/utils/name-resolver-directory'
import { isValidScheduleRow, detectSpecialOccasion } from '@my/app/utils/schedule-row-rules'
import { resolveServiceTime } from '@my/app/config/service-time-resolver'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import type { ScheduleTypeKey } from '@my/app/config/schedule-fields'
import type { ServiceOccurrenceOverrideRecord } from '@my/app/provider/dynamodb/service-override-types'
import type { ScheduleRecord } from '@my/app/provider/dynamodb/types'
import {
  INVITE_TYPE_SLOT,
  type Slot,
  type SpeakerBookingRecord,
  type SpeakerInviteType,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import { getEcclesiaByName } from '../dynamodb/locations'
import { localHHmm } from './time'

/**
 * "Is a meeting planned, and is the slot open?" — ONE function (spec §4).
 *
 * Reads: the ecclesia's schedule rows for the range (GSI1, one ecclesia), its
 * service overrides (one partition), and its speaker bookings (one partition).
 * Never a full-table read. Every expected meeting day in the range comes back
 * with a state — non-open dates are labelled, never dropped (ADR-0005).
 */

export type { NoMeetingReason, Slot, SlotState } from '@my/app/provider/dynamodb/speaker-invite-types'

/** A slot plus what the service needs to write it (never sent to clients). */
export interface SlotDetail extends Slot {
  override?: ServiceOccurrenceOverrideRecord
  booking?: SpeakerBookingRecord
  /** The merged schedule row (overlay applied), when one exists. */
  row?: Record<string, any>
  /**
   * The synced Sheet's own value for the slot field (before the overlay), and
   * who it resolves to. Only set when the overlay carries the field, i.e. when
   * the two can differ. Cancel/change use it: if the Sheet itself names the
   * departing speaker, removing the overlay key would bring them back.
   */
  baseName?: string
  basePersonId?: string
}

const scheduleRepository = new ScheduleRepository()

const MAX_RANGE_DAYS = 400

function* datesBetween(from: string, to: string): Generator<string> {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = start, n = 0; t <= end && n < MAX_RANGE_DAYS; t += 86_400_000, n++) {
    yield new Date(t).toISOString().slice(0, 10)
  }
}

function dayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

async function fetchRows(ecclesia: string, scheduleType: string, from: string, to: string): Promise<ScheduleRecord[]> {
  const rows: ScheduleRecord[] = []
  let lastEvaluatedKey: Record<string, any> | undefined
  do {
    const page = await scheduleRepository.getSchedulesByEcclesiaAndDateRange({
      ecclesia,
      startDate: from,
      endDate: to,
      lastEvaluatedKey,
    })
    rows.push(...page.items.filter((r) => r.type === scheduleType))
    lastEvaluatedKey = page.lastEvaluatedKey
  } while (lastEvaluatedKey)
  return rows
}

/** Resolve a schedule name to a personId via the name index (no directory scan). */
async function resolveNameToPersonId(name: string, cache: Map<string, string | undefined>): Promise<string | undefined> {
  const key = normalizeName(name).full
  if (!key) return undefined
  if (cache.has(key)) return cache.get(key)
  let personId: string | undefined
  try {
    const n = normalizeName(name)
    const { items } = await personRepository.searchByName(n.last, n.first)
    const match = resolveScheduleName(name, items.map(toDirectoryPerson))
    if (match.status === 'matched') personId = match.person.personId
  } catch (err) {
    console.error('[speaker-invites] name lookup failed:', err)
  }
  cache.set(key, personId)
  return personId
}

export interface SlotContext {
  slots: SlotDetail[]
  scheduleType: ScheduleTypeKey
  field: string
}

/**
 * Full slot detail for the service. `type` must be memorial or bible_class.
 */
export async function loadSlotDetails(
  ecclesia: string,
  type: SpeakerInviteType,
  from: string,
  to: string
): Promise<SlotContext> {
  const mapping = INVITE_TYPE_SLOT[type]
  if (!mapping) throw new Error(`getSlots: ${type} has no schedule to scan`)
  const scheduleType = mapping.scheduleType as ScheduleTypeKey
  const field = mapping.field

  const [rows, overrides, bookings, ecclesiaData] = await Promise.all([
    fetchRows(ecclesia, scheduleType, from, to),
    fetchServiceOverrides(ecclesia, [mapping.scheduleType], from, to),
    speakerInviteRepository.listBookings(ecclesia, type, from, to),
    getEcclesiaByName(ecclesia),
  ])

  const rowByDate = new Map<string, ScheduleRecord>()
  for (const r of rows) {
    const d = normalizeToISODate(r.date)
    if (d && d >= from && d <= to && !rowByDate.has(d)) rowByDate.set(d, r)
  }
  const bookingByDate = new Map(bookings.map((b) => [b.date, b]))

  // Every expected meeting day, plus any date that has a row / override / booking.
  const dates = new Set<string>()
  const expectedDow = resolveServiceTime(ecclesiaData?.scheduleConfig, scheduleType).expectedDayOfWeek
  for (const d of datesBetween(from, to)) if (dayOfWeek(d) === expectedDow) dates.add(d)
  for (const d of rowByDate.keys()) dates.add(d)
  for (const o of overrides.values()) if (o.serviceType === scheduleType && o.date >= from && o.date <= to) dates.add(o.date)
  for (const d of bookingByDate.keys()) dates.add(d)

  const nameCache = new Map<string, string | undefined>()
  const slots: SlotDetail[] = []

  for (const date of [...dates].sort()) {
    const record = rowByDate.get(date)
    const override = overrides.get(overrideKey(scheduleType, date))
    const booking = bookingByDate.get(date)
    const resolved = resolveServiceTime(ecclesiaData?.scheduleConfig, scheduleType, new Date(`${date}T12:00:00Z`))

    const raw = (record?.data ?? {}) as Record<string, any>
    const tz: string = record?.sourceTimezone || raw.ServiceTimezone || resolved.timezone || DEFAULT_TIMEZONE
    const dateTime: string | undefined = record?.dateTime || raw.DateTime
    const time = (dateTime ? localHHmm(dateTime, tz) : '') || resolved.defaultTime || ''

    const base: SlotDetail = { date, time, tz, state: 'NO_MEETING', override, booking }

    if (override?.status === 'cancelled') {
      slots.push({ ...base, reason: 'CANCELLED', ...(override.message ? { reasonNote: override.message } : {}) })
      continue
    }
    if (!record && override?.status !== 'active' && !booking) {
      slots.push({ ...base, reason: 'NO_SCHEDULE_ROW' })
      continue
    }

    const row = applyOverrideToProgramItem({ ...raw }, override)
    // A row exists (or the override forces the service on): the meeting is
    // planned. `isValidScheduleRow` marks a memorial row with only a
    // Lunch/Activities note as "no service at the hall". A row with nothing in
    // it yet is a planned meeting that nobody has been rostered for — OPEN.
    isValidScheduleRow(row, scheduleType)
    if (row.noServiceAtHall && override?.status !== 'active') {
      slots.push({ ...base, row, reason: 'NO_SERVICE_AT_HALL', reasonNote: String(row.Activities || row.Lunch || '').trim() })
      continue
    }
    const special = detectSpecialOccasion(row.Lunch, row.Activities)
    if (special && override?.status !== 'active') {
      slots.push({ ...base, row, reason: 'SPECIAL_OCCASION', reasonNote: special })
      continue
    }

    if (override?.roleFields?.[field] !== undefined) {
      const sheetName = String(raw[field] ?? '').trim()
      if (!isPlaceholderName(sheetName)) {
        base.baseName = sheetName
        const id = await resolveNameToPersonId(sheetName, nameCache)
        if (id) base.basePersonId = id
      }
    }

    const name = String(row[field] ?? '').trim()
    if (!isPlaceholderName(name)) {
      const overlayNamed = override?.roleFields?.[field] !== undefined
      const ref = overlayNamed ? override?.roleFieldRefs?.[field] : undefined
      const speakerPersonId =
        ref || (booking && !overlayNamed ? booking.personId : undefined) || (await resolveNameToPersonId(name, nameCache))
      slots.push({ ...base, row, state: 'FILLED', speakerName: name, ...(speakerPersonId ? { speakerPersonId } : {}) })
      continue
    }

    if (booking) {
      // A booking without a name on the merged row (someone cleared the overlay
      // by hand). The booking is still the lock, so the date is not open.
      const person = await personRepository.getById(booking.personId).catch(() => null)
      const speakerName = person ? `${person.firstName} ${person.lastName}`.trim() : undefined
      slots.push({ ...base, row, state: 'FILLED', speakerPersonId: booking.personId, ...(speakerName ? { speakerName } : {}) })
      continue
    }

    slots.push({ ...base, row, state: 'OPEN' })
  }

  return { slots, scheduleType, field }
}

/** Public shape: strips the internal override/booking/row. */
export function toPublicSlot(s: SlotDetail): Slot {
  const { override: _o, booking: _b, row: _r, baseName: _bn, basePersonId: _bp, ...slot } = s
  return slot
}

/**
 * Spec §4: `getSlots(ecclesia, type, from, to)`. Lecture has no schedule and
 * returns [] (its dates are typed by the inviter).
 */
export async function getSlots(ecclesia: string, type: SpeakerInviteType, from: string, to: string): Promise<Slot[]> {
  if (!INVITE_TYPE_SLOT[type]) return []
  const { slots } = await loadSlotDetails(ecclesia, type, from, to)
  return slots.map(toPublicSlot)
}
