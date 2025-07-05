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
  testList = 'testList',
}

export type ProgramTypeKeys = keyof typeof ProgramsTypes
export type EmailListTypeKeys = keyof typeof EmailListTypes

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
}

export type SundaySchoolType = {
  Date: string | Date
  Key: ProgramsTypes.sundaySchool
  Refreshments: string
  'Holidays and Special Events'?: string
}

export type SundayEvents = MemorialServiceType &
  Pick<SundaySchoolType, 'Refreshments' | 'Holidays and Special Events'>
export type NextMemorialServiceProps = {
  events: SundayEvents[]
}

export type NextSundaySchoolProps = {
  events: SundaySchoolType[]
}

export type BibleClassType = {
  Date: string | Date
  Key: ProgramsTypes.bibleClass
  Presider: string
  Speaker: string
  Topic: string
}

export type NextBibleClassProps = {
  events: BibleClassType[]
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