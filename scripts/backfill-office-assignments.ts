/**
 * Apply the owner's CONFIRMED office assignments (R3,
 * docs/legacy-people-retirement-plan.md §0).
 *
 * Input: the review page's confirmed answers as a JSON file (shape in
 * `packages/app/provider/dynamodb/repositories/office-assignments.ts`). Keep it
 * out of the repo: it may hold office inbox addresses.
 *
 * DRY RUN BY DEFAULT. Prints counts and ids only (never a name or an address):
 *   - the office writes it would make (and every ecclesia lacking an RB office
 *     gets a vacant one)
 *   - row errors (unknown ecclesia/person, nameless or test-account holder, …)
 *   - the inter-ecclesia recipient diff: today's `isInterEcclesiaRep` addresses
 *     vs. what the planned offices would yield
 *
 * --apply refuses while any row has an error, and while the recipient diff is
 * not empty unless `--accept-diff` is passed (the owner accepted those
 * differences; the count is recorded on the marker). It backs up every ECCLESIA_ID#
 * item, every referenced PROFILE and the offices marker to
 *   s3://tee-admin-backups/backups/<date>-office-assignments/
 * then writes ONLY through `officeRepository`, re-plans to verify nothing is
 * left, and writes the offices marker (`OFFICES#META / ASSIGNED`). It never
 * writes a person or ecclesia record and never deletes or merges anything.
 *
 * Usage:
 *   npx tsx scripts/backfill-office-assignments.ts --input <file.json>            # dry run
 *   npx tsx scripts/backfill-office-assignments.ts --input <file.json> --apply [--accept-diff]
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { TABLE, addressesToPersonIds, loadCredentials, readOfficeSnapshot, toPersonSnapshots } from './lib/office-snapshot'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const inputPath = arg('--input')
  if (!inputPath) throw new Error('--input <confirmed-assignments.json> is required')
  const apply = process.argv.includes('--apply')
  const acceptDiff = process.argv.includes('--accept-diff')
  const file = JSON.parse(readFileSync(inputPath, 'utf8'))
  if (!Array.isArray(file?.assignments)) throw new Error('input must be { "assignments": [...] }')

  loadCredentials()
  const plans = await import('../packages/app/provider/dynamodb/repositories/office-assignments')
  const repo = await import('../packages/app/provider/dynamodb/repositories/office-repository')

  const planFrom = async () => {
    const snap = await readOfficeSnapshot()
    const persons = toPersonSnapshots(snap.profiles)
    const plan = plans.planOfficeAssignments({
      file,
      ecclesiaIds: snap.ecclesiaIds,
      persons,
      existingOffices: snap.offices as any,
    })
    return { snap, persons, plan }
  }

  const { snap, persons, plan } = await planFrom()
  const predicted = plans.predictInterEcclesiaContacts(plan, persons)
  const legacy = plans.legacyInterEcclesiaRecipients(snap.profiles as any)
  const diff = repo.diffRecipientAddresses(legacy.keys(), predicted.flatMap((c) => (c.email ? [c.email] : [])))
  const count = (op: string) => plan.actions.filter((a) => a.op === op).length

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        source: { profiles: snap.profiles.length, ecclesias: snap.ecclesiaIds.length, existingOffices: snap.offices.length },
        rows: { total: file.assignments.length, skippedUnconfirmed: plan.skippedUnconfirmed, errors: plan.errors },
        planned: {
          createOffice: count('createOffice'),
          vacantRbOfficesCreated: plan.actions.filter((a) => a.op === 'createOffice' && a.reason === 'rb-missing').length,
          setChannels: count('setChannels'),
          assignHolder: count('assignHolder'),
        },
        interEcclesiaDiff: {
          same: diff.same,
          onlyToday: diff.onlyLegacy.length,
          onlyTodayPersonIds: addressesToPersonIds(diff.onlyLegacy, snap.profiles),
          onlyOffices: diff.onlyOffices.length,
          onlyOfficesOfficeIds: predicted
            .filter((c) => c.email && diff.onlyOffices.includes(c.email))
            .map((c) => `${c.ecclesiaId}/${c.officeId}`)
            .sort(),
          officesWithNoAddress: predicted.filter((c) => !c.email).length,
        },
      },
      null,
      2
    )
  )

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }
  if (plan.errors.length > 0) throw new Error(`Refusing to --apply: ${plan.errors.length} row error(s) above`)
  const diffCount = diff.onlyLegacy.length + diff.onlyOffices.length
  if (diffCount > 0 && !acceptDiff) {
    throw new Error(
      `Refusing to --apply: the offices would reach ${diffCount} address(es) differently from today's inter-ecclesia path. ` +
        'Fix the input, or pass --accept-diff once the owner has accepted the differences above.'
    )
  }

  // --- Back up every affected key range first ---
  const referenced = new Set(
    file.assignments.flatMap((r: any) => [r.holderPersonId, r.inboxFromPersonId]).filter(Boolean) as string[]
  )
  const backup = {
    table: TABLE,
    takenAt: new Date().toISOString(),
    offices: snap.offices,
    referencedProfiles: snap.profiles.filter((p) => referenced.has(p.personId)),
    input: file,
  }
  const stamp = new Date().toISOString().slice(0, 10)
  const dest = `s3://tee-admin-backups/backups/${stamp}-office-assignments/backup-${Date.now()}.json`
  execSync(`aws s3 cp - ${dest} --sse AES256 --content-type application/json`, {
    input: JSON.stringify(backup),
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log(`Backed up ${snap.offices.length} offices + ${backup.referencedProfiles.length} profiles to ${dest}`)

  // --- Apply through the office writer only ---
  const offices = repo.officeRepository
  for (const a of plan.actions) {
    if (a.op === 'createOffice') {
      if (!(await offices.getOffice(a.ecclesiaId, a.officeId))) await offices.saveOffice({ ecclesiaId: a.ecclesiaId, role: a.officeId })
    } else if (a.op === 'setChannels') {
      await offices.saveOffice({ ecclesiaId: a.ecclesiaId, role: a.officeId, email: a.email, phone: a.phone })
    } else {
      await offices.assignHolder(a.ecclesiaId, a.officeId, a.personId)
    }
  }

  // --- Verify: a second plan has nothing left to do ---
  const after = await planFrom()
  if (after.plan.actions.length > 0 || after.plan.errors.length > 0) {
    console.error('Verification failed: offices still differ after apply', after.plan.actions.length, after.plan.errors)
    process.exitCode = 1
    return
  }
  await offices.writeOfficesAssignedMarker({
    offices: after.snap.offices.length,
    ecclesias: after.snap.ecclesiaIds.length,
    recipientDiffAccepted: diffCount,
  })
  console.log(`Applied ${plan.actions.length} office writes. Verification pass: 0 differences. Offices marker written.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
