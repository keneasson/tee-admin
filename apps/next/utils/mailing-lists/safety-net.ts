import type { MailingListRecord } from '@my/app/provider/dynamodb/types'

/**
 * SES safety-net topics (R5) — THE one place they are configured.
 *
 * SES topics no longer decide who gets which list: the registry does. A send
 * still names ONE SES topic in `ListManagementOptions`, and SES drops the
 * message for a contact who has opted out of it (or UnsubscribeAll). That
 * makes the topic a final gate, a "safety net", not an audience.
 *
 * Today there is one safety net for everyone. Splitting it later (for example
 * one per country) is configuration only: add a topic here and extend
 * `safetyNetTopicFor`. The safety nets are an operational setting, not legal
 * advice; if a law such as CASL or GDPR needs them, a lawyer reviews them.
 *
 * The topics only exist in SES once the owner has run
 * scripts/ses-safety-net-topics.ts, which also switches the stored setting on.
 * Until then `chooseSendTopic` keeps naming each list's legacy topic.
 */

export interface SafetyNetTopic {
  /** SES TopicName (letters and digits, like the existing topics). */
  name: string
  displayName: string
  description: string
  /** Always OPT_IN: a contact with no preference receives mail; only an explicit opt-out blocks. */
  defaultSubscriptionStatus: 'OPT_IN'
}

export const SAFETY_NET_TOPICS: readonly SafetyNetTopic[] = [
  {
    name: 'safetyNetDefault',
    displayName: 'Ecclesial email',
    description: 'All list email. Lists are managed on the email preferences page.',
    defaultSubscriptionStatus: 'OPT_IN',
  },
]

export const DEFAULT_SAFETY_NET_TOPIC = SAFETY_NET_TOPICS[0]!.name

/** The safety-net topic a send to this list names. One for every list today. */
export function safetyNetTopicFor(_list: Pick<MailingListRecord, 'ownerType' | 'ownerId' | 'scope' | 'scopeValue'>): string {
  return DEFAULT_SAFETY_NET_TOPIC
}

/**
 * The SES topic a send names, or undefined to name none (the contact list
 * alone, which still honours UnsubscribeAll).
 *  - safety net on  → the list's safety-net topic;
 *  - safety net off → the list's legacy topic when it has one (the 7 bridged
 *    lists), else none (a new list has no SES topic before the switch).
 */
export function chooseSendTopic(
  list: Pick<MailingListRecord, 'ownerType' | 'ownerId' | 'scope' | 'scopeValue' | 'sesTopic'>,
  safetyNetEnabled: boolean
): string | undefined {
  if (safetyNetEnabled) return safetyNetTopicFor(list)
  return list.sesTopic || undefined
}
