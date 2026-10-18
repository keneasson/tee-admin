import { GetContactCommand, type SESv2Client } from '@aws-sdk/client-sesv2'
import { officeRepository } from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { getAllEcclesia } from '../dynamodb/locations'
import { getSuppressedSet } from './suppression'
import { inputTemplate } from './contact-lists'
import { getSesClient } from './sesClient'

/**
 * Inter-ecclesia recipients resolved from OFFICES (R3), for the send path.
 *
 * Every ecclesia's Recording Brother and Rep offices: each office's own inbox,
 * else its holder's primary address (`officeRepository.listAllInterEcclesiaContacts`).
 * Then the two safety filters the SES topic send applies:
 *   - the SES account suppression list (bounces / complaints), and
 *   - a contact who chose "unsubscribe from all" on the TEEAdmin list.
 *
 * Returns null — "use today's SES `interEcclesia` topic" — unless BOTH:
 *   1. the `inter_ecclesia_from_offices` flag is released to everyone, and
 *   2. the owner-confirmed office assignments are applied (`OFFICES#META / ASSIGNED`).
 *      `scripts/backfill-office-assignments.ts --apply` writes that marker only
 *      when the recipient diff against today's `isInterEcclesiaRep` path is
 *      empty, and `scripts/diff-inter-ecclesia-recipients.ts` (exit 0 = same
 *      addresses) re-checks it before the flag is flipped.
 * Any error also returns null, so a failed office read never drops a send.
 */
export async function interEcclesiaRecipientsFromOffices(
  client: SESv2Client = getSesClient()
): Promise<string[] | null> {
  try {
    if (!(await checkFeatureFlagFromDB(FEATURE_FLAGS.INTER_ECCLESIA_FROM_OFFICES, null))) return null
    if (!(await officeRepository.officesAssigned())) return null

    const ecclesias = await getAllEcclesia()
    const contacts = await officeRepository.listAllInterEcclesiaContacts(ecclesias.map((e) => ecclesiaIdOf(e)))
    const addresses = [...new Set(contacts.flatMap((c) => (c.email ? [c.email.trim().toLowerCase()] : [])))].sort()

    const suppressed = await getSuppressedSet(addresses, client)
    const unsubscribedAll = await unsubscribedFromAll(addresses, client)
    return addresses.filter((a) => !suppressed.has(a) && !unsubscribedAll.has(a))
  } catch (error) {
    console.error('inter-ecclesia: office recipient resolution failed; using the SES topic', error)
    return null
  }
}

/** Addresses whose TEEAdmin contact has UnsubscribeAll set. No contact = not unsubscribed. */
async function unsubscribedFromAll(addresses: string[], client: SESv2Client): Promise<Set<string>> {
  const out = new Set<string>()
  await Promise.all(
    addresses.map(async (email) => {
      try {
        const contact = await client.send(new GetContactCommand({ ...inputTemplate, EmailAddress: email }))
        if (contact.UnsubscribeAll) out.add(email)
      } catch (error: any) {
        if (error?.name !== 'NotFoundException') throw error
      }
    })
  )
  return out
}
