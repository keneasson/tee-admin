import type { MailingListRecord } from '@my/app/provider/dynamodb/types'
import type { ResolveResult, ResolvableList } from '../email/resolve-list-recipients'
import { chooseSendTopic } from './safety-net'
import { SendListError } from './send-target'

/**
 * The audience of one list send (R5). Every send names a list (by listId,
 * resolved in send-target.ts); this answers who receives it and which SES
 * topic the send names as its final gate.
 *
 * Recipients come ONLY from the registry:
 *   opt_in SUB# rows (LISTSUB#{listId}) + defaultOptIn
 *   − SES account suppression list (bounces/complaints)
 *   − unverified EMAIL# rows
 *   − addresses whose SES contact has UnsubscribeAll (the global "stop all mail")
 *
 * There is NO fallback to an SES topic's audience. /email-preferences writes
 * only the registry now, so an SES topic's OPT_IN contacts are stale: someone
 * who left a list there would still be on the topic. Sending to the topic
 * would mail them. So:
 *  - a bridged list (it has a legacy `sesTopic`) that is NOT cut over
 *    (`sendFromRegistry` off) while the safety net is off REFUSES to send
 *    (SendListNotCutOverError: routes answer 400, the cron logs it). Cut it
 *    over with mailing-list-ops.ts first;
 *  - a bridged list cut over that resolves to NOBODY refuses too (almost
 *    certainly a missing backfill), rather than sending to nobody silently;
 *  - a registry read error throws (the send fails; the cron retries);
 *  - while the safety-net switch script runs (`switching`), EVERY send refuses.
 *
 * The topic named on each send: the safety-net topic once it is on; before
 * that a bridged list names its legacy topic and a list with no SES topic
 * names none (the contact list still honours UnsubscribeAll).
 */

export interface SendAudience {
  source: 'registry'
  listId: string
  /** The SES topic named on each send, or undefined for none. */
  topicName?: string
  emails: string[]
  stats: Partial<ResolveResult['stats']> & { unsubscribedAllRemoved?: number }
}

export interface SendAudienceDeps {
  resolveListRecipients: (list: ResolvableList) => Promise<ResolveResult>
  getUnsubscribedAll: () => Promise<Set<string>>
}

/** A send refused because its list's subscriptions do not (yet) live in the registry. */
export class SendListNotCutOverError extends SendListError {
  constructor(message: string) {
    super(message)
    this.name = 'SendListNotCutOverError'
  }
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

/** The stored safety-net state a send needs (see mailing-list-repository SafetyNetSetting). */
export interface SafetyNetState {
  enabled: boolean
  /** The switch script is mid-way: every send refuses. */
  switching?: boolean
}

export async function resolveSendAudience(
  list: MailingListRecord,
  safetyNet: SafetyNetState,
  deps?: SendAudienceDeps
): Promise<SendAudience> {
  if (safetyNet.switching === true) {
    const message =
      'SES topics are being switched to the safety net right now (scripts/ses-safety-net-topics.ts). ' +
      'Nothing was sent; send again once the switch has finished.'
    console.error(`[registry-send] REFUSED: ${message}`)
    throw new SendListNotCutOverError(message)
  }
  const safetyNetEnabled = safetyNet.enabled
  const bridged = !safetyNetEnabled && !!list.sesTopic
  if (bridged && list.sendFromRegistry !== true) {
    const message =
      `List "${list.key}" (${list.listId}) is not cut over to the registry: its SES topic "${list.sesTopic}" ` +
      'no longer receives opt-outs from /email-preferences, so sending to it could mail people who left. ' +
      'Run mailing-list-ops.ts parity + cutover for it, then send again.'
    console.error(`[registry-send] REFUSED: ${message}`)
    throw new SendListNotCutOverError(message)
  }

  const d = deps ?? (await defaultSendAudienceDeps())
  const [resolved, unsubscribedAll] = await Promise.all([d.resolveListRecipients(list), d.getUnsubscribedAll()])
  const { emails, removed } = applyUnsubscribeAll(resolved, unsubscribedAll)

  if (emails.length === 0 && bridged) {
    const message =
      `List "${list.key}" (${list.listId}) resolved 0 recipients from the registry (a missing backfill?). ` +
      'Nothing was sent. Check its SUB# rows with mailing-list-ops.ts parity.'
    console.error(`[registry-send] REFUSED: ${message}`)
    throw new SendListNotCutOverError(message)
  }

  return {
    source: 'registry',
    listId: list.listId,
    topicName: chooseSendTopic(list, safetyNetEnabled),
    emails,
    stats: { ...resolved.stats, unsubscribedAllRemoved: removed },
  }
}

/** The SES safety-net state. Any read error → off and not switching (the legacy topics still exist then). */
export async function safetyNetState(): Promise<SafetyNetState> {
  try {
    const { mailingListRepository } = await import(
      '@my/app/provider/dynamodb/repositories/mailing-list-repository'
    )
    const s = await mailingListRepository.getSafetyNetSetting()
    return { enabled: s.enabled, ...(s.switching ? { switching: true } : {}) }
  } catch (error) {
    console.error('[registry-send] could not read the safety-net setting — treating it as off:', error)
    return { enabled: false }
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
 * Lower-cased and de-duplicated. Used by parity only (never to send).
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
  }
}
