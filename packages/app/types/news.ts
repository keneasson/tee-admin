// News Manager types — lightweight retrospective counterpart to Events.
// See https://github.com/keneasson/tee-admin/issues/41

import type { DocumentAttachment, EventSharingScope } from './events'

export type NewsCategory = 'medical' | 'general' | 'announcement'

export type NewsDurationWeeks = 1 | 2 | 3

/**
 * Poster image attached to a News item (Issue #47 — v2 of #41). Matches the
 * shape produced by the shared ImageUpload component (and Event photos).
 */
export interface NewsImage {
  url: string
  fileName: string
  originalName: string
  uploadedAt: Date
}

export interface NewsItem {
  id: string
  ecclesiaId: string
  authorId: string
  title: string
  body: string
  category?: NewsCategory
  /** Optional poster image shown on the details page (Issue #47). */
  posterImage?: NewsImage
  /** Optional attachments (PDFs etc.) linked from the details page (Issue #47). */
  documents?: DocumentAttachment[]
  publishedAt: Date
  expiresAt: Date
  durationWeeks: NewsDurationWeeks
  sharingScope: EventSharingScope
  emailBlastSentAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type CreateNewsRequest = Omit<
  NewsItem,
  'id' | 'createdAt' | 'updatedAt' | 'expiresAt' | 'publishedAt' | 'emailBlastSentAt'
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
