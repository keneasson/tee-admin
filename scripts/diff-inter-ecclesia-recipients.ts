/**
 * READ-ONLY parity check for the inter-ecclesia cutover (R3).
 *
 * Compares the addresses today's path sends to — the `interEcclesia` registry
 * list's opt-in rows (R5; the list has no default opt-in) — with what the
 * offices yield through `officeRepository.listAllInterEcclesiaContacts` (each
 * RB/Rep office's own address, else its holder's primary address). Test
 * accounts are excluded from both. Both paths then drop the SES suppression
 * list and "unsubscribe from all" at send time, so those are not compared.
 *
 * Prints counts and ids only. Exit code 1 when the sets differ, so the
 * cutover can require an empty diff (or the owner accepts the listed ones).
 *
 *   npx tsx scripts/diff-inter-ecclesia-recipients.ts
 */
import { addressesToPersonIds, loadCredentials, readOfficeSnapshot } from './lib/office-snapshot'

async function main() {
  loadCredentials()
  const plans = await import('../packages/app/provider/dynamodb/repositories/office-assignments')
  const repo = await import('../packages/app/provider/dynamodb/repositories/office-repository')

  const snap = await readOfficeSnapshot()
  const today = plans.registryListRecipients(snap.listItems, 'interEcclesia')
  if (!today.listId) throw new Error('No mailing list with key "interEcclesia"')
  const contacts = await repo.officeRepository.listAllInterEcclesiaContacts(snap.ecclesiaIds)
  const diff = repo.diffRecipientAddresses(today.byAddress.keys(), contacts.flatMap((c) => (c.email ? [c.email] : [])))

  console.log(
    JSON.stringify(
      {
        listId: today.listId,
        today: today.byAddress.size,
        offices: contacts.filter((c) => c.email).length,
        officesWithNoAddress: contacts.filter((c) => !c.email).map((c) => `${c.ecclesiaId}/${c.officeId}`),
        same: diff.same,
        onlyToday: diff.onlyLegacy.length,
        onlyTodayPersonIds: diff.onlyLegacy.flatMap((a) => today.byAddress.get(a) || []).sort(),
        onlyOffices: diff.onlyOffices.length,
        onlyOfficesOfficeIds: contacts
          .filter((c) => c.email && diff.onlyOffices.includes(c.email))
          .map((c) => `${c.ecclesiaId}/${c.officeId}`)
          .sort(),
        onlyOfficesPersonIds: addressesToPersonIds(diff.onlyOffices, snap.profiles),
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
