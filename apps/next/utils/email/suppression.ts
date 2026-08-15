import {
  GetSuppressedDestinationCommand,
  type SESv2Client,
} from '@aws-sdk/client-sesv2'
import { getSesClient } from './sesClient'

/**
 * SES account-level suppression list helpers.
 *
 * The account suppression list (bounces / complaints — the "master scrub") is a
 * SEPARATE system from per-contact TopicPreferences and survives topic-list
 * edits. Today NEITHER send path checks it before sending; it relies on SES to
 * silently drop suppressed destinations at send time. The in-house recipient
 * resolver (Phase 2) closes that gap by excluding suppressed addresses UP FRONT
 * so counts + previews reflect who will actually receive the mail.
 *
 * We use the per-address `GetSuppressedDestinationCommand` (NotFound = not
 * suppressed) rather than paging the whole list. That keeps the check O(recipients)
 * of small point-reads instead of pulling the entire account list, and it is
 * trivial to mock. For a very large fan-out where the suppression list is small,
 * `ListSuppressedDestinationsCommand` (as the /api/ses/suppression-list route and
 * admin email search already use) would be cheaper — swap in if that becomes the
 * hot path.
 */

/** True when a single address is on the SES account suppression list. */
export async function isSuppressed(
  email: string,
  client: SESv2Client = getSesClient()
): Promise<boolean> {
  try {
    await client.send(
      new GetSuppressedDestinationCommand({ EmailAddress: email.toLowerCase() })
    )
    return true
  } catch (error: any) {
    if (error?.name === 'NotFoundException') return false
    // Any other error (throttling, creds) must NOT silently drop a recipient by
    // treating them as suppressed — rethrow so the caller can decide.
    throw error
  }
}

/**
 * Resolve the subset of `emails` that are suppressed, as a lowercased Set.
 * De-dupes the input and issues one point-read per unique address. Intended to
 * be called ONCE per resolve so the result can be cached for that pass.
 */
export async function getSuppressedSet(
  emails: string[],
  client: SESv2Client = getSesClient()
): Promise<Set<string>> {
  const unique = Array.from(new Set(emails.map((e) => e.toLowerCase())))
  const suppressed = new Set<string>()
  await Promise.all(
    unique.map(async (email) => {
      if (await isSuppressed(email, client)) suppressed.add(email)
    })
  )
  return suppressed
}
