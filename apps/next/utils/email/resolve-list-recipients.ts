import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { MailingListRecord } from '@my/app/provider/dynamodb/types'
import { getSuppressedSet } from './suppression'
import { eligiblePeopleForList, type EligiblePerson } from '../mailing-lists/default-opt-in'

/**
 * Phase 2 — the in-house recipient resolver.
 *
 * Given a list id, resolve who should actually receive mail for that list by
 * reading the in-house registry (ListSubscriptionRecord opt-ins) and applying
 * the two safety filters SES used to do implicitly at send time:
 *
 *   1. SUPPRESSION — exclude any address on the SES account suppression list
 *      (bounces / complaints). Previously the send path relied on SES to drop
 *      these silently; here they are removed up front so counts are honest.
 *   2. VERIFICATION — exclude addresses whose PersonEmailRecord.verified === false.
 *      Verification is NOT carried on the subscription row; it lives on the
 *      canonical EMAIL# item (PersonEmailRecord.verified, see
 *      packages/app/provider/dynamodb/types.ts). We join to it per person.
 *
 * DEFAULT OPT-IN (R5): for a list with `defaultOptIn`, eligible people with no
 * row on the list are added as candidates (see mailing-lists/default-opt-in.ts
 * for the rule), then filtered exactly like everyone else.
 *
 * Used by every list send (via mailing-lists/registry-send.ts) and by parity.
 * It performs NO writes.
 */

export interface ResolvedRecipient {
  email: string
  personId: string
  emailId: string
}

export interface ResolveStats {
  /** opt_in subscription rows returned by the registry (pre-filter). */
  candidates: number
  /** removed because the address is on the SES account suppression list. */
  suppressedRemoved: number
  /** removed because the canonical EMAIL# row is verified === false. */
  unverifiedRemoved: number
  /** removed as duplicate (same email already kept). */
  duplicatesRemoved: number
  /** final recipient count (== recipients.length). */
  recipients: number
  /** candidates added by the list's defaultOptIn (before filtering). */
  defaultOptIn?: number
}

export interface ResolveResult {
  recipients: ResolvedRecipient[]
  stats: ResolveStats
}

/** One opt-in candidate before filtering. */
export interface RecipientCandidate {
  email: string
  personId: string
  emailId: string
}

/**
 * Pure filter: apply suppression + verification + de-dupe to a candidate set and
 * report stats. Extracted from IO so it is unit-testable without AWS or Dynamo.
 *
 * @param suppressed        lowercased set of suppressed addresses
 * @param verifiedByEmailId map `${personId}#${emailId}` → verified boolean. A
 *                          missing entry is treated as UNVERIFIED (fail-closed):
 *                          we could not confirm the address, so we do not mail it.
 */
export function filterRecipients(
  candidates: RecipientCandidate[],
  suppressed: Set<string>,
  verifiedByEmailId: Map<string, boolean>
): ResolveResult {
  const recipients: ResolvedRecipient[] = []
  const seen = new Set<string>()
  let suppressedRemoved = 0
  let unverifiedRemoved = 0
  let duplicatesRemoved = 0

  for (const candidate of candidates) {
    const email = candidate.email.toLowerCase()

    if (suppressed.has(email)) {
      suppressedRemoved++
      continue
    }

    const verified = verifiedByEmailId.get(`${candidate.personId}#${candidate.emailId}`)
    if (verified === false || verified === undefined) {
      unverifiedRemoved++
      continue
    }

    if (seen.has(email)) {
      duplicatesRemoved++
      continue
    }
    seen.add(email)
    recipients.push({ email, personId: candidate.personId, emailId: candidate.emailId })
  }

  return {
    recipients,
    stats: {
      candidates: candidates.length,
      suppressedRemoved,
      unverifiedRemoved,
      duplicatesRemoved,
      recipients: recipients.length,
    },
  }
}

/** Injectable IO dependencies (real implementations wired by default). */
export interface ResolveDeps {
  /** opt_in subscriptions for a list (registry GSI1 fan-out). */
  listSubscribers: (listId: string) => Promise<RecipientCandidate[]>
  /** canonical EMAIL# rows for a person → verification lookup. */
  getEmailsForPerson: (
    personId: string
  ) => Promise<Array<{ emailId: string; verified: boolean; email?: string }>>
  /** SES account suppression lookup for a batch of addresses. */
  getSuppressed: (emails: string[]) => Promise<Set<string>>
  /** Every row (opt_in + opt_out) on a list. Needed only for a defaultOptIn list. */
  listAllRows?: (listId: string) => Promise<Array<{ email: string; personId: string; status: 'opt_in' | 'opt_out' }>>
  /** Everyone a defaultOptIn list reaches by default. Needed only for a defaultOptIn list. */
  eligiblePeople?: (list: ResolvableList) => Promise<EligiblePerson[]>
}

/** The list fields the resolver reads. A bare listId means "no defaultOptIn". */
export type ResolvableList = Pick<MailingListRecord, 'listId' | 'defaultOptIn' | 'scope' | 'scopeValue'>

/**
 * Pure: the default-opt-in candidates. An eligible person is added only when
 * they have NO row on the list and their address has no opt-out row on it.
 * `emailId` is left empty; the resolver fills it from the person's EMAIL# rows
 * (no matching row → unverified → dropped, fail-closed).
 */
export function defaultOptInCandidates(
  eligible: EligiblePerson[],
  rows: Array<{ email: string; personId: string; status: 'opt_in' | 'opt_out' }>
): RecipientCandidate[] {
  const personsWithRow = new Set(rows.map((r) => r.personId))
  const optedOut = new Set(rows.filter((r) => r.status === 'opt_out').map((r) => r.email.toLowerCase()))
  return eligible
    .filter((p) => p.email && !personsWithRow.has(p.personId) && !optedOut.has(p.email.toLowerCase()))
    .map((p) => ({ email: p.email.toLowerCase(), personId: p.personId, emailId: '' }))
}

const defaultDeps: ResolveDeps = {
  listSubscribers: async (listId) => {
    const subs = await mailingListRepository.listSubscribers(listId)
    // personId is not a stored field — it is the pkey suffix (PERSON#{personId}).
    return subs.map((s) => ({
      email: s.email,
      personId: s.pkey.replace(/^PERSON#/, ''),
      emailId: s.emailId,
    }))
  },
  getEmailsForPerson: async (personId) => {
    const emails = await personRepository.getEmails(personId)
    return emails.map((e) => ({ emailId: e.emailId, verified: e.verified, email: e.email }))
  },
  getSuppressed: (emails) => getSuppressedSet(emails),
  listAllRows: async (listId) =>
    (await mailingListRepository.listAllSubscriptionRows(listId)).map((r) => ({
      email: r.email,
      personId: r.pkey.replace(/^PERSON#/, ''),
      status: r.status,
    })),
  eligiblePeople: (list) => eligiblePeopleForList(list),
}

/**
 * Resolve the de-duped, filtered recipient list for a mailing list.
 * `deps` is injectable so tests can mock the repo + SES; production uses the
 * real repositories and the SES account suppression list.
 */
export async function resolveListRecipients(
  listOrId: string | ResolvableList,
  deps: ResolveDeps = defaultDeps
): Promise<ResolveResult> {
  const list = typeof listOrId === 'string' ? null : listOrId
  const listId = typeof listOrId === 'string' ? listOrId : listOrId.listId
  const explicit = await deps.listSubscribers(listId)

  let defaults: RecipientCandidate[] = []
  if (list?.defaultOptIn) {
    if (!deps.listAllRows || !deps.eligiblePeople) {
      throw new Error('resolveListRecipients: a defaultOptIn list needs listAllRows + eligiblePeople')
    }
    const [rows, eligible] = await Promise.all([deps.listAllRows(listId), deps.eligiblePeople(list)])
    defaults = defaultOptInCandidates(eligible, rows)
  }
  const candidates = [...explicit, ...defaults]

  // Suppression: one batched pass, cached for this resolve.
  const suppressed = await deps.getSuppressed(candidates.map((c) => c.email))

  // Verification: join to the canonical EMAIL# rows, one read per UNIQUE person.
  const uniquePersonIds = Array.from(new Set(candidates.map((c) => c.personId)))
  const verifiedByEmailId = new Map<string, boolean>()
  await Promise.all(
    uniquePersonIds.map(async (personId) => {
      const emails = await deps.getEmailsForPerson(personId)
      for (const e of emails) {
        verifiedByEmailId.set(`${personId}#${e.emailId}`, e.verified)
      }
      // A default candidate carries only an address: find its EMAIL# row.
      for (const c of defaults) {
        if (c.personId !== personId) continue
        const row = emails.find((e) => (e.email || '').toLowerCase() === c.email)
        if (row) c.emailId = row.emailId
      }
    })
  )

  const result = filterRecipients(candidates, suppressed, verifiedByEmailId)
  return list?.defaultOptIn ? { ...result, stats: { ...result.stats, defaultOptIn: defaults.length } } : result
}
