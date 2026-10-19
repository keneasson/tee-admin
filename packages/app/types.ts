import { config } from '@my/config'

export type Conf = typeof config

declare module '@my/ui' {
  interface TamaguiCustomConfig extends Conf {}
}

export type GetContactsProps = {
  listTopic?: string
  nextPageToken?: string
}

export enum ProgramsTypes {
  memorial = 'memorial',
  sundaySchool = 'sundaySchool',
  bibleClass = 'bibleClass',
  cyc = 'cyc',
}

export enum Directory {
  directory = 'DIRECTORY',
}

export type GoogleSheetTypes = keyof typeof ProgramsTypes | keyof typeof Directory

// R5: the fixed `EmailListTypes` enum (newsletter, memorial, …) is gone. A send
// names a mailing list by its listId (apps/next/utils/mailing-lists/send-target.ts).

export type ProgramTypeKeys = keyof typeof ProgramsTypes

/**
 * Email reason types for sending emails
 * Moved from apps/next/utils/email/email-send.tsx for cross-platform compatibility
 */
export type EmailReasonType =
  | 'sunday-school'
  | 'newsletter'
  | 'bible-class'
  | 'recap'
  | 'business-meeting'
  | 'custom'
  | 'event-announcement'
  | 'inter-ecclesia'
  | 'news-alert'
  | 'post-announcement'

/**
 * Sub-reason for categorizing the purpose of an email send.
 * Especially valuable for inter-ecclesia and custom emails.
 */
export type EmailSubReason =
  | 'memorial'
  | 'lecture'
  | 'fraternal'
  | 'youth'
  | 'schedule'
  | 'transfer'
  | 'appeal'
  | 'correction'
  | 'general'

/**
 * Auth session types for cross-platform components
 * Components in packages/app should receive these as props, not use next-auth hooks
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthSession {
  user?: {
    email?: string | null
    name?: string | null
    image?: string | null
    role?: string
  }
  expires?: string
}

export interface AuthProps {
  session: AuthSession | null
  status: AuthStatus
}

export type GoogleSheet = {
  name: string
  key: string
  startTime: string
}

export type GoogleSheetData = {
  title: string
  type: GoogleSheetTypes
  content: any[]
  lastUpdated?: string
  version?: string
}

export type GoogleSheets = Record<ProgramTypeKeys, GoogleSheet>

/**
 * A mailing list a send screen can target (R5). `key` is the list's `listId`
 * (the send identifier); `listKey` is the owner's slug for it ('newsletter'),
 * used only to match records saved before lists had ids.
 */
export type ContactListMeta = {
  key: string
  defaultOptIn: boolean
  displayName: string
  listKey?: string
  isTest?: boolean
}

export type SimplifiedContactListType = {
  lists: ContactListMeta[]
  /** The sending owner's newsletter list, the usual default audience. */
  defaultListId?: string
}

// Re-export per-occurrence override types so consumers can import from @my/app/types.
export type {
  AttendOption,
  AttendMode,
  OverrideStatus,
  ServiceOverrideType,
} from '@my/app/provider/dynamodb/service-override-types'

/**
 * Per-occurrence override fields merged onto a synced service at read time.
 * Source of truth: packages/app/provider/dynamodb/service-override-types.ts.
 * `occurrenceDate` is the stable UTC YYYY-MM-DD key set by the transform paths.
 */
export type ServiceOverrideCarryFields = {
  overrideStatus?: import('@my/app/provider/dynamodb/service-override-types').OverrideStatus
  overrideMessage?: string
  overrideNote?: string
  attendOptions?: import('@my/app/provider/dynamodb/service-override-types').AttendOption[]
  occurrenceDate?: string
}

export type MemorialServiceType = {
  Date: string | Date
  Key: ProgramsTypes.memorial
  Preside: string
  Exhort: string
  Organist: string
  Steward: string
  Doorkeeper: string
  Collection: string
  Lunch: string
  Activities?: string
  Reading1: string
  Reading2: string
  'Hymn-opening': string
  'Hymn-exhortation': string
  'Hymn-memorial': string
  'Hymn-closing': string
  YouTube: string
  // Timezone-aware datetime fields
  DateTime?: string        // Full ISO datetime in UTC: "2026-02-01T16:00:00.000Z"
  ServiceTimezone?: string // IANA timezone: "America/Toronto"
} & ServiceOverrideCarryFields

export type SundaySchoolType = {
  Date: string | Date
  Key: ProgramsTypes.sundaySchool
  Refreshments: string
  'Holidays and Special Events'?: string
  // Timezone-aware datetime fields
  DateTime?: string        // Full ISO datetime in UTC: "2026-02-01T14:30:00.000Z"
  ServiceTimezone?: string // IANA timezone: "America/Toronto"
} & ServiceOverrideCarryFields

export type SundayEvents = MemorialServiceType &
  Pick<SundaySchoolType, 'Refreshments' | 'Holidays and Special Events'>
export type NextMemorialServiceProps = {
  events: SundayEvents[]
  note?: string
  upcomingEvents?: import('@my/app/types/events').Event[]
}

export type NextSundaySchoolProps = {
  events: SundaySchoolType[]
  note?: string
}

export type BibleClassType = {
  Date: string | Date
  Key: ProgramsTypes.bibleClass
  Presider: string
  Speaker: string
  Topic: string
  // Timezone-aware datetime fields
  DateTime?: string        // Full ISO datetime in UTC: "2026-02-06T00:30:00.000Z" (7:30pm Toronto)
  ServiceTimezone?: string // IANA timezone: "America/Toronto"
  // Joint Bible Class fields (from Google Sheets)
  MetaData?: string            // Descriptive title e.g. "joint Bible Class at MWE and via Zoom"
  Host?: string                // Host ecclesia name
  ZoomURL?: string             // Override Zoom URL
  MeetingID?: string           // Override Meeting ID
  MeetingPwd?: string          // Override Meeting Password
  InPerson?: string            // "Yes" or full address
  // Resolved at render time (not from Sheets)
  resolvedAddress?: string     // Full address from ecclesia lookup
  resolvedVenue?: string       // Venue name from ecclesia lookup
  resolvedMapUrl?: string      // Google Maps link for the host ecclesia
} & ServiceOverrideCarryFields

export type NextBibleClassProps = {
  events: BibleClassType[]
  note?: string
}

export type NextNewsletterProps = {
  events: SundayEvents[] | BibleClassType[]
}

type CycRegular = {
  type: 'regular'
  location: string
  speaker: string
  topic: string
}

type CycSpecial = {
  type: 'special'
  event: string
}

export type CycType = {
  Date: Date
  Key: ProgramsTypes.cyc
  // Timezone-aware datetime fields
  DateTime?: string        // Full ISO datetime in UTC
  ServiceTimezone?: string // IANA timezone: "America/Toronto"
} & (CycRegular | CycSpecial) & ServiceOverrideCarryFields

export type ProgramTypes = MemorialServiceType | SundaySchoolType | BibleClassType | CycType

export type DataTypes = CycType | DailyReadingsType

export type DailyReadingType = Record<string, string[]>

export type DailyReadingsType = {
  readings: DailyReadingType[]
}

export type DirectoryType = {
  Key: 'directory'
  LastName: string
  FirstName: string
  Address: string
  Phone: string
  Email: string
  Children: string
  ecclesia: string
}

export type GoogleSheetDirectory = {
  title: string
  type: 'directory'
  content: DirectoryType[]
}

export type GoogleSheetsAvailableTypes = ProgramTypes | DirectoryType