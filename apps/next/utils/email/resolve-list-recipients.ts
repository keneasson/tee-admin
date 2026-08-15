import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getSuppressedSet } from './suppression'

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
 * DARK: nothing calls this on the live send path yet. It is exercised only by
 * the flag-gated parity harness (/api/admin/mailing-lists/parity) until the
 * Phase 4 cutover. It performs NO writes.
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
  ) => Promise<Array<{ emailId: string; verified: boolean }>>
  /** SES account suppression lookup for a batch of addresses. */
  getSuppressed: (emails: string[]) => Promise<Set<string>>
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
    return emails.map((e) => ({ emailId: e.emailId, verified: e.verified }))
  },
  getSuppressed: (emails) => getSuppressedSet(emails),
}

/**
 * Resolve the de-duped, filtered recipient list for a mailing list.
 * `deps` is injectable so tests can mock the repo + SES; production uses the
 * real repositories and the SES account suppression list.
 */
export async function resolveListRecipients(
  listId: string,
  deps: ResolveDeps = defaultDeps
): Promise<ResolveResult> {
  const candidates = await deps.listSubscribers(listId)

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
    })
  )

  return filterRecipients(candidates, suppressed, verifiedByEmailId)
}
