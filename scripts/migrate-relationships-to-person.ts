/**
 * Move family relationships from email keys to person keys (R7, epic #270).
 *
 *   legacy  USER#<email>          / RELATIONSHIP#<targetEmail>#<type>
 *   new     PERSON#<personId>     / REL#<targetPersonId>#<type>
 *
 * Each address resolves to the person who holds it (any address they hold; a
 * `@family.local` placeholder resolves to the person holding it). Rules:
 * packages/app/provider/dynamodb/relationship-migration.ts. A row whose address
 * nobody holds is UNRESOLVED: listed, never written, its legacy row kept.
 *
 * Both directions of a relationship are written together in one transaction.
 * A pair that already exists in the new store is left as it is (the app has
 * been writing there since deploy, so it is newer than the legacy row).
 *
 * DRY RUN BY DEFAULT — prints counts and person ids only. The per-row detail
 * (which contains addresses) is written to a local file under the OS temp
 * directory, never to the repo.
 *
 *   npx tsx scripts/migrate-relationships-to-person.ts                  # dry run
 *   npx tsx scripts/migrate-relationships-to-person.ts --apply --after-deploy   # backup, write, verify
 *   npx tsx scripts/migrate-relationships-to-person.ts --apply --after-deploy --delete-legacy
 *        # as --apply, then deletes the legacy rows of every pair that verified
 *
 * --apply requires --after-deploy: run it once the person-keyed readers and
 * writers are live, so no relationship is written to the legacy rows after it.
 *
 * --apply first backs up every legacy RELATIONSHIP# row and every existing
 * REL# row to the private bucket:
 *   s3://tee-admin-backups/backups/<date>-relationships-to-person/backup-<ts>.json
 * Legacy rows are deleted ONLY with --delete-legacy, ONLY after every planned
 * pair verified, and never for an unresolved row.
 *
 * Idempotent: a second run reports every pair as present and writes nothing.
 * Credentials: AWS_* env vars if set, else the default CLI profile. Refuses to
 * run against any account other than 911911532459.
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXPECTED_ACCOUNT = '911911532459'
const TABLE = 'tee-admin'

function loadCredentials() {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    const creds = JSON.parse(execSync('aws configure export-credentials --format process', { encoding: 'utf8' }))
    process.env.AWS_ACCESS_KEY_ID = creds.AccessKeyId
    process.env.AWS_SECRET_ACCESS_KEY = creds.SecretAccessKey
    if (creds.SessionToken) process.env.AWS_SESSION_TOKEN = creds.SessionToken
  }
  const account = execSync('aws sts get-caller-identity --query Account --output text', {
    encoding: 'utf8',
    env: process.env,
  }).trim()
  if (account !== EXPECTED_ACCOUNT) {
    throw new Error(`Refusing to run: AWS account is ${account}, expected ${EXPECTED_ACCOUNT}`)
  }
}

type Item = Record<string, any> & { pkey: string; skey: string }

async function main() {
  const apply = process.argv.includes('--apply')
  const deleteLegacy = process.argv.includes('--delete-legacy')
  if (apply && !process.argv.includes('--after-deploy')) {
    throw new Error('Refusing to --apply without --after-deploy: the person-keyed relationship code must be deployed first')
  }
  if (deleteLegacy && !apply) {
    throw new Error('--delete-legacy runs only together with --apply (it deletes after a verified write)')
  }
  loadCredentials()

  // Imported after credentials are in the environment (config.ts reads them at load).
  const { ScanCommand, GetCommand, TransactWriteCommand, DeleteCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient } = await import('../packages/app/provider/dynamodb/config')
  const { personRepository } = await import('../packages/app/provider/dynamodb/repositories/person-repository')
  const { planRelationshipMigration } = await import('../packages/app/provider/dynamodb/relationship-migration')
  // Reads and these writes only: never refresh person projections from here.
  personRepository.setProjectionSync(null)

  async function scan(filter: string, values: Record<string, string>): Promise<Item[]> {
    const out: Item[] = []
    let lastKey: Record<string, any> | undefined
    do {
      const page = await docClient.send(
        new ScanCommand({
          TableName: TABLE,
          FilterExpression: filter,
          ExpressionAttributeValues: values,
          ExclusiveStartKey: lastKey,
        })
      )
      out.push(...((page.Items || []) as Item[]))
      lastKey = page.LastEvaluatedKey
    } while (lastKey)
    return out
  }

  async function getRow(pkey: string, skey: string): Promise<Item | null> {
    const r = await docClient.send(new GetCommand({ TableName: TABLE, Key: { pkey, skey }, ConsistentRead: true }))
    return (r.Item as Item) || null
  }

  // --- Read (a script may Scan; request paths may not) ---
  const legacy = await scan('begins_with(pkey, :u) AND begins_with(skey, :r)', { ':u': 'USER#', ':r': 'RELATIONSHIP#' })
  const existingNew = await scan('begins_with(pkey, :p) AND begins_with(skey, :r)', { ':p': 'PERSON#', ':r': 'REL#' })

  const plan = await planRelationshipMigration(legacy as any, async (email) => ({
    persons: await personRepository.getAllPersonsByEmail(email),
    emailRows: await personRepository.getEmailsByEmail(email),
  }))

  // --- Compare with what the new store already holds ---
  type Action = 'write' | 'present' | 'repair'
  const actions: Array<{ pair: (typeof plan.pairs)[number]; action: Action }> = []
  for (const pair of plan.pairs) {
    const [f, i] = await Promise.all(pair.rows.map((r) => getRow(r.pkey, r.skey)))
    if (f && i) {
      actions.push({ pair, action: 'present' })
    } else if (f || i) {
      // One direction only (should not happen): rewrite both, keeping the
      // status the existing row has.
      const status = (f || i)!.status
      pair.rows.forEach((r) => (r.status = status))
      actions.push({ pair, action: 'repair' })
    } else {
      actions.push({ pair, action: 'write' })
    }
  }

  const count = (a: Action) => actions.filter((x) => x.action === a).length
  const reasons: Record<string, number> = {}
  plan.unresolved.forEach((u) => (reasons[u.reason] = (reasons[u.reason] || 0) + 1))
  const summary = {
    mode: apply ? (deleteLegacy ? 'apply+delete-legacy' : 'apply') : 'dry-run',
    legacyRows: legacy.length,
    existingPersonKeyedRows: existingNew.length,
    pairs: plan.pairs.length,
    toWrite: count('write'),
    toRepair: count('repair'),
    alreadyPresent: count('present'),
    resolvedBySignInRule: plan.pairs.filter((p) => p.resolvedBySignInRule).length,
    unresolvedRows: plan.unresolved.length,
    unresolvedByReason: reasons,
    pairsByPerson: plan.pairs.map((p) => `${p.sourcePersonId} ${p.relationshipType} ${p.targetPersonId}`),
  }
  console.log(JSON.stringify(summary, null, 2))

  // Per-row detail stays on this machine: it names the legacy keys (addresses).
  const detailPath = join(tmpdir(), `relationships-to-person-${Date.now()}.json`)
  writeFileSync(
    detailPath,
    JSON.stringify(
      {
        unresolved: plan.unresolved,
        resolvedBySignInRule: plan.pairs.filter((p) => p.resolvedBySignInRule).map((p) => ({
          pair: `${p.sourcePersonId} ${p.relationshipType} ${p.targetPersonId}`,
          legacyKeys: p.legacyKeys,
        })),
      },
      null,
      2
    )
  )
  console.log(`Per-row detail (local only, contains addresses): ${detailPath}`)

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply --after-deploy to back up, write and verify.')
    return
  }

  // --- Back up every affected row before writing ---
  const stamp = new Date().toISOString().slice(0, 10)
  const dest = `s3://tee-admin-backups/backups/${stamp}-relationships-to-person/backup-${Date.now()}.json`
  execSync(`aws s3 cp - ${dest} --sse AES256 --content-type application/json`, {
    input: JSON.stringify({ table: TABLE, takenAt: new Date().toISOString(), legacy, existingNew }),
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log(`Backed up ${legacy.length + existingNew.length} items to ${dest}`)

  // --- Write: both directions in one transaction per pair ---
  for (const { pair, action } of actions) {
    if (action === 'present') continue
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: pair.rows.map((row) => ({ Put: { TableName: TABLE, Item: row } })),
      })
    )
  }

  // --- Verify every planned pair is in place (both directions) ---
  const failed: string[] = []
  for (const { pair } of actions) {
    const stored = await Promise.all(pair.rows.map((r) => getRow(r.pkey, r.skey)))
    const ok = stored.every(
      (s, n) =>
        !!s &&
        s.targetPersonId === pair.rows[n].targetPersonId &&
        s.sourcePersonId === pair.rows[n].sourcePersonId &&
        s.relationshipType === pair.rows[n].relationshipType
    )
    if (!ok) failed.push(`${pair.sourcePersonId} ${pair.relationshipType} ${pair.targetPersonId}`)
  }
  if (failed.length > 0) {
    console.error(`Verification FAILED for ${failed.length} pair(s); no legacy row deleted:`, failed)
    process.exitCode = 1
    return
  }
  console.log(`Verified: ${actions.length} pair(s) present in both directions.`)

  if (!deleteLegacy) {
    console.log('Legacy rows kept. Re-run with --apply --after-deploy --delete-legacy to delete them after a verify.')
    return
  }

  // --- Delete legacy rows of verified pairs only (unresolved rows stay) ---
  let deleted = 0
  for (const { pair } of actions) {
    for (const key of pair.legacyKeys) {
      await docClient.send(new DeleteCommand({ TableName: TABLE, Key: key }))
      deleted++
    }
  }
  console.log(`Deleted ${deleted} legacy row(s). ${plan.unresolved.length} unresolved legacy row(s) kept.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
