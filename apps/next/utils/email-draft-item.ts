import type { EmailDraft } from '@my/app/types/email-draft'

/** A stored `EMAIL_DRAFT#` item → the API's EmailDraft shape. */
export function toEmailDraft(item: Record<string, any>): EmailDraft {
  return {
    id: String(item.skey).replace('EMAIL_DRAFT#', ''),
    subject: item.subject,
    htmlContent: item.htmlContent,
    selectedList: item.selectedList,
    note: item.note,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: item.createdBy,
    lastTestedAt: item.lastTestedAt,
    sentAt: item.sentAt,
    copiedFrom: item.copiedFrom,
    status: item.status || 'draft',
  }
}

/**
 * Condition: the draft exists AND has not been sent. Needs
 * `#status` → 'status' and `:sent` → 'sent' in the expression maps.
 * A sent email is a permanent record of what went out.
 */
export const EXISTS_AND_NOT_SENT =
  'attribute_exists(skey) AND (attribute_not_exists(#status) OR #status <> :sent)'

/**
 * Classify a failed conditional write made with
 * `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'`: if DynamoDB hands back
 * the old item, the draft exists (so it was refused because it is sent);
 * if not, the draft does not exist. Returns null for any other error.
 */
export function conditionFailure(error: unknown): 'missing' | 'sent' | null {
  const e = error as { name?: string; Item?: unknown }
  if (e?.name !== 'ConditionalCheckFailedException') return null
  return e.Item ? 'sent' : 'missing'
}
