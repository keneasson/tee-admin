import {
  CreateContactCommand,
  GetContactCommand,
  ListContactsCommand,
  ListContactsRequest,
  ListContactsResponse,
  SubscriptionStatus,
  UpdateContactCommand,
  UpdateContactCommandOutput,
} from '@aws-sdk/client-sesv2'

import { inputTemplate } from './contact-lists'
import { GetContactsProps } from '@my/app/types'
import type { ListSubscriptionRecord, MailingListRecord } from '@my/app/provider/dynamodb/types'
import { getSesClient } from './sesClient'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/*
 * SES contact helpers. R5: nothing here writes a TOPIC preference. List
 * subscriptions live in the mailing-list registry; SES keeps only the contact,
 * its UnsubscribeAll ("stop all mail") and the account suppression list.
 */

const PAGE_SIZE = 100

/**
 * Return the contacts explicitly opted into one SES topic (read-only). Used
 * only for a bridged list that is not cut over, and for parity, while the
 * legacy topics still exist.
 * @param listTopic the SES topic
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
 * Move a member's LIST subscriptions from one address to another (R5: the
 * mailing-list registry is the only subscription store; no SES topic is
 * written).
 *
 * For every list the OLD address is opted into, the NEW address is opted in
 * (under the person the new address resolves to — this person). The old
 * address's rows are flipped to opt_out, UNLESS somebody else still holds the
 * old address (a shared household inbox, #267): opting it out would stop the
 * rest of the household's mail because one of them moved. Rows are never
 * deleted.
 *
 * @returns the names of the lists that moved.
 */
export async function moveListSubscriptions(
  oldEmail: string,
  newEmail: string,
  opts: { personId: string },
  deps?: MoveSubscriptionDeps
): Promise<{ movedLists: string[] }> {
  const d = deps ?? (await defaultMoveDeps())
  const oldLower = oldEmail.trim().toLowerCase()
  const newLower = newEmail.trim().toLowerCase()

  const othersOnOld = (await d.getAllPersonsByEmail(oldLower)).filter((p) => p.personId !== opts.personId)
  const movedLists: string[] = []
  for (const list of await d.listAllLists()) {
    const rows = await d.getListSubscriptionsForEmail(list.listId, oldLower)
    if (!rows.some((r) => r.status === 'opt_in')) continue
    await d.setListSubscription({ listId: list.listId, email: newLower, subscribed: true })
    if (othersOnOld.length === 0) {
      for (const row of rows.filter((r) => r.status === 'opt_in')) await d.setSubscriptionStatus(row, 'opt_out')
    }
    movedLists.push(list.name)
  }
  if (othersOnOld.length > 0 && movedLists.length > 0) {
    console.log(
      `moveListSubscriptions: old address is shared with ${othersOnOld.length} other person(s) — left subscribed`
    )
  }
  return { movedLists }
}

export interface MoveSubscriptionDeps {
  listAllLists: () => Promise<Array<Pick<MailingListRecord, 'listId' | 'name'>>>
  getListSubscriptionsForEmail: (listId: string, email: string) => Promise<ListSubscriptionRecord[]>
  setSubscriptionStatus: (
    row: Pick<ListSubscriptionRecord, 'pkey' | 'skey'>,
    status: ListSubscriptionRecord['status']
  ) => Promise<unknown>
  setListSubscription: (input: { listId: string; email: string; subscribed: boolean }) => Promise<unknown>
  getAllPersonsByEmail: (email: string) => Promise<Array<{ personId: string }>>
}

async function defaultMoveDeps(): Promise<MoveSubscriptionDeps> {
  const [{ mailingListRepository }, { setListSubscription, defaultSubscriptionDeps }] = await Promise.all([
    import('@my/app/provider/dynamodb/repositories/mailing-list-repository'),
    import('../mailing-lists/subscriptions'),
  ])
  const subDeps = await defaultSubscriptionDeps()
  return {
    listAllLists: () => mailingListRepository.listAllLists(),
    getListSubscriptionsForEmail: (l, e) => mailingListRepository.getListSubscriptionsForEmail(l, e),
    setSubscriptionStatus: (row, st) => mailingListRepository.setSubscriptionStatus(row, st),
    setListSubscription: (input) => setListSubscription(input, subDeps),
    getAllPersonsByEmail: (e) => personRepository.getAllPersonsByEmail(e),
  }
}

/**
 * Set or clear a contact's SES UnsubscribeAll (the global "stop all mail",
 * which stays in SES; R5). SES UpdateContact replaces the whole contact, so the
 * contact's explicit topic preferences and attributes are passed back as-is.
 * Clearing it on an address that is not a contact is a no-op.
 */
export async function setUnsubscribeAll(email: string, on: boolean): Promise<void> {
  const client = getSesClient()
  const address = email.trim().toLowerCase()
  const existing = await getContact(address)
  if (!existing) {
    if (on) {
      await client.send(new CreateContactCommand({ ...inputTemplate, EmailAddress: address, UnsubscribeAll: true }))
    }
    return
  }
  if (!!existing.UnsubscribeAll === on) return
  await client.send(
    new UpdateContactCommand({
      ...inputTemplate,
      EmailAddress: address,
      UnsubscribeAll: on,
      ...(existing.TopicPreferences ? { TopicPreferences: existing.TopicPreferences } : {}),
      ...(existing.AttributesData ? { AttributesData: existing.AttributesData } : {}),
    })
  )
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
