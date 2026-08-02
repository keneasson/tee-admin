import Constants from 'expo-constants'
import {
  CreateContactType,
  CycType,
  DataTypes,
  GetContactType,
  ProgramsTypes,
  SimplifiedContactListType,
  EmailReasonType,
} from '@my/app/types'
import { CreateUpdateListType } from '../types'
import type { Event } from '@my/app/types/events'
import type { NewsItem } from '@my/app/types/news'
import type { Post } from '@my/app/types/post'

// Use shared EmailReasonType instead of importing from next-app
type emailReasons = EmailReasonType

const API_PATH =
  process.env.NEXT_PUBLIC_API_PATH || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH

/**
 * reads the JSON Data from the folder: ./apps/next/data/{KEY}
 * @param key
 */
export const getData = async (key: string): Promise<DataTypes> => {
  const url = `${API_PATH}api/json?name=${key}`
  const rawSchedule = await fetch(url, { next: { revalidate: 3600 } })
  const data = await rawSchedule.json()
  const today = new Date()
  return {
    Date: today,
    Key: ProgramsTypes.cyc,
    type: data.type,
    content: data,
    event: '',
  } as CycType
}

export const sendEmail = async (
  key: emailReasons,
  isTest?: boolean,
  note?: string,
  customData?: {
    htmlContent?: string
    subject?: string
    selectedList?: string
    eventId?: string
    eventType?: string
  }
): Promise<any> => {
  const params = new URLSearchParams()
  if (isTest) {
    params.append('test', 'true')
  }
  if (note && note.trim()) {
    params.append('note', note.trim())
  }
  const queryString = params.toString()
  const url = `${API_PATH}api/email/${key}${queryString ? `?${queryString}` : ''}`

  // For custom emails, event announcements, and inter-ecclesia, use POST with body data
  if ((key === 'custom' || key === 'event-announcement' || key === 'inter-ecclesia') && customData) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(customData),
      cache: 'no-store',
    })
    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
      return { error: errorData.failed || errorData.error || `Request failed with status ${response.status}`, details: errorData }
    }
    return await response.json()
  }

  // For other email types, use GET
  const rawSchedule = await fetch(url, { cache: 'no-store' })
  return await rawSchedule.json()
}

/**
 * Trigger a News item email blast (Issue #57). Sends the given News item to a
 * chosen audience via the existing `/api/admin/news/[id]/send-alert` route,
 * which already accepts a `list` audience override (incl. inter-ecclesia
 * leaders). Test sends always go to the test list, enforced server-side.
 */
export const sendNewsAlert = async (
  newsId: string,
  isTest: boolean,
  audienceKey: string
): Promise<any> => {
  const params = new URLSearchParams({ list: audienceKey })
  if (isTest) {
    params.set('test', 'true')
  }
  const url = `${API_PATH}api/admin/news/${newsId}/send-alert?${params.toString()}`
  const response = await fetch(url, { method: 'POST', cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      error: data.error || `Request failed with status ${response.status}`,
      details: data,
    }
  }
  return data
}

/**
 * Save a brief note that will be attached to the next scheduled email of the
 * given reason (consumed once it sends successfully). Used for cron-triggered
 * sends like the Saturday Memorial recap or the weekly newsletter.
 */
/**
 * Fetch any previously-saved pending note for a reason, including when/who
 * saved it so the UI can surface and flag stale notes.
 */
export const getPendingNote = async (
  reason: emailReasons
): Promise<{
  ok: boolean
  note: string | null
  createdAt: string | null
  createdBy: string | null
  error?: string
}> => {
  const url = `${API_PATH}api/email/pending-note?reason=${encodeURIComponent(reason)}`
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      note: null,
      createdAt: null,
      createdBy: null,
      error: data.error || `Request failed (${response.status})`,
    }
  }
  return {
    ok: true,
    note: data.note ?? null,
    createdAt: data.createdAt ?? null,
    createdBy: data.createdBy ?? null,
  }
}

export const savePendingNote = async (
  reason: emailReasons,
  note: string
): Promise<{ ok: boolean; error?: string }> => {
  const url = `${API_PATH}api/email/pending-note`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, note }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, error: data.error || `Request failed (${response.status})` }
  }
  return { ok: true }
}

/**
 * Clear any pending note for a reason without sending.
 */
export const clearPendingNote = async (
  reason: emailReasons
): Promise<{ ok: boolean; error?: string }> => {
  const url = `${API_PATH}api/email/pending-note`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, clear: true }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, error: data.error || `Request failed (${response.status})` }
  }
  return { ok: true }
}

export interface DirectSendPerson {
  id: string
  name: string
  email: string
  ecclesia?: string
  emails: string[]
}

/**
 * Lightweight name-or-email people search for the direct-recipient send.
 * Cross-platform safe (API_PATH). Returns members (one row per person) with
 * their known email addresses so the caller can pick which to send to.
 */
export const searchPeople = async (query: string): Promise<DirectSendPerson[]> => {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `${API_PATH}api/people?search=${encodeURIComponent(q)}&includeEmails=true`
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !Array.isArray(data?.members)) return []
  return (data.members as any[]).map((m) => {
    const extra = Array.isArray(m.emails)
      ? m.emails.map((e: any) => (typeof e === 'string' ? e : e?.email)).filter(Boolean)
      : []
    const unique = Array.from(
      new Set([m.email, ...extra].filter(Boolean).map((e: string) => e.toLowerCase()))
    )
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      ecclesia: m.ecclesia,
      emails: unique,
    }
  })
}

/**
 * Send ONE email of a given type to ONE explicitly-requesting recipient.
 * Bypasses TEST MODE by design; requires an explicit permission attestation
 * (also re-checked server-side). Does NOT subscribe the recipient or touch the
 * contact list.
 */
export const sendToOneRecipient = async (params: {
  reason: emailReasons
  to: string
  recipientName?: string
  permission: boolean
}): Promise<{ ok: boolean; subject?: string; error?: string }> => {
  const url = `${API_PATH}api/email/send-one`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.ok) {
    return { ok: false, error: data.error || `Request failed (${response.status})` }
  }
  return { ok: true, subject: data.subject }
}

/**
 * Recent admin events. Cross-platform safe (uses API_PATH, so it works under Expo,
 * not just web). Returns the raw array; callers apply their own filter (e.g. the
 * Email Sender keeps recent funerals/baptisms).
 */
export const getRecentEvents = async (): Promise<Event[]> => {
  const url = `${API_PATH}api/admin/events`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch events (${response.status})`)
  const data = await response.json()
  return Array.isArray(data) ? data : (data.events || [])
}

/**
 * News items. Cross-platform safe (uses API_PATH). Returns the raw array; callers
 * filter (e.g. the Email Sender keeps only active/unexpired items).
 */
export const getActiveNews = async (): Promise<NewsItem[]> => {
  const url = `${API_PATH}api/admin/news`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch news (${response.status})`)
  const data = await response.json()
  return Array.isArray(data) ? data : (data.items || [])
}

/**
 * Get a list of all Subscriber Lists.
 */
export const getContactsList = async (): Promise<SimplifiedContactListType> => {
  const url = `${API_PATH}api/contact/list/`
  const list = await fetch(url, { cache: 'no-store' })
  return await list.json()
}

/**
 * Add a new Subscriber List (Topic)
 */
export const addContactsList = async (createContact: CreateUpdateListType): Promise<string> => {
  const url = `${API_PATH}api/contact/list/`
  const body = JSON.stringify(createContact)
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  return await response.json()
}

/**
 * Get all the contacts from a Specific List (Topic)
 * @param nextToken if there's more - pass this to get "next page"
 */
export const getContacts = async (nextToken?: string | false): Promise<GetContactType> => {
  const urlNextToken = nextToken ? `?NextToken=${nextToken}` : ''
  const url = `${API_PATH}api/contact${urlNextToken}`
  const rawContacts = await fetch(url, { cache: 'no-store', method: 'GET' })
  return await rawContacts.json()
}

/**
 * add a contact to subscriber list
 * @param contact Add this contact to the subscriber list
 */
export const addContacts = async (contact: CreateContactType): Promise<string> => {
  const url = `${API_PATH}api/contact/`
  const body = JSON.stringify(contact)
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  return await response.json()
}

/**
 * update a contact in subscriber list
 * @param contact Add this contact to the subscriber list
 */
export const updateContacts = async (contact: CreateContactType): Promise<string> => {
  const url = `${API_PATH}api/contact/`
  const body = JSON.stringify(contact)
  const response = await fetch(url, { cache: 'no-store', method: 'PATCH', body })
  return await response.json()
}

/**
 * Search for contacts across both SES and DynamoDB directory
 * @param searchTerm The search term (minimum 2 characters)
 */
export const searchContacts = async (searchTerm: string): Promise<any> => {
  const url = `${API_PATH}api/admin/email/search?q=${encodeURIComponent(searchTerm)}`
  const response = await fetch(url, { cache: 'no-store', method: 'GET' })
  return await response.json()
}

/**
 * Merge two contact records into one
 * @param sourcePK Source contact partition key
 * @param sourceSK Source contact sort key
 * @param targetPK Target contact partition key
 * @param targetSK Target contact sort key
 */
export const mergeContacts = async (
  sourcePK: string,
  sourceSK: string,
  targetPK: string,
  targetSK: string
): Promise<any> => {
  const url = `${API_PATH}api/admin/email/consolidate`
  const body = JSON.stringify({
    operation: 'merge',
    sourcePK,
    sourceSK,
    targetPK,
    targetSK,
  })
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Merge failed: ${response.status} ${response.statusText}`)
  }

  return data
}

/**
 * Migrate email: copy subscriptions from old email to new email, unsubscribe old, update primary
 * @param oldEmail Old email address to migrate from
 * @param newEmail New email address to migrate to
 * @param pkey Person partition key
 * @param skey Person sort key
 */
export const migrateEmail = async (
  oldEmail: string,
  newEmail: string,
  pkey: string,
  skey: string
): Promise<any> => {
  const url = `${API_PATH}api/admin/email/consolidate`
  const body = JSON.stringify({
    operation: 'migrate',
    oldEmail,
    newEmail,
    pkey,
    skey,
  })
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Migrate failed: ${response.status} ${response.statusText}`)
  }

  return data
}

/**
 * Reorder emails for a person (first email becomes primary)
 * @param pkey Person partition key
 * @param emails Array of email addresses in desired order (max 2)
 */
export const reorderEmails = async (pkey: string, emails: string[]): Promise<any> => {
  const url = `${API_PATH}api/admin/email/consolidate`
  const body = JSON.stringify({
    operation: 'reorder',
    pkey,
    emails,
  })
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Reorder failed: ${response.status} ${response.statusText}`)
  }

  return data
}

/**
 * Global unsubscribe: unsubscribe email from all lists (compliance)
 * @param email Email address to unsubscribe
 */
export const unsubscribeAllLists = async (email: string): Promise<any> => {
  const url = `${API_PATH}api/admin/email/consolidate`
  const body = JSON.stringify({
    operation: 'unsubscribe-all',
    email,
  })
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Unsubscribe failed: ${response.status} ${response.statusText}`)
  }

  return data
}

/**
 * Archive an email: mark email as archived (max 2 active emails allowed)
 * @param pkey Person partition key
 * @param email Email address to archive
 */
export const archiveEmail = async (pkey: string, email: string): Promise<any> => {
  const url = `${API_PATH}api/admin/email/consolidate`
  const body = JSON.stringify({
    operation: 'archive-email',
    pkey,
    email,
  })
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Archive failed: ${response.status} ${response.statusText}`)
  }

  return data
}

/**
 * Unarchive an email: mark email as active (enforces max 2 active emails)
 * @param pkey Person partition key
 * @param email Email address to unarchive
 */
export const unarchiveEmail = async (pkey: string, email: string): Promise<any> => {
  const url = `${API_PATH}api/admin/email/consolidate`
  const body = JSON.stringify({
    operation: 'unarchive-email',
    pkey,
    email,
  })
  const response = await fetch(url, { cache: 'no-store', method: 'POST', body })
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Unarchive failed: ${response.status} ${response.statusText}`)
  }

  return data
}

// -----------------------------------------------------------------------------
// Unified Post model — block-editor save/load (Consolidated CMS epic #131,
// Phase 2a). Cross-platform (API_PATH) client helpers over /api/admin/posts.
// The API itself is owner/admin- + CONSOLIDATED_CMS-flag-gated.
// -----------------------------------------------------------------------------

/** List a tenant's posts (drafts + archived included). */
export const listPosts = async (tenant?: string): Promise<Post[]> => {
  const qs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''
  const url = `${API_PATH}api/admin/posts${qs}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to list posts (${response.status})`)
  return await response.json()
}

/** Load a single post by id (edit case). */
export const getPost = async (id: string): Promise<Post> => {
  const url = `${API_PATH}api/admin/posts/${encodeURIComponent(id)}`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to load post (${response.status})`)
  return await response.json()
}

/** Create a new post; returns the persisted Post (with its assigned id). */
export const createPost = async (input: Partial<Post>): Promise<Post> => {
  const url = `${API_PATH}api/admin/posts`
  const response = await fetch(url, {
    cache: 'no-store',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to create post (${response.status})`)
  }
  return await response.json()
}

/** Update an existing post (the editor's autosave target). */
export const updatePost = async (id: string, patch: Partial<Post>): Promise<Post> => {
  const url = `${API_PATH}api/admin/posts/${encodeURIComponent(id)}`
  const response = await fetch(url, {
    cache: 'no-store',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to update post (${response.status})`)
  }
  return await response.json()
}

/**
 * Duplicate/replicate (Consolidated CMS epic #131): clone a post's structure
 * (title/occasion/blocks, fresh block ids) into a brand-new draft that
 * auto-joins the source's series (Connect/series). Returns the new draft —
 * callers navigate to `/admin/posts/{newId}`.
 */
export const duplicatePost = async (id: string): Promise<Post> => {
  const url = `${API_PATH}api/admin/posts/${encodeURIComponent(id)}/duplicate`
  const response = await fetch(url, { cache: 'no-store', method: 'POST' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Failed to duplicate post (${response.status})`)
  }
  return await response.json()
}

/**
 * Connect/series (Consolidated CMS epic #131): the other posts sharing this
 * post's `seriesId` (empty array when it isn't part of a series). Powers the
 * "part of a series — N related" indicator.
 */
export const getPostSeries = async (id: string): Promise<Post[]> => {
  const url = `${API_PATH}api/admin/posts/${encodeURIComponent(id)}/series`
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Failed to load post series (${response.status})`)
  return await response.json()
}
