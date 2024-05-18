import Constants from 'expo-constants'
import {
  CreateContactType,
  CycType,
  DataTypes,
  GetContactType,
  ProgramsTypes,
  SimplifiedContactListType,
} from 'app/types'

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

export const sendEmail = async (key: string): Promise<string> => {
  const url = `${API_PATH}api/email/${key}`
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
 * Get all the contacts from a Specific List (Topic)
 * @param nextToken if there's more - pass this to get "next page"
 * @param key
 */
export const getContacts = async (
  key: string,
  nextToken?: string | false
): Promise<GetContactType> => {
  const urlNextToken = nextToken ? `?NextToken=${nextToken}` : ''
  const url = `${API_PATH}api/contact/${key}${urlNextToken}`
  const rawContacts = await fetch(url, { cache: 'no-store', method: 'GET' })
  return await rawContacts.json()
}

/**
 * create a contact to all subscriber lists - passing opt-in for the lists to be added too
 * @param props
 */
export const addContacts = async ({ listName, contact }: CreateContactType): Promise<string> => {
  const url = `${API_PATH}api/contact/${listName}`
  const body = JSON.stringify(contact)
  const rawSchedule = await fetch(url, { cache: 'no-store', method: 'POST', body })
  return await rawSchedule.json()
}
