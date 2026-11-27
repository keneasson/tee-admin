import type { EmailDraft, UpdateEmailDraftInput } from '../types/email-draft'

/**
 * The fields that make up what recipients actually receive. Changing any of
 * them means an earlier test no longer describes this draft.
 * `note` is not here: editing it on an unsent draft does not undo its test.
 */
export const DRAFT_CONTENT_FIELDS = ['subject', 'htmlContent', 'selectedList'] as const

export type DraftContentField = (typeof DRAFT_CONTENT_FIELDS)[number]

export const SENT_EMAIL_LOCKED_MESSAGE =
  'This email was already sent; copy it to make changes.'

export interface DraftUpdatePlan {
  /** Content fields whose new value differs from the stored one. */
  changedContentFields: DraftContentField[]
  /**
   * The email was already SENT. A sent email is a permanent, fully frozen
   * record of what went out — subject, body, list AND note — so any update is
   * refused (409). The way to reuse it is to copy it.
   */
  locked: boolean
  /**
   * The update changes the content of a TESTED draft (or one that still
   * carries `lastTestedAt`): it goes back to `draft` and `lastTestedAt` is
   * removed, so the new content has to be tested again.
   */
  resetToDraft: boolean
}

/**
 * Decide whether a draft update is allowed and what it does to the draft's
 * test state.
 */
export function planDraftUpdate(
  existing: Pick<EmailDraft, DraftContentField | 'status' | 'lastTestedAt'>,
  update: Partial<Pick<UpdateEmailDraftInput, DraftContentField | 'note'>>
): DraftUpdatePlan {
  const changedContentFields = DRAFT_CONTENT_FIELDS.filter(
    (field) => update[field] !== undefined && update[field] !== existing[field]
  )
  const status = existing.status ?? 'draft'
  const locked = status === 'sent'
  return {
    changedContentFields,
    locked,
    resetToDraft:
      !locked &&
      changedContentFields.length > 0 &&
      (status === 'tested' || existing.lastTestedAt !== undefined),
  }
}
