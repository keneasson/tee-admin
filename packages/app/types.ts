import { Contact } from '@aws-sdk/client-sesv2'

export type GetContactsProps = {
  listName: string
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
  key: string
  defaultOptIn: boolean
  displayName: string
}

/**
 * The Type our Next JS returns describing Any Subscriber List
 */
export type BackendContactList =
  | string
  | {
      listName: string
      lists: BackendLists[]
    }

export type ContactPrefPreferences = { [K in EmailListTypeKeys]: boolean }

export type ContactPreferences = {
  unsubscribed: boolean
  displayName: string
  preferences: ContactPrefPreferences
}

export type ContactListMeta = {
  key: EmailListTypeKeys
  defaultOptIn: boolean
  displayName: string
}

export type SimplifiedContactListType = {
  listName: EmailListTypeKeys
  lists: ContactListMeta[]
}

export type CreateContactType = {
  listName: string
  contact: {
    email: string
    preferences: { [K in EmailListTypeKeys] }
  }
}

export type GetContactType = {
  nextToken: string
  contacts: Contact[]
}

/**
 * string is an email address
 */
export type SimplifiedContactsByList = { [key: string]: ContactPreferences }

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
