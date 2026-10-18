import type { MailingListRecord } from '@my/app/provider/dynamodb/types'
import type { ResolveResult } from '../email/resolve-list-recipients'

/**
 * Registry send audience (R5, per-list cutover).
 *
 * `emailSend` asks this for its recipients BEFORE its unchanged SES-topic path.
 * It answers only for a list whose `sendFromRegistry` is on; for every other
 * list, and on ANY error, it answers null and the SES path runs exactly as
 * before. That keeps the switch per list, default off, and fail-safe.
 *
 * Registry recipients = opt_in SUB# rows (LISTSUB#{listId})
 *   − SES account suppression list (bounces/complaints)
 *   − unverified EMAIL# rows
 *   − addresses whose SES contact has UnsubscribeAll (the global "stop all mail")
 * The send still names the list's SES topic, so SES's own per-topic check stays
 * the final safety net.
 */

export interface RegistryAudience {
  source: 'registry'
  listId: string
  /** SES topic named on each send as the safety-net gate. */
  sesTopic: string
  emails: string[]
  stats: ResolveResult['stats'] & { unsubscribedAllRemoved: number }
}

export interface RegistrySendDeps {
  findBySesTopic: (topic: string) => Promise<MailingListRecord | null>
  resolveListRecipients: (listId: string) => Promise<ResolveResult>
  getUnsubscribedAll: () => Promise<Set<string>>
}

/** Pure: drop SES UnsubscribeAll addresses from the resolver's recipients. */
export function applyUnsubscribeAll(
  resolved: ResolveResult,
  unsubscribedAll: Set<string>
): { emails: string[]; removed: number } {
  const emails: string[] = []
  let removed = 0
  for (const r of resolved.recipients) {
    if (unsubscribedAll.has(r.email.toLowerCase())) removed++
    else emails.push(r.email.toLowerCase())
  }
  return { emails, removed }
}

/**
 * The registry audience for a send, or null to use the unchanged SES path.
 *
 * @param topic the SES topic the send uses today (`listTopic` in emailSend). The
 *              list that carries it as its bridge is the list being sent.
 */
export async function resolveRegistryAudience(
  topic: string,
  deps?: RegistrySendDeps
): Promise<RegistryAudience | null> {
  try {
    const d = deps ?? (await defaultRegistrySendDeps())
    const list = await d.findBySesTopic(topic)
    if (!list || list.status !== 'active') return null
    if (list.sendFromRegistry !== true) return null // not cut over: SES path

    const [resolved, unsubscribedAll] = await Promise.all([
      d.resolveListRecipients(list.listId),
      d.getUnsubscribedAll(),
    ])
    const { emails, removed } = applyUnsubscribeAll(resolved, unsubscribedAll)

    if (emails.length === 0) {
      // A cut-over bridged list that resolves to nobody is almost certainly a
      // missing backfill, not an empty audience. Keep today's behaviour.
      console.error(
        `[registry-send] list ${list.listId} (topic ${list.sesTopic}) resolved 0 recipients — using the SES path`
      )
      return null
    }

    return {
      source: 'registry',
      listId: list.listId,
      sesTopic: topic,
      emails,
      stats: { ...resolved.stats, unsubscribedAllRemoved: removed },
    }
  } catch (error) {
    console.error('[registry-send] registry resolution failed — using the SES path:', error)
    return null
  }
}

/** Every SES contact (lower-cased) whose UnsubscribeAll is set. Read-only. */
export async function getSesUnsubscribedAll(): Promise<Set<string>> {
  const [{ ListContactsCommand }, { getSesClient }, { inputTemplate }] = await Promise.all([
    import('@aws-sdk/client-sesv2'),
    import('../email/sesClient'),
    import('../email/contact-lists'),
  ])
  const client = getSesClient()
  const out = new Set<string>()
  let NextToken: string | undefined
  do {
    const page = await client.send(
      new ListContactsCommand({ ...inputTemplate, PageSize: 100, NextToken })
    )
    for (const c of page.Contacts ?? []) {
      if (c.EmailAddress && c.UnsubscribeAll) out.add(c.EmailAddress.toLowerCase())
    }
    NextToken = page.NextToken
  } while (NextToken)
  return out
}

/**
 * The addresses today's SES-topic send path would mail for `topic`: explicit
 * OPT_IN contacts, minus UnsubscribeAll — the same filter emailSend applies.
 * Lower-cased and de-duplicated. Used by parity, never by a send.
 */
export async function getSesTopicRecipients(topic: string): Promise<string[]> {
  const { getContacts } = await import('../email/contact')
  const out = new Set<string>()
  let nextPageToken: string | undefined
  do {
    const page = await getContacts({ listTopic: topic, nextPageToken })
    for (const c of page.Contacts ?? []) {
      if (c.EmailAddress && c.UnsubscribeAll === false) out.add(c.EmailAddress.toLowerCase())
    }
    nextPageToken = page.NextToken
  } while (nextPageToken)
  return [...out]
}

async function defaultRegistrySendDeps(): Promise<RegistrySendDeps> {
  const [{ mailingListRepository }, { resolveListRecipients }] = await Promise.all([
    import('@my/app/provider/dynamodb/repositories/mailing-list-repository'),
    import('../email/resolve-list-recipients'),
  ])
  return {
    findBySesTopic: (t) => mailingListRepository.findBySesTopic(t),
    resolveListRecipients: (id) => resolveListRecipients(id),
    getUnsubscribedAll: () => getSesUnsubscribedAll(),
  }
}
