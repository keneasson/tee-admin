import { v4 as uuidv4 } from 'uuid'
import { scheduleRepo } from '@my/app/provider/dynamodb'
import type { ScheduleRecord } from '@my/app/provider/dynamodb/types'
import {
  NewsItem,
  CreateNewsRequest,
  UpdateNewsRequest,
  computeNewsExpiresAt,
  isNewsActive,
} from '@my/app/types/news'

/**
 * News Service — CRUD for News items (Issue #41).
 *
 * Storage: tee-schedules table with PK: NEWS#{id}, SK: DETAILS.
 * Full NewsItem is stored as JSON in the `details` field, matching the
 * Event storage pattern.
 */

const serializeNews = (news: NewsItem): string => JSON.stringify(news)

const deserializeNews = (raw: string): NewsItem => {
  const parsed = JSON.parse(raw)
  if (parsed.publishedAt) parsed.publishedAt = new Date(parsed.publishedAt)
  if (parsed.expiresAt) parsed.expiresAt = new Date(parsed.expiresAt)
  if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt)
  if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt)
  if (parsed.emailBlastSentAt) parsed.emailBlastSentAt = new Date(parsed.emailBlastSentAt)
  if (parsed.posterImage?.uploadedAt) {
    parsed.posterImage.uploadedAt = new Date(parsed.posterImage.uploadedAt)
  }
  if (Array.isArray(parsed.documents)) {
    parsed.documents = parsed.documents.map((doc: any) => ({
      ...doc,
      uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : doc.uploadedAt,
    }))
  }
  return parsed as NewsItem
}

const newsToRecord = (news: NewsItem): any => ({
  PK: `NEWS#${news.id}`,
  SK: 'DETAILS',
  GSI1PK: 'NEWS',
  GSI1SK: `${news.publishedAt.toISOString()}#${news.id}`,
  type: 'news' as const,
  ecclesia: news.ecclesiaId,
  date: news.publishedAt.toISOString().split('T')[0],
  newsId: news.id,
  title: news.title,
  sharingScope: news.sharingScope,
  publishedAt: news.publishedAt.toISOString(),
  expiresAt: news.expiresAt.toISOString(),
  details: serializeNews(news),
})

const recordToNews = (record: ScheduleRecord): NewsItem => {
  if (!record.details || typeof record.details !== 'string') {
    throw new Error('News data not found in record')
  }
  return deserializeNews(record.details)
}

export const createNewsItem = async (data: CreateNewsRequest): Promise<NewsItem> => {
  const id = uuidv4()
  const now = new Date()
  const publishedAt = data.publishedAt ? new Date(data.publishedAt) : now
  const expiresAt = computeNewsExpiresAt(publishedAt, data.durationWeeks)

  const news: NewsItem = {
    id,
    ecclesiaId: data.ecclesiaId,
    authorId: data.authorId,
    title: data.title,
    body: data.body,
    category: data.category,
    posterImage: data.posterImage,
    documents: data.documents,
    publishedAt,
    expiresAt,
    durationWeeks: data.durationWeeks,
    sharingScope: data.sharingScope,
    createdAt: now,
    updatedAt: now,
  }

  await scheduleRepo.put({
    ...newsToRecord(news),
    lastUpdated: now.toISOString(),
    version: 1,
  } as any)

  return news
}

export const getNewsItemById = async (id: string): Promise<NewsItem | null> => {
  const record = await scheduleRepo.getNews(id)
  if (!record) return null
  return recordToNews(record)
}

export const updateNewsItem = async (update: UpdateNewsRequest): Promise<NewsItem> => {
  const existing = await getNewsItemById(update.id)
  if (!existing) throw new Error(`News item ${update.id} not found`)

  // If durationWeeks changes, recompute expiresAt from the current publishedAt
  const durationWeeks = update.durationWeeks ?? existing.durationWeeks
  const publishedAt = update.publishedAt ? new Date(update.publishedAt) : existing.publishedAt
  const expiresAt =
    update.durationWeeks || update.publishedAt
      ? computeNewsExpiresAt(publishedAt, durationWeeks)
      : existing.expiresAt

  const updated: NewsItem = {
    ...existing,
    ...update,
    id: existing.id,
    createdAt: existing.createdAt,
    publishedAt,
    durationWeeks,
    expiresAt,
    updatedAt: new Date(),
  }

  await scheduleRepo.update(`NEWS#${update.id}`, 'DETAILS', newsToRecord(updated) as any)
  return updated
}

export const deleteNewsItem = async (id: string): Promise<boolean> => {
  try {
    await scheduleRepo.deleteNews(id)
    return true
  } catch (error) {
    console.error('Failed to delete news item:', error)
    return false
  }
}

export const listNewsItems = async (
  options: { includeExpired?: boolean } = {}
): Promise<NewsItem[]> => {
  const records = await scheduleRepo.getAllNews()
  const items = records.map(recordToNews)
  const filtered = options.includeExpired ? items : items.filter((item) => isNewsActive(item))
  return filtered.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

export const markNewsBlastSent = async (id: string): Promise<NewsItem> => {
  return updateNewsItem({ id, emailBlastSentAt: new Date() })
}
