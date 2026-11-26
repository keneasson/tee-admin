import type { EmailDraft, UpdateEmailDraftInput } from '../types/email-draft'

/**
 * The fields that make up what recipients actually receive. Changing any of
 * them means an earlier test (or send) no longer describes this draft.
 * `note` is deliberately NOT here: it is the sender's own annotation.
 */
const CONTENT_FIELDS = ['subject', 'htmlContent', 'selectedList'] as const

export type DraftContentField = (typeof CONTENT_FIELDS)[number]

export interface DraftUpdatePlan {
  /** Content fields whose new value differs from the stored one. */
  changedContentFields: DraftContentField[]
  /**
   * True when the draft must go back to `draft`: status = 'draft' and
   * `lastTestedAt` removed, so the new content has to be tested again.
   * `sentAt` is kept as history ("previously sent") — it is still true that
   * an earlier version went out at that time.
   */
  resetToDraft: boolean
}

/**
 * Decide what a draft update does to the draft's test/send state.
 *
 * A draft that was tested or sent, and whose subject, body or audience is
 * changed, is no longer the thing that was tested or sent — so it returns to
 * `draft`. A note-only edit (or a save with nothing changed) leaves it alone.
 */
export function planDraftUpdate(
  existing: Pick<EmailDraft, DraftContentField | 'status' | 'lastTestedAt'>,
  update: Partial<Pick<UpdateEmailDraftInput, DraftContentField | 'note'>>
): DraftUpdatePlan {
  const changedContentFields = CONTENT_FIELDS.filter(
    (field) => update[field] !== undefined && update[field] !== existing[field]
  )
  const hasTestOrSendState =
    (existing.status ?? 'draft') !== 'draft' || existing.lastTestedAt !== undefined
  return {
    changedContentFields,
    resetToDraft: changedContentFields.length > 0 && hasTestOrSendState,
  }
}
