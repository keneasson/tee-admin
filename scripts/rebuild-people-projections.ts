/**
 * Rebuild the people/ecclesia projections from their sources (#275, epic #270).
 *
 * Writes ONLY derived projection items (see
 * `packages/app/provider/dynamodb/people-index/keys.ts`):
 *   PERSON#<id> / CARD, NAMETOK#…      ECCLESIA_ID#<id> / ECCLESIA
 *   (never an OFFICE# item: offices are source data, written by officeRepository)
 *   PEOPLE_INDEX#META / BUILD (the "index is built" marker readers wait for)
 * It never writes a PROFILE / EMAIL# / PHONE# / ECCLESIA item: every write goes
 * through the same writer the app uses (`refreshPersonProjections`,
 * `refreshEcclesiaProjections`), which refuses any non-projection key.
 *
 * Idempotent: it re-derives each projection and applies only the difference,
 * so a second run reports 0 puts / 0 deletes.
 *
 * DRY RUN BY DEFAULT — prints counts only (no names, no addresses).
 *
 * --apply requires --after-deploy (the writers must be live first, so nothing
 * written after this run goes stale) and first backs up every affected key
 * range — all PERSON# partitions, ECCLESIA items, and any existing
 * ECCLESIA_ID# / marker items — to the private bucket:
 *   s3://tee-admin-backups/backups/<date>-people-index-backfill/backup.json
 *
 * Usage:
 *   npx tsx scripts/rebuild-people-projections.ts            # dry run
 *   npx tsx scripts/rebuild-people-projections.ts --apply --after-deploy
 *
 * Credentials: uses AWS_* env vars if set, else the default CLI profile.
 * Refuses to run against any account other than 911911532459.
 */
import { execSync } from 'node:child_process'

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
  if (apply && !process.argv.includes('--after-deploy')) {
    throw new Error('Refusing to --apply without --after-deploy: the projection writers must be deployed first')
  }
  loadCredentials()

  // Imported after credentials are in the environment (config.ts reads them at load).
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient } = await import('../packages/app/provider/dynamodb/config')
  const idx = await import('../packages/app/provider/dynamodb/people-index')

  // --- Read everything once (a script may Scan; request paths may not) ---
  const all: Item[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const page = await docClient.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }))
    all.push(...((page.Items || []) as Item[]))
    lastKey = page.LastEvaluatedKey
  } while (lastKey)

  const personIds = [...new Set(all.filter((i) => i.pkey.startsWith('PERSON#')).map((i) => i.pkey.slice(7)))].sort()
  const ecclesias = all.filter((i) => i.type === 'ECCLESIA' && i.pkey.startsWith('ECCLESIA#'))
  const aliasItems = all.filter((i) => i.pkey.startsWith(idx.ECCLESIA_ID_PREFIX) && i.skey === idx.ECCLESIA_ALIAS_SK)
  const existingProjection = all.filter((i) => idx.isProjectionKey(i))

  // --- Plan (dry run through the real writers) ---
  const kindOf = (k: { pkey: string; skey: string }) => {
    if (k.pkey === idx.INDEX_META_PK) return 'marker'
    if (k.skey === idx.CARD_SK) return 'card'
    if (k.skey.startsWith(idx.NAMETOK_PREFIX)) return 'nameToken'
    return 'ecclesiaDirectory'
  }
  type Tally = Record<string, { put: number; delete: number }>
  const tally = (t: Tally, kind: string, field: 'put' | 'delete') => {
    t[kind] = t[kind] || { put: 0, delete: 0 }
    t[kind][field]++
  }

  async function plan(dryRun: boolean) {
    const t: Tally = {}
    let unchanged = 0
    const collisions: string[] = []
    for (const pid of personIds) {
      const d = await idx.refreshPersonProjections(pid, { dryRun })
      d.puts.forEach((p) => tally(t, kindOf(p), 'put'))
      d.deletes.forEach((p) => tally(t, kindOf(p), 'delete'))
      unchanged += d.unchanged
    }
    const liveIds = new Set<string>()
    for (const e of ecclesias) {
      const d = await idx.refreshEcclesiaProjections({ pkey: e.pkey, skey: e.skey }, { dryRun })
      if (d.ecclesiaId) liveIds.add(d.ecclesiaId)
      if (d.collision) collisions.push(d.ecclesiaId as string)
      d.puts.forEach((p) => tally(t, kindOf(p), 'put'))
      d.deletes.forEach((p) => tally(t, kindOf(p), 'delete'))
      unchanged += d.unchanged
    }
    // Aliases whose ecclesia no longer exists.
    let orphanAliases = 0
    for (const a of aliasItems) {
      if (liveIds.has(a.ecclesiaId)) continue
      orphanAliases++
      if (!dryRun) await idx.removeEcclesiaProjections(a.ecclesiaId, { pkey: a.ecclesiaPkey, skey: a.ecclesiaSkey })
    }
    return { tally: t, unchanged, collisions, orphanAliases }
  }

  const before = await plan(true)
  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    source: {
      personPartitions: personIds.length,
      profiles: all.filter((i) => i.pkey.startsWith('PERSON#') && i.skey === 'PROFILE').length,
      ecclesias: ecclesias.length,
      existingProjectionItems: existingProjection.length,
    },
    planned: before.tally,
    unchanged: before.unchanged,
    orphanEcclesiaAliases: before.orphanAliases,
    ecclesiaIdCollisions: before.collisions,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (!apply) {
    console.log('\nDry run only. Re-run with --apply --after-deploy to write.')
    return
  }

  // --- Back up every affected key range before writing ---
  const backup = all.filter(
    (i) =>
      i.pkey.startsWith('PERSON#') ||
      i.type === 'ECCLESIA' ||
      i.pkey.startsWith(idx.ECCLESIA_ID_PREFIX) ||
      i.pkey === idx.INDEX_META_PK
  )
  const stamp = new Date().toISOString().slice(0, 10)
  const dest = `s3://tee-admin-backups/backups/${stamp}-people-index-backfill/backup-${Date.now()}.json`
  execSync(`aws s3 cp - ${dest} --sse AES256 --content-type application/json`, {
    input: JSON.stringify({ table: TABLE, takenAt: new Date().toISOString(), items: backup }),
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log(`Backed up ${backup.length} items to ${dest}`)

  // --- Apply, then verify a second pass has nothing left to do ---
  await plan(false)
  const after = await plan(true)
  const remaining = Object.values(after.tally).reduce((n, k) => n + k.put + k.delete, 0)
  if (remaining > 0 || after.orphanAliases > 0) {
    console.error('Verification failed: projections still differ after apply', after)
    process.exitCode = 1
    return
  }
  await idx.writeIndexMarker({
    personPartitions: personIds.length,
    ecclesias: ecclesias.length,
    projectionItems: after.unchanged,
  })
  console.log(`Applied. Verification pass: 0 differences, ${after.unchanged} projection items in place. Marker written.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
