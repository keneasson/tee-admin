/**
 * READ-ONLY parity check for the inter-ecclesia cutover (R3).
 *
 * Compares the addresses today's path sends to (every PROFILE with
 * `isInterEcclesiaRep`, by primary address — what `cron/sync-ses-contacts` opts
 * into the interEcclesia topic) with what the offices yield through
 * `officeRepository.listAllInterEcclesiaContacts` (each RB/Rep office's inbox,
 * else its holder's primary address). Test accounts are excluded from both.
 *
 * Prints counts and ids only. Exit code 1 when the sets differ, so the
 * cutover can require an empty diff.
 *
 *   npx tsx scripts/diff-inter-ecclesia-recipients.ts
 */
import { addressesToPersonIds, loadCredentials, readOfficeSnapshot } from './lib/office-snapshot'

async function main() {
  loadCredentials()
  const plans = await import('../packages/app/provider/dynamodb/repositories/office-assignments')
  const repo = await import('../packages/app/provider/dynamodb/repositories/office-repository')

  const snap = await readOfficeSnapshot()
  const legacy = plans.legacyInterEcclesiaRecipients(snap.profiles as any)
  const contacts = await repo.officeRepository.listAllInterEcclesiaContacts(snap.ecclesiaIds)
  const diff = repo.diffRecipientAddresses(legacy.keys(), contacts.flatMap((c) => (c.email ? [c.email] : [])))

  console.log(
    JSON.stringify(
      {
        today: legacy.size,
        offices: contacts.filter((c) => c.email).length,
        officesWithNoAddress: contacts.filter((c) => !c.email).map((c) => `${c.ecclesiaId}/${c.officeId}`),
        same: diff.same,
        onlyToday: diff.onlyLegacy.length,
        onlyTodayPersonIds: addressesToPersonIds(diff.onlyLegacy, snap.profiles),
        onlyOffices: diff.onlyOffices.length,
        onlyOfficesOfficeIds: contacts
          .filter((c) => c.email && diff.onlyOffices.includes(c.email))
          .map((c) => `${c.ecclesiaId}/${c.officeId}`)
          .sort(),
      },
      null,
      2
    )
  )
  if (diff.onlyLegacy.length > 0 || diff.onlyOffices.length > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
