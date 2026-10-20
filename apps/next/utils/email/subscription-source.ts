/**
 * THE seam for "who is subscribed to which list" on read-only screens (#276).
 *
 * R5: the answer is the mailing-list registry (LIST# / SUB#), the store every
 * list send reads. SES is still read for what it still decides: each
 * contact's UnsubscribeAll, case-duplicate contacts, opt-outs of the SES
 * safety-net topics, and the account suppression list.
 *
 * Read-only by contract: a source may only List/Get/Query.
 */
import type { EmailListsTopic, OverviewSesContactInput } from '@my/app/utils/email-lists-overview'
import { listAllSesContacts, listSuppressedAddresses } from './ses-snapshot'

export interface SubscriptionSnapshot {
  /** Where the subscriptions came from, shown on the page. */
  source: 'ses' | 'registry'
  /** The subscription columns. Registry: the lists, `name` = listId. */
  topics: EmailListsTopic[]
  /** One row per SES contact (case variants kept apart), explicit preferences only. */
  subscribers: OverviewSesContactInput[]
  /** Account-level delivery suppression (bounces/complaints). Applies whatever the source. */
  suppressed: Array<{ email: string; reason?: string }>
  /** Registry: address (lower case) → listIds it is opted into. */
  subscriptions?: Record<string, string[]>
  /** Registry: the SES safety-net topic names. */
  safetyNetTopics?: string[]
}

export interface SubscriptionSource {
  readonly name: SubscriptionSnapshot['source']
  load(): Promise<SubscriptionSnapshot>
}

export const registrySubscriptionSource: SubscriptionSource = {
  name: 'registry',
  async load() {
    const [{ mailingListRepository }, { ownerNamesFor, ownerNameOf, listDisplayName }, { SAFETY_NET_TOPICS }] =
      await Promise.all([
        import('@my/app/provider/dynamodb/repositories/mailing-list-repository'),
        import('../mailing-lists/owners'),
        import('../mailing-lists/safety-net'),
      ])
    const lists = (await mailingListRepository.listAllLists()).filter((l) => l.status === 'active')
    const [names, rowsByList, subscribers, suppressed] = await Promise.all([
      ownerNamesFor(lists),
      Promise.all(lists.map((l) => mailingListRepository.listSubscribers(l.listId))),
      listAllSesContacts(),
      listSuppressedAddresses(),
    ])
    const subscriptions: Record<string, string[]> = {}
    lists.forEach((l, i) => {
      for (const row of rowsByList[i] ?? []) {
        const email = row.email.toLowerCase()
        subscriptions[email] = [...(subscriptions[email] ?? []), l.listId]
      }
    })
    const topics: EmailListsTopic[] = lists
      .map((l) => ({
        name: l.listId,
        displayName: listDisplayName(ownerNameOf(names, l), l.name),
        defaultOptIn: l.defaultOptIn === true,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    return {
      source: 'registry',
      topics,
      subscribers,
      suppressed,
      subscriptions,
      safetyNetTopics: SAFETY_NET_TOPICS.map((t) => t.name),
    }
  },
}

/** The source the send path uses: the registry (R5). */
export function getSubscriptionSource(): SubscriptionSource {
  return registrySubscriptionSource
}
