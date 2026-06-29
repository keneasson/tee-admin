// News Manager types — lightweight retrospective counterpart to Events.
// See https://github.com/keneasson/tee-admin/issues/41

import type { DocumentAttachment, EventSharingScope } from './events'

export type NewsCategory = 'medical' | 'general' | 'announcement'

export type NewsDurationWeeks = 1 | 2 | 3

export interface NewsItem {
  id: string
  ecclesiaId: string
  authorId: string
  title: string
  body: string
  category?: NewsCategory
  /**
   * Uploaded attachments (Issue #47). One list for everything — images are
   * rendered inline on the details page, other files (PDFs, docs, Google Doc
   * links) become links. Type is derived from each attachment's mimeType.
   */
  documents?: DocumentAttachment[]
  publishedAt: Date
  expiresAt: Date
  durationWeeks: NewsDurationWeeks
  sharingScope: EventSharingScope
  emailBlastSentAt?: Date
  /**
   * Email audiences (EmailListTypes keys, e.g. 'newsletter', 'interEcclesia')
   * this item has been blasted to live. Lets the same post go to multiple
   * audiences without the one-shot guard falsely blocking a second, different
   * send. Legacy items predating this field are treated as having gone to
   * 'newsletter' when `emailBlastSentAt` is set.
   */
  emailBlastAudiences?: string[]
  createdAt: Date
  updatedAt: Date
}

export type CreateNewsRequest = Omit<
  NewsItem,
  | 'id'
  | 'createdAt'
  | 'updatedAt'
  | 'expiresAt'
  | 'publishedAt'
  | 'emailBlastSentAt'
  | 'emailBlastAudiences'
> & {
  publishedAt?: Date
}

export type UpdateNewsRequest = Partial<Omit<NewsItem, 'createdAt'>> & { id: string }

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function computeNewsExpiresAt(publishedAt: Date, durationWeeks: NewsDurationWeeks): Date {
  return new Date(publishedAt.getTime() + durationWeeks * WEEK_MS)
}

export function isNewsActive(item: Pick<NewsItem, 'expiresAt'>, now: Date = new Date()): boolean {
  return new Date(item.expiresAt).getTime() > now.getTime()
}
