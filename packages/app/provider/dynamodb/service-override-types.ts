import type { BaseRecord } from './types'

/**
 * Per-occurrence Service Overrides
 *
 * The recurring "Regular Services" (memorial / bibleClass / sundaySchool / cyc)
 * are synced READ-ONLY from Google Sheets into the `tee-schedules` table. Admins
 * need to make exceptions for a single occurrence (cancel it, edit the "no service"
 * message, add a note, or list alternative ways to attend) WITHOUT editing the whole
 * Sheet. Those exceptions live here, in the app-managed `tee-admin` table, and are
 * merged onto the synced program at read time. We NEVER write to `tee-schedules`
 * (the sync would clobber it).
 *
 * Occurrence identity is (serviceType, date) — there is no stable per-occurrence id.
 */

// Service types that can be overridden (mirrors ProgramTypeKeys values; defined
// locally to avoid a circular import with packages/app/types.ts).
export type ServiceOverrideType = 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'

// undefined status = inherit the synced roster heuristics (current behaviour).
// 'cancelled' = force the no-service branch (with an optional custom message).
// 'active' = force the service to show even if the synced roster fields are blank.
export type OverrideStatus = 'cancelled' | 'active'

// Phase 2: a single way to attend an occurrence (in-person hall, external stream,
// or an online meeting). An occurrence may offer several simultaneously, e.g. a
// Toronto West stream AND a Toronto East Zoom.
export type AttendMode = 'in_person' | 'stream' | 'online'

export interface AttendOption {
  id: string // uuid, stable within the override record
  label: string // e.g. "Toronto West Stream", "Toronto East Zoom"
  mode: AttendMode
  url?: string // join/stream URL
  address?: string // in-person address
  mapsUrl?: string // google maps link
  meetingId?: string // online meeting id
  password?: string // online passcode
  platform?: string // 'zoom' | 'google-meet' | 'teams' | 'webex' | 'custom-stream'
  dialInNumber?: string
  hostEcclesia?: string // for "hosted by" attribution
}

/**
 * Stored in `tee-admin` (lowercase pkey/skey).
 * PK: SERVICE_OVERRIDE#{ecclesia}
 * SK: {serviceType}#{date}   (date = YYYY-MM-DD, UTC-normalized)
 */
export interface ServiceOccurrenceOverrideRecord extends BaseRecord {
  pkey: string // SERVICE_OVERRIDE#{ecclesia}
  skey: string // {serviceType}#{date}

  ecclesia: string
  serviceType: ServiceOverrideType
  date: string // YYYY-MM-DD (UTC-normalized)

  status?: OverrideStatus
  message?: string // editable "No service…" text (used when cancelled)
  note?: string // free-form announcement (shown regardless of status)
  attendOptions?: AttendOption[] // Phase 2

  // Slice A (#110): per-ROLE field values, natively edited as an overlay on the
  // synced Google-Sheets base. Map of catalogue fieldKey (Exhort/Preside/Speaker/…
  // — see SCHEDULE_TYPE_CATALOGUE) → free-text value. Only keys the admin actually
  // changed are stored; absent keys keep the synced value at read time. The app
  // NEVER writes these back to Sheets (`tee-schedules` stays a one-way input).
  roleFields?: Record<string, string>

  // Slice B (#110): parallel metadata map, catalogue fieldKey → PersonRecord
  // personId, recording WHICH directory member an admin picked for a role via the
  // member-picker. This is metadata for future linking ONLY — it is deliberately
  // NOT applied to the program item at read time, so the display value in
  // `roleFields` still solely drives what renders (and gets first-name redacted).
  // `roleFieldRefs` must NEVER reach the anon/public read path.
  roleFieldRefs?: Record<string, string>

  createdBy: string
  createdAt: string
  updatedAt: string
}

export function isServiceOccurrenceOverrideRecord(
  record: any
): record is ServiceOccurrenceOverrideRecord {
  return record && typeof record.pkey === 'string' && record.pkey.startsWith('SERVICE_OVERRIDE#')
}
