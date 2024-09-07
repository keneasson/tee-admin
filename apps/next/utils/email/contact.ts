import {
  CreateContactCommand,
  CreateContactCommandInput,
  CreateContactCommandOutput,
  ListContactsCommand,
  ListContactsRequest,
  ListContactsResponse,
  SubscriptionStatus,
  UpdateContactCommand,
  UpdateContactCommandOutput,
} from '@aws-sdk/client-sesv2'

import { inputTemplate } from './contact-lists'
import { CreateContactType, EmailListTypeKeys, EmailListTypes, GetContactsProps } from 'app/types'
import { getSesClient } from './sesClient'

const PAGE_SIZE = 100

/**
 * Return all the Contacts that Subscribe to the specific List Name
 * @param nextPageToken String - if there's more than one page, this will be a reference ot the next page.
 */
export async function getContacts({
  nextPageToken,
}: GetContactsProps): Promise<ListContactsResponse> {
  const client = getSesClient()
  const input: ListContactsRequest = {
    ...inputTemplate,
    Filter: {
      // ListContactsFilter
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

export async function addContact({
  contact,
}: CreateContactType): Promise<CreateContactCommandOutput> {
  const client = getSesClient()
  console.log('in addContact BE', contact)
  const email = Object.keys(contact)[0]
  const sesPref = Object.keys(EmailListTypes).map((p) => {
    return {
      TopicName: p,
      SubscriptionStatus: contact[email][p as EmailListTypeKeys]
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
  const command = new CreateContactCommand(input)
  return await client.send(command)
}

export async function updateContact({
  contact,
}: CreateContactType): Promise<UpdateContactCommandOutput> {
  const client = getSesClient()
  console.log('in updateContact BE', contact)
  const email = Object.keys(contact)[0]
  const sesPref = Object.keys(EmailListTypes).map((p) => {
    return {
      TopicName: p,
      SubscriptionStatus: contact[email][p as EmailListTypeKeys]
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
