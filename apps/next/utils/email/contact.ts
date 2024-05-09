import {
  CreateContactCommand,
  CreateContactCommandInput,
  CreateContactCommandOutput,
  ListContactsCommand,
  ListContactsRequest,
  ListContactsResponse,
  SESv2Client,
  SESv2ClientConfig,
  SubscriptionStatus,
} from '@aws-sdk/client-sesv2'

import { inputTemplate } from './contact-lists'
import { CreateContactType, EmailListTypeKeys, EmailListTypes, GetContactsProps } from 'app/types'

const CREDENTIAL = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
}

/**
 * This isn't working very well - ideally AWS gets Security Credentials from ENV variables, but this is
 * extremely intermittent.
 */
export function getAwsConfig(): SESv2ClientConfig {
  return {
    region: 'ca-central-1',
    credentials: CREDENTIAL,
  }
}

/**
 * Return all the Contacts that Subscribe to the specific List Name
 * @param listName String - the name of the Contact List
 * @param nextPageToken String - if there's more than one page, this will be a reference ot the next page.
 */
export async function getContacts({
  listName,
  nextPageToken,
}: GetContactsProps): Promise<ListContactsResponse> {
  const client = new SESv2Client(getAwsConfig())
  const input: ListContactsRequest = {
    ...inputTemplate,
    Filter: {
      // ListContactsFilter
      FilteredStatus: SubscriptionStatus.OPT_IN,
      TopicFilter: {
        // TopicFilter
        TopicName: listName,
      },
    },
    PageSize: 25,
    NextToken: nextPageToken,
  }

  const command = new ListContactsCommand(input)
  return await client.send(command)
}

export async function addContact({
  contact,
}: CreateContactType): Promise<CreateContactCommandOutput> {
  const client = new SESv2Client(getAwsConfig())
  console.log('in addContact BE', contact)
  const sesPref = Object.keys(EmailListTypes).map((p) => {
    return {
      TopicName: p,
      SubscriptionStatus: contact.preferences[p as EmailListTypeKeys]
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
