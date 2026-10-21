/**
 * Draft the R3 office assignments from today's data (READ-ONLY).
 *
 * Writes an assignments file for `backfill-office-assignments.ts`, following
 * `proposeOfficeAssignments` (office-assignments.ts):
 *   - a nameless record's address becomes an office's own address (the RB
 *     office first, then vacant Rep offices); the record is reported to
 *     retire in R8, not touched;
 *   - a named flagged Recording Brother holds the RB office; other named
 *     people who receive inter-ecclesia mail today hold Rep offices;
 *   - an RB office already set (Recording Brothers page, nomination) is kept.
 *
 * The output may hold office addresses: write it OUTSIDE the repo (it is
 * public) and review it before applying. Prints counts and ids only.
 *
 *   npx tsx scripts/propose-office-assignments.ts --out <private/path.json>
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadCredentials, readOfficeSnapshot } from './lib/office-snapshot'

async function main() {
  const i = process.argv.indexOf('--out')
  const out = i >= 0 ? process.argv[i + 1] : undefined
  if (!out) throw new Error('--out <path.json> is required (outside the repo)')
  if (resolve(out).startsWith(resolve(__dirname, '..'))) throw new Error('Write the proposal outside the repo: it may hold addresses')

  loadCredentials()
  const plans = await import('../packages/app/provider/dynamodb/repositories/office-assignments')
  const { ecclesiaIdOf } = await import('../packages/app/provider/dynamodb/people-index/keys')

  const snap = await readOfficeSnapshot()
  const list = plans.registryListRecipients(snap.listItems, 'interEcclesia')
  const subscribed = new Set([...list.byAddress.values()].flat())
  const proposal = plans.proposeOfficeAssignments({
    ecclesias: snap.ecclesias.map((e) => ({
      ecclesiaId: ecclesiaIdOf(e),
      name: e.name,
      recordingBrotherEmail: e.recordingBrotherEmail,
    })),
    persons: snap.profiles
      .filter((p) => p.role !== 'deceased')
      .map((p) => ({
        personId: p.personId,
        ecclesia: p.ecclesia,
        named: !!((p.firstName || '').trim() || (p.lastName || '').trim()),
        primaryEmail: p.primaryEmail || '',
        isInterEcclesiaRep: !!p.isInterEcclesiaRep,
        isRecordingBrother: !!p.isRecordingBrother,
        isRepRole: p.role === 'rep',
        receivesInterEcclesia: subscribed.has(p.personId),
        optedOutInterEcclesia: list.optedOut.has(p.personId),
      })),
    existingOffices: snap.offices as any,
  })
  writeFileSync(out, JSON.stringify(proposal.file, null, 2))

  const rows = proposal.file.assignments
  const rb = rows.filter((r) => r.office === 'rb')
  console.log(
    JSON.stringify(
      {
        wrote: out,
        rows: rows.length,
        rbOffices: rb.length,
        rbWithHolder: rb.filter((r) => r.holderPersonId).length + proposal.keptRbHolders,
        rbHoldersKept: proposal.keptRbHolders,
        rbWithOwnAddress: rb.filter((r) => r.inbox || r.inboxFromPersonId).length,
        repWithHolder: rows.filter((r) => r.office === 'rep' && r.holderPersonId).length,
        repAddressOnly: rows.filter((r) => r.office === 'rep' && !r.holderPersonId).length,
        namelessToRetireInR8: proposal.namelessToRetire,
        unmatchedContacts: proposal.unmatchedContacts,
      },
      null,
      2
    )
  )
  console.log('\nNext: npx tsx scripts/backfill-office-assignments.ts --input ' + out)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
