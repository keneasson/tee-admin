/**
 * Add ONE visiting speaker to the directory, by hand.
 *
 * WHY THIS EXISTS: the Visiting Speakers ingest is the normal path, but it
 * SKIPS any row whose ecclesia column is blank ("no home ecclesia column
 * value"). That is deliberate — `ecclesia` is key material (`gsi2pk:
 * ECCLESIA#{ecclesia}`), and an empty one writes a record that saves happily
 * and is then permanently invisible, which is exactly how the Grand River
 * ecclesia was lost. So a speaker whose ecclesia is missing from the sheet
 * never gets created, and the heads-up for them resolves to nothing.
 *
 * This script closes that gap for a single person once somebody has ESTABLISHED
 * the missing ecclesia. It does not guess: every field is supplied explicitly.
 *
 * It runs the REAL ingest (`syncVisitingSpeakers`) with only the sheet read
 * stubbed, rather than writing to DynamoDB directly. That matters — the ingest
 * carries the resolver, the confident-not-found guard, the idempotency check,
 * and the visitor privacy defaults. A hand-rolled `put` would be a second way
 * to create a person and a fresh chance to get the keys wrong.
 *
 * DRY RUN BY DEFAULT. Pass --apply to write.
 *
 *   AWS creds first:  eval "$(aws configure export-credentials --format env)"
 *
 *   npx tsx scripts/add-visiting-speaker.ts \
 *     --name "Tom Briggs" --ecclesia "Barrie Ecclesia" \
 *     --email briggstom64@gmail.com [--phone 705-555-0134] [--apply]
 *
 * Idempotent: a name that already resolves is reported as skipped, not
 * duplicated. Safe to re-run.
 */
import { syncVisitingSpeakers } from '../packages/app/provider/sync/visiting-speakers-ingest'

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : undefined
}

const name = arg('--name')
const ecclesia = arg('--ecclesia')
const email = arg('--email')
const phone = arg('--phone')
const apply = process.argv.includes('--apply')

if (!name || !ecclesia) {
  console.error('Usage: --name "Tom Briggs" --ecclesia "Barrie Ecclesia" [--email x@y.z] [--phone …] [--apply]')
  console.error('\n--ecclesia is REQUIRED and must not be blank: it is part of the record key.')
  process.exit(1)
}

/**
 * The memorial spreadsheet, recorded as the record's `sourceRef` so a future
 * reader can see where the person came from — the same provenance the real
 * ingest writes.
 */
const SHEET_ID = '1rRluyfllvMv50GRQ2ATmG7kVA_n-Pmyo_dxRFPYn0yg'

/** Stands in for the Google read only; every other dependency is the real one. */
const sheets = {
  getSheetDataWithHeaders: async () => ({
    headers: ['Name', 'Ecclesia', 'Email', 'Phone'],
    rows: [[name, ecclesia, email ?? '', phone ?? '']],
  }),
} as never

async function main() {
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${name} / ${ecclesia} / ${email ?? 'no email'}`)

  const result = await syncVisitingSpeakers(SHEET_ID, { dryRun: !apply, sheets })

  const show = (label: string, rows: unknown) => {
    const list = (rows ?? []) as unknown[]
    console.log(`\n${label}: ${list.length}`)
    for (const r of list) console.log('  ', JSON.stringify(r))
  }
  show('created', result.created)
  show('skipped', result.skipped)
  show('backfilled', (result as unknown as { backfilled?: unknown[] }).backfilled)

  if (!apply) console.log('\nNothing was written. Re-run with --apply to write.')
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exit(1)
})
