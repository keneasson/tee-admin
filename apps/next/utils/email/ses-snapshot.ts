/**
 * READ-ONLY snapshot of the SES side of the mailing list, for comparing the
 * SES projection against PersonRecords (#276). Only List/Get calls: nothing
 * in this module can create, update or delete a contact, topic or
 * suppression entry.
 */
import { ListContactsCommand, ListSuppressedDestinationsCommand } from '@aws-sdk/client-sesv2'
import type { OverviewSesContactInput, EmailListsTopic } from '@my/app/utils/email-lists-overview'
import { getSesClient } from './sesClient'
import { getContactLists, inputTemplate } from './contact-lists'

/** Every contact on the list, unfiltered (ListContacts pages are followed by hand). */
export async function listAllSesContacts(): Promise<OverviewSesContactInput[]> {
  const client = getSesClient()
  const out: OverviewSesContactInput[] = []
  let nextToken: string | undefined
  do {
    const page = await client.send(
      new ListContactsCommand({ ...inputTemplate, PageSize: 100, ...(nextToken ? { NextToken: nextToken } : {}) })
    )
    for (const c of page.Contacts || []) {
      if (!c.EmailAddress) continue
      const topics: OverviewSesContactInput['topics'] = {}
      for (const p of c.TopicPreferences || []) {
        if (p.TopicName && (p.SubscriptionStatus === 'OPT_IN' || p.SubscriptionStatus === 'OPT_OUT')) {
          topics[p.TopicName] = p.SubscriptionStatus
        }
      }
      out.push({ email: c.EmailAddress, unsubscribeAll: !!c.UnsubscribeAll, topics })
    }
    nextToken = page.NextToken
  } while (nextToken)
  return out
}

/** The account-level suppression list (bounces / complaints). */
export async function listSuppressedAddresses(): Promise<Array<{ email: string; reason?: string }>> {
  const client = getSesClient()
  const out: Array<{ email: string; reason?: string }> = []
  let nextToken: string | undefined
  do {
    const page = await client.send(
      new ListSuppressedDestinationsCommand({ PageSize: 100, ...(nextToken ? { NextToken: nextToken } : {}) })
    )
    for (const s of page.SuppressedDestinationSummaries || []) {
      if (s.EmailAddress) out.push({ email: s.EmailAddress, reason: s.Reason })
    }
    nextToken = page.NextToken
  } while (nextToken)
  return out
}

export async function listSesTopics(): Promise<EmailListsTopic[]> {
  const { lists } = await getContactLists()
  return lists.map((l) => ({ name: l.listName, displayName: l.displayName || l.listName, defaultOptIn: l.defaultOptIn }))
}
