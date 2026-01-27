import {
  CreateContactCommand,
  CreateContactCommandInput,
  CreateContactCommandOutput,
  GetContactCommand,
  ListContactsCommand,
  ListContactsRequest,
  ListContactsResponse,
  SubscriptionStatus,
  UpdateContactCommand,
  UpdateContactCommandOutput,
} from '@aws-sdk/client-sesv2'

import { inputTemplate } from './contact-lists'
import {
  CreateContactType,
  EmailListTypeKeys,
  EmailListTypes,
  GetContactsProps,
} from '@my/app/types'
import { getSesClient } from './sesClient'

const PAGE_SIZE = 100

/**
 * Return all the Contacts that Subscribe to the specific List Name
 * @param listTopic the SES Topic - from the Email send reason
 * @param nextPageToken String - if there's more than one page, this will be a reference ot the next page.
 */
export async function getContacts({
  listTopic,
  nextPageToken,
}: GetContactsProps): Promise<ListContactsResponse> {
  const client = getSesClient()
  const listTopicFilter = listTopic
    ? {
        TopicFilter: {
          TopicName: listTopic,
          UseDefaultIfPreferenceUnavailable: false,
        },
      }
    : {}
  const input: ListContactsRequest = {
    ...inputTemplate,
    Filter: {
      ...listTopicFilter,
      FilteredStatus: SubscriptionStatus.OPT_IN,
    },
    PageSize: PAGE_SIZE,
  }
  if (nextPageToken) {
    input['NextToken'] = nextPageToken
  }

  const command = new ListContactsCommand(input)
  return await client.send(command)
}

export async function addContact(contact: CreateContactType): Promise<CreateContactCommandOutput> {
  const client = getSesClient()
  console.log('in addContact BE', { contact })
  const sesPref = Object.keys(EmailListTypes).map((p) => {
    return {
      TopicName: p,
      SubscriptionStatus: contact.lists[p as EmailListTypeKeys]
        ? SubscriptionStatus.OPT_IN
        : SubscriptionStatus.OPT_OUT,
    }
  })

  const input: CreateContactCommandInput = {
    ...inputTemplate,
    EmailAddress: contact.email,
    AttributesData: '',
    TopicPreferences: sesPref,
  }
  const command = new CreateContactCommand(input)
  return await client.send(command)
}

export async function updateContact({
  email,
  lists,
}: CreateContactType): Promise<UpdateContactCommandOutput> {
  const client = getSesClient()
  console.log('in updateContact BE', { email, lists })
  const sesPref = Object.keys(EmailListTypes).map((p) => {
    return {
      TopicName: p,
      SubscriptionStatus: lists[p as EmailListTypeKeys]
        ? SubscriptionStatus.OPT_IN
        : SubscriptionStatus.OPT_OUT,
    }
  })

  const input: CreateContactCommandInput = {
    ...inputTemplate,
    EmailAddress: email,
    AttributesData: '',
    TopicPreferences: sesPref,
  }
  const command = new UpdateContactCommand(input)
  return await client.send(command)
}

/**
 * Check if a contact exists in the SES contact list
 */
export async function getContact(email: string) {
  const client = getSesClient()
  try {
    const command = new GetContactCommand({
      ...inputTemplate,
      EmailAddress: email,
    })
    return await client.send(command)
  } catch (error: any) {
    if (error.name === 'NotFoundException') {
      return null
    }
    throw error
  }
}

/**
 * Unsubscribe a contact from ALL email lists (sets UnsubscribeAll = true)
 * Used for handling bounces and complaints
 */
export async function unsubscribeContact(email: string, reason?: string): Promise<UpdateContactCommandOutput | null> {
  const client = getSesClient()

  // First check if contact exists
  const existingContact = await getContact(email)
  if (!existingContact) {
    console.log(`📧 Contact ${email} not found in SES contact list - skipping unsubscribe`)
    return null
  }

  console.log(`📧 Unsubscribing ${email} from all lists. Reason: ${reason || 'unknown'}`)

  // Set UnsubscribeAll to true - this globally unsubscribes from all topics
  const command = new UpdateContactCommand({
    ...inputTemplate,
    EmailAddress: email,
    UnsubscribeAll: true,
    AttributesData: JSON.stringify({
      unsubscribeReason: reason || 'bounce',
      unsubscribeDate: new Date().toISOString(),
    }),
  })

  return await client.send(command)
}
