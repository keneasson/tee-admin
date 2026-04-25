import type { BaseRecord } from '../provider/dynamodb/types'

// ─── Meeting Types ───────────────────────────────────────────────

export type MeetingType = 'business' | 'arranging_board' | 'committee' | 'planning' | 'general'

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  business: 'Business Meeting',
  arranging_board: 'Arranging Board',
  committee: 'Committee Meeting',
  planning: 'Planning Meeting',
  general: 'General Meeting',
}

// ─── Recurrence ──────────────────────────────────────────────────

export type RecurrenceFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semi_annual'
  | 'annual'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  dayOfWeek?: number              // 0=Sun..6=Sat
  weekOfMonth?: number            // 1-5, -1=last week
  monthsOfYear?: number[]         // 1-12 (e.g., [4, 10] for semi-annual April+October)
  startDate: string               // ISO date
  endDate?: string                // ISO date, optional
  exceptions?: string[]           // ISO dates to skip
}

// ─── Audience ────────────────────────────────────────────────────

export type AudienceConfig =
  | { type: 'ses_topic'; topic: string }
  | { type: 'ecclesia_members'; ecclesia: string }
  | { type: 'organization_members'; organizationName: string }
  | { type: 'custom'; emails: string[] }

// ─── Online Meeting ──────────────────────────────────────────────

export interface MeetingOnlineInfo {
  link?: string
  meetingId?: string
  passcode?: string
  dialIn?: string
  platform?: 'zoom' | 'google-meet' | 'teams' | 'other'
}

// ─── Location ────────────────────────────────────────────────────

export interface MeetingLocation {
  name?: string
  address?: string
}

// ─── Supersedes ──────────────────────────────────────────────────

export type SupersedableScheduleType = 'bibleClass' | 'memorial' | 'sundaySchool' | 'cyc'

export interface SupersedesConfig {
  scheduleType: SupersedableScheduleType
}

// ─── Document Attachment ─────────────────────────────────────────

export interface MeetingDocument {
  title: string
  url: string
}

// ─── Meeting Record ──────────────────────────────────────────────

/**
 * MeetingRecord — stored in tee-admin table
 *
 * Key pattern:
 *   pkey: MEETING#{meetingId}
 *   skey: DETAILS
 *   gsi1pk: OWNER#{ownerType}#{ownerName}
 *   gsi1sk: {nextOccurrence ISO date}
 */
export interface MeetingRecord extends BaseRecord {
  pkey: string
  skey: string
  gsi1pk: string
  gsi1sk: string

  meetingId: string
  title: string
  meetingType: MeetingType
  ownerType: 'ecclesia' | 'organization'
  ownerName: string

  // Schedule
  recurrence?: RecurrenceRule
  oneOffDate?: string               // ISO date for non-recurring meetings
  startTime: string                 // "19:30" (24h format)
  endTime?: string
  timezone: string                  // IANA timezone (e.g., "America/Toronto")

  // Location & platform
  platform: 'in_person' | 'online' | 'hybrid'
  location?: MeetingLocation
  onlineMeeting?: MeetingOnlineInfo

  // Content
  documents: MeetingDocument[]
  notes?: string

  // Supersedes (optional — only when this meeting replaces a regular program)
  supersedes?: SupersedesConfig

  // Audience
  audience: AudienceConfig

  // Lifecycle
  active: boolean
  nextOccurrence?: string           // computed ISO date, stored for GSI sorting
  lastSentAt?: string
  lastSentOccurrence?: string       // ISO date of the occurrence that was last emailed
  createdBy: string
  createdAt: string
  updatedAt: string
}

export function isMeetingRecord(record: any): record is MeetingRecord {
  return record && record.pkey && typeof record.pkey === 'string' && record.pkey.startsWith('MEETING#')
}
