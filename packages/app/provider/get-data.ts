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
