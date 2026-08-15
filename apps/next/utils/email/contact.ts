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
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

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
 * Move a member's topic subscriptions from one address to another, writing BOTH
 * sides of the source of truth so the change actually sticks.
 *
 * Why both writes matter: SES v2 holds per-contact `TopicPreferences`, but the
 * PersonRecord EMAIL# row is CANONICAL — the `sync-ses-contacts` cron pushes the
 * PRIMARY email's `sesTopicPreferences` → SES one-way. So an SES-only edit to a
 * primary address is silently reverted on the next sync. This helper writes the
 * PersonRecord rows too (the fix for that drift).
 *
 * Steps:
 *  1. Read the OLD address's current opt-ins from SES.
 *  2. SES: copy those opt-ins onto the NEW address; clear the OLD address.
 *  3. PersonRecord: set the NEW EMAIL# row `sesTopicPreferences` to the copied
 *     opt-ins + `sesSubscribed = true`; set the OLD EMAIL# row to all-false +
 *     `sesSubscribed = false`. The PersonRecord write is best-effort/logged so a
 *     missing row can't undo the SES change that already succeeded.
 *
 * `sesTopicPreferences` shape is a full `Record<topic, boolean>` over every
 * `EmailListTypes` key — matching how the cron reads it
 * (`primaryEmailRecord.sesTopicPreferences[topic]`).
 *
 * @returns the topics that were carried over (the OPT_IN ones).
 */
export async function migrateSubscriptions(
  oldEmail: string,
  newEmail: string,
  opts: { personId: string }
): Promise<{ movedTopics: string[] }> {
  const oldLower = oldEmail.toLowerCase()
  const newLower = newEmail.toLowerCase()
  const allTopics = Object.keys(EmailListTypes)

  // 1. Read the OLD address's current topic opt-ins from SES. Build a full map
  //    over every topic (default false), then flip the OPT_IN ones true.
  const oldPrefs: Record<string, boolean> = {}
  const allFalse: Record<string, boolean> = {}
  for (const topic of allTopics) {
    oldPrefs[topic] = false
    allFalse[topic] = false
  }

  const oldContact = await getContact(oldLower)
  if (oldContact?.TopicPreferences) {
    for (const pref of oldContact.TopicPreferences) {
      if (pref.TopicName) {
        oldPrefs[pref.TopicName] = pref.SubscriptionStatus === SubscriptionStatus.OPT_IN
      }
    }
  }

  const movedTopics = allTopics.filter((topic) => oldPrefs[topic])

  // 2. SES: copy opt-ins onto the new address, then clear the old one.
  await addContact({ email: newLower, lists: oldPrefs as any })
  await updateContact({ email: oldLower, lists: allFalse as any })

  // 3. PersonRecord (canonical) — otherwise the one-way SES sync cron reverts (2).
  try {
    const emails = await personRepository.getEmails(opts.personId)
    const newRow = emails.find((e) => e.email.toLowerCase() === newLower)
    const oldRow = emails.find((e) => e.email.toLowerCase() === oldLower)

    if (newRow) {
      await personRepository.update(newRow.pkey, newRow.skey, {
        sesTopicPreferences: oldPrefs,
        sesSubscribed: true,
      } as any)
    } else {
      console.warn(
        `migrateSubscriptions: no EMAIL# row for new address ${newLower} on person ${opts.personId} — SES updated, PersonRecord skipped`
      )
    }

    if (oldRow) {
      await personRepository.update(oldRow.pkey, oldRow.skey, {
        sesTopicPreferences: allFalse,
        sesSubscribed: false,
      } as any)
    }
  } catch (error) {
    console.error(
      'migrateSubscriptions: PersonRecord update failed (SES already updated):',
      error
    )
  }

  return { movedTopics }
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
