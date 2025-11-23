import { EmailDraft, CreateEmailDraftInput, UpdateEmailDraftInput } from '../types/email-draft'
import Constants from 'expo-constants'

const API_PATH =
  process.env.NEXT_PUBLIC_API_PATH || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH

export const getDrafts = async (): Promise<EmailDraft[]> => {
  const url = `${API_PATH}api/email-drafts`
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  return data.drafts || []
}

export const getDraft = async (id: string): Promise<EmailDraft> => {
  const url = `${API_PATH}api/email-drafts/${id}`
  const response = await fetch(url, { cache: 'no-store' })
  const data = await response.json()
  return data.draft
}

export const createDraft = async (draft: CreateEmailDraftInput): Promise<EmailDraft> => {
  const url = `${API_PATH}api/email-drafts`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
    cache: 'no-store',
  })
  const data = await response.json()
  return data.draft
}

export const updateDraft = async (draft: UpdateEmailDraftInput): Promise<EmailDraft> => {
  const url = `${API_PATH}api/email-drafts/${draft.id}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
    cache: 'no-store',
  })
  const data = await response.json()
  return data.draft
}

export const deleteDraft = async (id: string): Promise<void> => {
  const url = `${API_PATH}api/email-drafts?id=${id}`
  await fetch(url, {
    method: 'DELETE',
    cache: 'no-store',
  })
}

export const markDraftAsTested = async (id: string): Promise<void> => {
  const url = `${API_PATH}api/email-drafts/${id}/status`
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'tested' }),
    cache: 'no-store',
  })
}

export const markDraftAsSent = async (id: string): Promise<void> => {
  const url = `${API_PATH}api/email-drafts/${id}/status`
  await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'sent' }),
    cache: 'no-store',
  })
}
