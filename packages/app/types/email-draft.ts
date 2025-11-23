export type EmailListTypeKeys = 'sundaySchool' | 'newsletter' | 'memorial' | 'bibleClass' | 'members' | 'testList'

export interface EmailDraft {
  id: string // UUID for the draft
  subject: string
  htmlContent: string // The rich text content
  selectedList: EmailListTypeKeys
  note?: string
  createdAt: string // ISO date string
  updatedAt: string // ISO date string
  createdBy: string // User email
  lastTestedAt?: string // ISO date string - when it was last sent to test list
  sentAt?: string // ISO date string - when it was sent to production list
  status: 'draft' | 'tested' | 'sent'
}

export interface CreateEmailDraftInput {
  subject: string
  htmlContent: string
  selectedList: EmailListTypeKeys
  note?: string
}

export interface UpdateEmailDraftInput extends CreateEmailDraftInput {
  id: string
}
