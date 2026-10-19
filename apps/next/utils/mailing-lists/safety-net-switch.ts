/**
 * Planning + checks for the SES safety-net switch (R5). Pure, so every refusal
 * and every plan is unit-tested; the owner-run runner is
 * scripts/ses-safety-net-topics.ts (read its header before running it).
 */
import type { MailingListRecord } from '@my/app/provider/dynamodb/types'
import { SAFETY_NET_TOPICS, type SafetyNetTopic } from './safety-net'

// ---------------------------------------------------------------------------
// (a) + (b): may the switch run?
// ---------------------------------------------------------------------------

export interface SwitchPreflightInput {
  lists: Array<Pick<MailingListRecord, 'listId' | 'key' | 'status' | 'sesTopic' | 'sendFromRegistry'>>
  /** listId → is its parity diff empty? (bridged lists only). */
  parityEmpty: Map<string, boolean>
  /** Wednesday–Saturday in Toronto (the weekly send window). */
  inSendWindow: boolean
}

/** Every reason the switch must not run. Empty = go. */
export function switchRefusals(input: SwitchPreflightInput): string[] {
  const out: string[] = []
  const active = input.lists.filter((l) => l.status === 'active')
  for (const l of active) {
    if (!l.sesTopic) continue // a list with no SES topic always sends from the registry
    if (l.sendFromRegistry !== true) {
      out.push(`List "${l.key}" (${l.listId}) still sends from its SES topic: cut it over first.`)
    }
    if (input.parityEmpty.get(l.listId) !== true) {
      out.push(`List "${l.key}" (${l.listId}) parity is not empty.`)
    }
  }
  if (input.inSendWindow) {
    out.push('It is Wednesday–Saturday in Toronto (the send window). Run this Sunday–Tuesday.')
  }
  return out
}

// ---------------------------------------------------------------------------
// (d): the new topic list
// ---------------------------------------------------------------------------

/** The `Topics` for update-contact-list: the safety nets ONLY, each default OPT_IN. */
export function safetyNetTopicList(topics: readonly SafetyNetTopic[] = SAFETY_NET_TOPICS) {
  return topics.map((t) => ({
    TopicName: t.name,
    DisplayName: t.displayName,
    Description: t.description,
    DefaultSubscriptionStatus: 'OPT_IN' as const,
  }))
}

/** (g) Problems with a read-back topic list; empty = exactly the safety nets, default OPT_IN. */
export function topicListProblems(
  topics: Array<{ TopicName?: string; DefaultSubscriptionStatus?: string }> | undefined,
  expected: readonly SafetyNetTopic[] = SAFETY_NET_TOPICS
): string[] {
  const out: string[] = []
  const got = new Map((topics ?? []).map((t) => [t.TopicName, t.DefaultSubscriptionStatus]))
  for (const t of expected) {
    if (!got.has(t.name)) out.push(`Missing topic ${t.name}`)
    else if (got.get(t.name) !== 'OPT_IN') out.push(`Topic ${t.name} does not default to OPT_IN`)
  }
  for (const name of got.keys()) {
    if (!expected.some((t) => t.name === name)) out.push(`Unexpected topic ${name} is still on the list`)
  }
  return out
}

// ---------------------------------------------------------------------------
// (e): UnsubscribeAll and letter-case duplicates
// ---------------------------------------------------------------------------

export interface ContactSnapshot {
  email: string
  unsubscribeAll: boolean
  attributesData?: string
}

/** Contacts that had UnsubscribeAll before the switch but not after (to re-apply). */
export function lostUnsubscribeAll(before: ContactSnapshot[], after: Map<string, boolean>): string[] {
  return before.filter((c) => c.unsubscribeAll && after.get(c.email) !== true).map((c) => c.email)
}

export interface CaseDuplicatePlan {
  /** The lower-case address that remains. */
  email: string
  /** Does a contact with exactly the lower-case address already exist? */
  lowerExists: boolean
  /** UnsubscribeAll for the remaining contact: set if ANY variant had it (never loses a "stop"). */
  unsubscribeAll: boolean
  /** AttributesData to keep: the lower-case contact's, else the first variant's that has any. */
  attributesData?: string
  /** Mixed-case contacts to delete once the lower-case one is right. */
  deleteVariants: string[]
}

/**
 * Every contact whose address is not all lower case, grouped by its lower-case
 * address. Topic opt-ins are not merged here: the registry backfill already
 * merged them (subscriptions live in SUB# rows), and the switch drops topic
 * preferences anyway. What must survive is UnsubscribeAll.
 */
export function planCaseDuplicates(contacts: ContactSnapshot[]): CaseDuplicatePlan[] {
  const groups = new Map<string, ContactSnapshot[]>()
  for (const c of contacts) {
    const key = c.email.trim().toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const out: CaseDuplicatePlan[] = []
  for (const [email, members] of groups) {
    const variants = members.filter((c) => c.email !== email)
    if (variants.length === 0) continue
    const lower = members.find((c) => c.email === email)
    out.push({
      email,
      lowerExists: !!lower,
      unsubscribeAll: members.some((c) => c.unsubscribeAll),
      attributesData: lower?.attributesData || variants.find((v) => v.attributesData)?.attributesData,
      deleteVariants: variants.map((v) => v.email).sort(),
    })
  }
  return out.sort((a, b) => a.email.localeCompare(b.email))
}
