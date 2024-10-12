import {
  CreateContactListCommandInput,
  GetContactListCommand,
  GetContactListCommandOutput,
  SubscriptionStatus,
  UpdateContactListCommand,
  UpdateContactListCommandInput,
  UpdateContactListCommandOutput,
} from '@aws-sdk/client-sesv2'
import { BackendContactList, CreateUpdateListType } from 'app/types'
import { getSesClient } from './sesClient'

export const inputTemplate = { ContactListName: 'TEEAdmin' }

export async function getContactLists(): Promise<BackendContactList> {
  const sesContactList = await getRawContactLists()
  if (!sesContactList.ContactListName) {
    throw new Error('Unable to find the Contact list in AWS')
  }
  if (!sesContactList.Topics) {
    throw new Error('Your subscriber list has no Topics (Lists)')
  }
  return {
    lists: sesContactList.Topics.map((topic) => {
      return {
        key: topic.TopicName as string,
        defaultOptIn: topic.DefaultSubscriptionStatus === 'OPT_IN',
        displayName: topic.DisplayName as string,
        listName: topic.TopicName as string,
      }
    }),
  }
}

/**
 * returns all the Topics (Contact Lists) for the entire system
 */
export async function getRawContactLists(): Promise<GetContactListCommandOutput> {
  try {
    const client = getSesClient()
    const input: UpdateContactListCommandInput = {
      ...inputTemplate,
    }
    const command = new GetContactListCommand(input)
    return await client.send(command)
  } catch (err) {
    console.log('typeof error', typeof err)
    console.log('actual error', err)
    throw err
  }
}

/**
 * AWS SES Limits an account to one and only one list. This list has "Topics" which are the actual Lists for our Purposes.
 * as such - create ADDS a Topic to the list using UPDATE
 * @param listName
 * @param displayName
 * @param defaultOptIn
 */
export async function createContactListTopic({
  listName,
  displayName,
  defaultOptIn,
}: Omit<CreateUpdateListType, 'oldListName'>): Promise<UpdateContactListCommandOutput> {
  const oldList = await getRawContactLists()
  const client = getSesClient()

  if (!oldList.ContactListName) {
    throw new Error('Must pass a valid list name')
  }
  const input: CreateContactListCommandInput = {
    ...oldList,
    ContactListName: inputTemplate.ContactListName,
    Topics: [
      ...(oldList.Topics || []),
      {
        TopicName: listName, // required
        DisplayName: displayName, // required
        DefaultSubscriptionStatus: defaultOptIn
          ? SubscriptionStatus.OPT_IN
          : SubscriptionStatus.OPT_OUT,
      },
    ],
  }
  const command = new UpdateContactListCommand(input)
  return await client.send(command)
}

export async function updateContactListTopic({
  oldListName,
  listName,
  displayName,
  defaultOptIn,
}: CreateUpdateListType): Promise<UpdateContactListCommandOutput> {
  const oldList = await getRawContactLists()
  const client = getSesClient()
  if (!oldList.ContactListName) {
    throw new Error('Unable to find a Master Subscriber List')
  }
  /**
   * Map over a list to Find and Update the object.
   */
  const found = oldList.Topics?.find((topic) => topic.TopicName === oldListName)
  if (!found) {
    throw new Error(`${oldListName} was not found - unable to rename`)
  }
  const input: CreateContactListCommandInput = {
    ...oldList,
    ContactListName: inputTemplate.ContactListName,
    Topics: [
      ...(oldList.Topics || []),
      {
        TopicName: listName, // required
        DisplayName: displayName, // required
        DefaultSubscriptionStatus: defaultOptIn
          ? SubscriptionStatus.OPT_IN
          : SubscriptionStatus.OPT_OUT,
      },
    ],
  }
  const command = new UpdateContactListCommand(input)
  return await client.send(command)
}

const makeCamelCase = (str: string): string =>
  str
    .split(/[\s_-]/)
    .map((e, i) => (i ? e.charAt(0).toUpperCase() + e.slice(1).toLowerCase() : e.toLowerCase()))
    .join('')
