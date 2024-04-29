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

export type ContactPrefPreferences = { [K in EmailListTypeKeys]: boolean }

export type ContactPreferencesProps = {
  email: string
  preferences: ContactPrefPreferences
}

export type ContactListProps = {
  listName: string
  contact: ContactPreferencesProps
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
