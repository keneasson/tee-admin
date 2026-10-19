import type { MailingListRecord } from '@my/app/provider/dynamodb/types'
import type { ResolveResult, ResolvableList } from '../email/resolve-list-recipients'
import { chooseSendTopic } from './safety-net'

/**
 * The audience of one list send (R5). Every send names a list (by listId,
 * resolved in send-target.ts); this answers who receives it and which SES
 * topic the send names as its final gate.
 *
 * Registry recipients = opt_in SUB# rows (LISTSUB#{listId}) + defaultOptIn
 *   − SES account suppression list (bounces/complaints)
 *   − unverified EMAIL# rows
 *   − addresses whose SES contact has UnsubscribeAll (the global "stop all mail")
 *
 * Which path:
 *  - safety net ON (scripts/ses-safety-net-topics.ts has run): the registry,
 *    always, naming the safety-net topic. The legacy topics no longer exist.
 *  - safety net OFF:
 *     · a list with no SES topic (made on /admin/email/mailing-lists): the
 *       registry, naming no topic (the contact list still honours UnsubscribeAll);
 *     · a bridged list cut over (sendFromRegistry): the registry, naming its
 *       legacy topic; if it resolves to NOBODY (almost certainly a missing
 *       backfill) or the registry read fails, it falls back to its SES topic,
 *       as before;
 *     · a bridged list not cut over: its SES topic's explicit OPT_INs.
 */

export interface SendAudience {
  source: 'registry' | 'ses-topic'
  listId: string
  /** The SES topic named on each send, or undefined for none. */
  topicName?: string
  emails: string[]
  stats: Partial<ResolveResult['stats']> & { unsubscribedAllRemoved?: number }
}

export interface SendAudienceDeps {
  resolveListRecipients: (list: ResolvableList) => Promise<ResolveResult>
  getUnsubscribedAll: () => Promise<Set<string>>
  /** Today's SES-topic audience (explicit OPT_IN − UnsubscribeAll). Only for a bridged list before the safety net. */
  sesTopicRecipients: (topic: string) => Promise<string[]>
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

export async function resolveSendAudience(
  list: MailingListRecord,
  safetyNetEnabled: boolean,
  deps?: SendAudienceDeps
): Promise<SendAudience> {
  const d = deps ?? (await defaultSendAudienceDeps())
  const topicName = chooseSendTopic(list, safetyNetEnabled)
  const legacyTopic = !safetyNetEnabled && list.sesTopic ? list.sesTopic : null

  const sesPath = async (topic: string): Promise<SendAudience> => ({
    source: 'ses-topic',
    listId: list.listId,
    topicName: topic,
    emails: await d.sesTopicRecipients(topic),
    stats: {},
  })

  if (legacyTopic && list.sendFromRegistry !== true) return sesPath(legacyTopic)

  let resolved: ResolveResult
  let unsubscribedAll: Set<string>
  try {
    ;[resolved, unsubscribedAll] = await Promise.all([d.resolveListRecipients(list), d.getUnsubscribedAll()])
  } catch (error) {
    // Before the safety net a bridged list can still fall back to its topic;
    // after it there is nothing to fall back to, so the send fails (and the
    // cron retries) rather than guessing.
    if (!legacyTopic) throw error
    console.error(`[registry-send] list ${list.listId} registry read failed — using its SES topic:`, error)
    return sesPath(legacyTopic)
  }
  const { emails, removed } = applyUnsubscribeAll(resolved, unsubscribedAll)

  if (emails.length === 0 && legacyTopic) {
    console.error(
      `[registry-send] list ${list.listId} (topic ${legacyTopic}) resolved 0 recipients — using its SES topic`
    )
    return sesPath(legacyTopic)
  }

  return {
    source: 'registry',
    listId: list.listId,
    topicName,
    emails,
    stats: { ...resolved.stats, unsubscribedAllRemoved: removed },
  }
}

/** Is the SES safety net switched on? Any read error → off (the legacy topics still exist then). */
export async function safetyNetEnabled(): Promise<boolean> {
  try {
    const { mailingListRepository } = await import(
      '@my/app/provider/dynamodb/repositories/mailing-list-repository'
    )
    return (await mailingListRepository.getSafetyNetSetting()).enabled
  } catch (error) {
    console.error('[registry-send] could not read the safety-net setting — treating it as off:', error)
    return false
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
 * Lower-cased and de-duplicated. Used by parity, and by a send to a bridged
 * list that is not cut over while the safety net is still off.
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

async function defaultSendAudienceDeps(): Promise<SendAudienceDeps> {
  const { resolveListRecipients } = await import('../email/resolve-list-recipients')
  return {
    resolveListRecipients: (list) => resolveListRecipients(list),
    getUnsubscribedAll: () => getSesUnsubscribedAll(),
    sesTopicRecipients: (topic) => getSesTopicRecipients(topic),
  }
}
