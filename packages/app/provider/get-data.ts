import Constants from 'expo-constants'
import {
  CreateContactType,
  CycType,
  DataTypes,
  GetContactType,
  ProgramsTypes,
  SimplifiedContactListType,
} from '@my/app/types'
import { CreateUpdateListType } from '../types'
import { emailReasons } from 'next-app/utils/email/email-send'

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

export const sendEmail = async (key: emailReasons, isTest?: boolean): Promise<string> => {
  const url = `${API_PATH}api/email/${key}${isTest ? '?test=true' : ''}`
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
