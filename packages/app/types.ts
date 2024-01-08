export type ProgramTypeKeys = 'memorial' | 'sundaySchool' | 'bibleClass'

export type GoogleSheets = Record<
  ProgramTypeKeys,
  {
    name: string
    key: string
  }
>

export type MemorialServiceType = {
  Date: string | Date
  Key: 'memorial'
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
  Key: 'sundaySchool'
  Refreshments: string
  'Holidays and Special Events'?: string
}

export type BibleClassType = {
  Date: string | Date
  Key: 'bibleClass'
  Presider: string
  Speaker: string
  Topic: string
}

export type ProgramTypes = MemorialServiceType | SundaySchoolType | BibleClassType
