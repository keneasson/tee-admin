/**
 * Restore home addresses and phones that existed ONLY in the legacy directory
 * (R1, epic #270 — docs/legacy-people-retirement-plan.md §0).
 *
 * When Email Lists started reading only PersonRecords (#279), addresses and
 * phones held only by the legacy `tee-schedules` PK=DIRECTORY#MEMBERS rows
 * disappeared from view. This copies them onto the matching PersonRecord.
 *
 * Rules (the planning logic and its tests live in
 * apps/next/utils/people/restore-legacy-contact-plan.ts):
 *  - a legacy row is matched to exactly ONE person (its email held by exactly
 *    one person, else its exact normalized first+last name held by exactly one
 *    person); ambiguous / no match → listed, not written;
 *  - FILL EMPTY ONLY: an address only if the person has no ADDRESS#, a phone
 *    only if they have no PHONE#. Never overwrites, never deletes;
 *  - unparseable values → listed, not written;
 *  - writes only through personRepository.addAddress / addPhone (isPrimary),
 *    then refreshPersonProjections(personId);
 *  - idempotent: a re-run adds nothing.
 *
 * DRY RUN BY DEFAULT — prints the full plan (names, values) to YOUR terminal.
 * Never paste that output into the repo, an issue or a PR (the repo is public).
 * `--counts-only` prints counts and person ids only.
 *
 * `--apply` first backs up every affected PERSON# partition to the private
 * bucket and verifies the upload; nothing is written unless that succeeds:
 *   s3://tee-admin-backups/backups/<date>-restore-legacy-contact/
 * It makes NO SES calls and sends no email. The legacy rows are only read.
 *
 * Usage (repo root):
 *   npx tsx scripts/restore-legacy-contact.ts                 # dry run, full plan
 *   npx tsx scripts/restore-legacy-contact.ts --counts-only   # dry run, counts only
 *   npx tsx scripts/restore-legacy-contact.ts --apply         # back up, then write
 *
 * Credentials: AWS_* env vars if set, else the default CLI profile. Refuses any
 * account other than 911911532459.
 *
 * DELETE this script (and its plan module + test) with the legacy store in R8.
 */
import {
  affectedPersonIds,
  planRestore,
  type LegacyDirectoryRow,
  type PersonSnapshot,
  type RestorePlan,
} from '../apps/next/utils/people/restore-legacy-contact-plan'
import { backupJsonToS3, loadCredentials } from '../apps/next/utils/mailing-lists/script-env'

type Item = Record<string, any>

const LEGACY_PK = 'DIRECTORY#MEMBERS'

async function main() {
  const apply = process.argv.includes('--apply')
  const countsOnly = process.argv.includes('--counts-only')
  loadCredentials()

  // Imported after credentials are in the environment (config.ts reads them at load).
  const { QueryCommand, ScanCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient, tableNames } = await import('../packages/app/provider/dynamodb/config')

  async function readLegacyRows(): Promise<LegacyDirectoryRow[]> {
    const out: LegacyDirectoryRow[] = []
    let lastKey: Item | undefined
    do {
      const page = await docClient.send(
        new QueryCommand({
          TableName: tableNames.schedules,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: { ':pk': LEGACY_PK },
          ExclusiveStartKey: lastKey,
        })
      )
      for (const i of page.Items || []) {
        out.push({
          sk: String(i.SK),
          firstName: i.firstName ?? null,
          lastName: i.lastName ?? null,
          email: i.email ?? null,
          address: i.address ?? null,
          phone: i.phone ?? null,
        })
      }
      lastKey = page.LastEvaluatedKey
    } while (lastKey)
    return out.sort((a, b) => a.sk.localeCompare(b.sk))
  }

  async function readPeople(): Promise<{ people: PersonSnapshot[]; partitions: Map<string, Item[]> }> {
    const partitions = new Map<string, Item[]>()
    let lastKey: Item | undefined
    do {
      const page = await docClient.send(
        new ScanCommand({
          TableName: tableNames.admin,
          FilterExpression: 'begins_with(pkey, :p)',
          ExpressionAttributeValues: { ':p': 'PERSON#' },
          ExclusiveStartKey: lastKey,
        })
      )
      for (const i of page.Items || []) {
        const id = String(i.pkey).slice('PERSON#'.length)
        const list = partitions.get(id) ?? []
        list.push(i)
        partitions.set(id, list)
      }
      lastKey = page.LastEvaluatedKey
    } while (lastKey)

    const people: PersonSnapshot[] = []
    for (const [personId, items] of partitions) {
      const profile = items.find((i) => i.skey === 'PROFILE')
      if (!profile) continue // a partition without a PROFILE is not a person
      const emails = [
        profile.primaryEmail,
        ...items.filter((i) => String(i.skey).startsWith('EMAIL#')).map((i) => i.email),
      ].filter((e): e is string => typeof e === 'string' && e.includes('@'))
      people.push({
        personId,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        emails,
        addressCount: items.filter((i) => String(i.skey).startsWith('ADDRESS#')).length,
        phoneCount: items.filter((i) => String(i.skey).startsWith('PHONE#')).length,
      })
    }
    return { people, partitions }
  }

  const rows = await readLegacyRows()
  const { people, partitions } = await readPeople()
  const plan = planRestore(rows, people)
  printPlan(plan, rows, people, { countsOnly, apply })

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to back up and write.')
    return
  }
  const targets = affectedPersonIds(plan)
  if (targets.length === 0) {
    console.log('\nNothing to restore.')
    return
  }

  // --- Back up every affected PERSON# partition, verified, before any write ---
  const takenAt = new Date().toISOString()
  const stamp = takenAt.slice(0, 10)
  const key = `backups/${stamp}-restore-legacy-contact/person-partitions-${Date.now()}.json`
  const backupItems = targets.flatMap((id) => partitions.get(id) ?? [])
  const dest = backupJsonToS3(key, {
    table: tableNames.admin,
    takenAt,
    personIds: targets,
    items: backupItems,
  })
  console.log(`\nBacked up ${backupItems.length} items from ${targets.length} PERSON# partitions to ${dest} (verified)`)

  // --- Apply through the repository, re-checking "still empty" live ---
  const { personRepository } = await import('../packages/app/provider/dynamodb/repositories/person-repository')
  const { refreshPersonProjections } = await import('../packages/app/provider/dynamodb/people-index/projections')

  let addedAddresses = 0
  let addedPhones = 0
  let skippedNowFilled = 0
  for (const a of plan.addresses) {
    if ((await personRepository.getAddresses(a.personId)).length > 0) {
      skippedNowFilled++
      continue
    }
    await personRepository.addAddress(a.personId, { type: 'home', isPrimary: true, ...a.value })
    addedAddresses++
  }
  for (const p of plan.phones) {
    if ((await personRepository.getPhones(p.personId)).length > 0) {
      skippedNowFilled++
      continue
    }
    await personRepository.addPhone(p.personId, { type: p.value.type, number: p.value.number, isPrimary: true })
    addedPhones++
  }
  for (const id of targets) await refreshPersonProjections(id)
  console.log(
    `Applied: ${addedAddresses} addresses, ${addedPhones} phones added; ${skippedNowFilled} skipped (filled since the plan). Projections refreshed for ${targets.length} people.`
  )

  // --- Verify: a second plan has nothing left to add ---
  const again = planRestore(await readLegacyRows(), (await readPeople()).people)
  const remaining = again.addresses.length + again.phones.length
  if (remaining > 0) {
    console.error(`Verification failed: a re-plan still has ${remaining} additions`)
    process.exitCode = 1
    return
  }
  console.log('Verification: a re-plan adds nothing (idempotent).')
}

function printPlan(
  plan: RestorePlan,
  rows: LegacyDirectoryRow[],
  people: PersonSnapshot[],
  opts: { countsOnly: boolean; apply: boolean }
) {
  console.log(`\n=== Restore legacy contact (${opts.apply ? 'APPLY' : 'DRY RUN'}) ===\n`)
  console.log(JSON.stringify({ people: people.length, ...plan.counts }, null, 2))

  if (opts.countsOnly) {
    console.log(`\nPeople to write: ${affectedPersonIds(plan).join(', ') || 'none'}`)
    const listedPeople = [...new Set(plan.listed.map((l) => l.personId).filter(Boolean))]
    console.log(`Matched people with a listed (not written) value: ${listedPeople.join(', ') || 'none'}`)
    return
  }

  const byId = new Map(people.map((p) => [p.personId, p]))
  const who = (id: string) => {
    const p = byId.get(id)
    return `${p?.firstName ?? '?'} ${p?.lastName ?? '?'} (${id})`
  }
  const rowName = (i: number) => `${rows[i]?.firstName ?? ''} ${rows[i]?.lastName ?? ''}`.trim() || '(no name)'
  const oneLine = (s?: string) => (s ?? '').replace(/\s*\r?\n\s*/g, ' / ')

  console.log('\nADDRESSES to add (type home, primary):')
  for (const a of plan.addresses) {
    const v = a.value
    console.log(
      `  + ${who(a.personId)}: ${[v.street1, v.street2, v.city, v.province, v.postalCode, v.country].filter(Boolean).join(', ')}`
    )
  }
  console.log('\nPHONES to add (primary):')
  for (const p of plan.phones) console.log(`  + ${who(p.personId)}: ${p.value.number} (${p.value.type})`)
  console.log('\nLISTED — not written (fix by hand on the profile, or ignore):')
  for (const l of plan.listed) {
    console.log(
      `  - row "${rowName(l.rowIndex)}"${l.personId ? ` → ${who(l.personId)}` : ''}: ${l.reason}${l.raw ? ` — "${oneLine(l.raw)}"` : ''}`
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
