import { config } from '@my/config'
import { Contact } from '@aws-sdk/client-sesv2'

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

export enum EmailListTypes {
  sundaySchool = 'sundaySchool',
  newsletter = 'newsletter',
  memorial = 'memorial',
  bibleClass = 'bibleClass',
  members = 'members',
  testList = 'testList',
  interEcclesia = 'interEcclesia',
}

export type ProgramTypeKeys = keyof typeof ProgramsTypes
export type EmailListTypeKeys = keyof typeof EmailListTypes

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

export type BackendLists = {
  listName: string
  defaultOptIn: boolean
  displayName: string
}

/**
 * The Type our Next JS returns describing Any Subscriber List
 */
export type BackendContactList = {
  lists: BackendLists[]
}

export type ContactsEmailPreferences = { [K in EmailListTypeKeys]: boolean }

export type ContactPreferences = {
  unsubscribed: boolean
  displayName: string
  preferences: ContactsEmailPreferences
  firstName?: string
  lastName?: string
  isMember?: boolean
}

export type ContactListMeta = {
  key: EmailListTypeKeys
  defaultOptIn: boolean
  displayName: string
}

export type SimplifiedContactListType = {
  lists: ContactListMeta[]
}

export type CreateUpdateListType = {
  oldListName?: string
  listName: string
  defaultOptIn: boolean
  displayName: string
}

export type CreateContactType = {
  email: email
  lists: ContactsEmailPreferences
}

export type GetContactType = {
  nextToken: string
  contacts: Contact[]
}

/**
 * string is an email address
 */
type email = string

export type SimplifiedContacts = {
  unsubscribed: string[]
  subscribed: { [key: email]: ContactPreferences }
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
}

export type SundaySchoolType = {
  Date: string | Date
  Key: ProgramsTypes.sundaySchool
  Refreshments: string
  'Holidays and Special Events'?: string
  // Timezone-aware datetime fields
  DateTime?: string        // Full ISO datetime in UTC: "2026-02-01T14:30:00.000Z"
  ServiceTimezone?: string // IANA timezone: "America/Toronto"
}

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
  Host?: string              // Host ecclesia name
  ZoomURL?: string           // Override Zoom URL
  MeetingID?: string         // Override Meeting ID
  MeetingPwd?: string        // Override Meeting Password
  InPerson?: string          // "Yes" or full address
  // Resolved at email render time (not from Sheets)
  resolvedAddress?: string   // Full address from ecclesia lookup
  resolvedVenue?: string     // Venue name from ecclesia lookup
}

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
} & (CycRegular | CycSpecial)

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