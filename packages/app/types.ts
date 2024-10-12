import { config } from '@my/config'
import { Contact } from '@aws-sdk/client-sesv2'

export type Conf = typeof config

declare module '@my/ui' {
  interface TamaguiCustomConfig extends Conf {}
}

export type GetContactsProps = {
  nextPageToken?: string
}

export enum ProgramsTypes {
  memorial = 'memorial',
  sundaySchool = 'sundaySchool',
  bibleClass = 'bibleClass',
  cyc = 'cyc',
}

export enum EmailListTypes {
  sundaySchool = 'sundaySchool',
  newsletter = 'newsletter',
  memorial = 'memorial',
  bibleClass = 'bibleClass',
  testList = 'testList',
}

export type ProgramTypeKeys = keyof typeof ProgramsTypes
export type EmailListTypeKeys = keyof typeof EmailListTypes

export type GoogleSheets = Record<
  ProgramTypeKeys,
  {
    name: string
    key: string
  }
>

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
export type SimplifiedContactsByList = { [key: email]: ContactPreferences }

export type SimplifiedContacts = {
  unsubscribed: string[]
  subscribed: { [K in EmailListTypeKeys]?: SimplifiedContactsByList }
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
