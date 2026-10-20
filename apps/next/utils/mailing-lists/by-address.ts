import type { ListSubscriptionRecord, MailingListRecord } from '@my/app/provider/dynamodb/types'
import { listDisplayName } from './owners'

/**
 * Which mailing lists send to which of a person's addresses, from the registry
 * (SUB# rows: each row names the exact address the list sends to). Pure.
 *
 * Returns lower-cased address → sorted list display names ("Toronto East
 * Newsletter"). Only opted-in rows on active lists count.
 */
export function mailingListsByAddress(
  subscriptions: Array<Pick<ListSubscriptionRecord, 'listId' | 'email' | 'status'>>,
  lists: MailingListRecord[],
  ownerName: (list: MailingListRecord) => string
): Map<string, string[]> {
  const byId = new Map(lists.map((l) => [l.listId, l]))
  const out = new Map<string, Set<string>>()
  for (const sub of subscriptions) {
    if (sub.status !== 'opt_in' || !sub.email) continue
    const list = byId.get(sub.listId)
    if (!list || list.status !== 'active') continue
    const key = sub.email.toLowerCase()
    const names = out.get(key) ?? new Set<string>()
    names.add(listDisplayName(ownerName(list), list.name))
    out.set(key, names)
  }
  return new Map([...out].map(([email, names]) => [email, [...names].sort((a, b) => a.localeCompare(b))]))
}
