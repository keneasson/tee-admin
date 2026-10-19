/**
 * THE seam for "who is subscribed to which list" on read-only screens (#276).
 *
 * Today the only live answer is SES, computed exactly as the list send does
 * (`utils/email/contact.ts` getContacts: explicit OPT_IN, topic defaults
 * ignored). The in-house registry (#182 LIST#/SUB#, #184
 * `resolve-list-recipients.ts`) is the intended replacement; it is DARK behind
 * `MAILING_LIST_REGISTRY` and has never been backfilled, so it is not wired
 * here yet. When it goes live, add a `registrySubscriptionSource` that returns
 * the same snapshot shape and switch `getSubscriptionSource()` — no screen
 * changes.
 *
 * Read-only by contract: a source may only List/Get.
 */
import type { EmailListsTopic, OverviewSesContactInput } from '@my/app/utils/email-lists-overview'
import { listAllSesContacts, listSesTopics, listSuppressedAddresses } from './ses-snapshot'

export interface SubscriptionSnapshot {
  /** Where the subscriptions came from, shown on the page. */
  source: 'ses' | 'registry'
  topics: EmailListsTopic[]
  /** One row per stored subscriber record (case variants kept apart), EXPLICIT preferences only. */
  subscribers: OverviewSesContactInput[]
  /** Account-level delivery suppression (bounces/complaints). Applies whatever the source. */
  suppressed: Array<{ email: string; reason?: string }>
}

export interface SubscriptionSource {
  readonly name: SubscriptionSnapshot['source']
  load(): Promise<SubscriptionSnapshot>
}

export const sesSubscriptionSource: SubscriptionSource = {
  name: 'ses',
  async load() {
    const [subscribers, suppressed, topics] = await Promise.all([
      listAllSesContacts(),
      listSuppressedAddresses(),
      listSesTopics(),
    ])
    return { source: 'ses', topics, subscribers, suppressed }
  },
}

/** The source the send path uses today. Switch here (only) when the registry cuts over. */
export function getSubscriptionSource(): SubscriptionSource {
  return sesSubscriptionSource
}
