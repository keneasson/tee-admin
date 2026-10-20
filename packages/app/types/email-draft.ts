/**
 * A draft's audience: a mailing-list id (R5). Drafts saved before R5 hold an
 * old list key ('newsletter', 'memorial', …); the server resolves those to the
 * owner's list, and the editor swaps them for the listId when lists load.
 */
export type DraftListRef = string

export interface EmailDraft {
  id: string // UUID for the draft
  subject: string
  htmlContent: string // The rich text content
  selectedList: DraftListRef
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
  selectedList: DraftListRef
  note?: string
}

export interface UpdateEmailDraftInput extends CreateEmailDraftInput {
  id: string
}
