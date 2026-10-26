/**
 * Backfill the sparse index entries added with the access-pattern registry
 * (`packages/app/provider/dynamodb/access-patterns.ts`, `ENTRIES`) onto items
 * written before their writers set them.
 *
 *   postsAll / postsBySeries      POST#<tenant> / POST#<id>           gsi4 (+ gsi3 when in a series)
 *   meetingsAll                   MEETING#<id> / DETAILS              gsi4
 *   organizationsAll              ORGANIZATION#… / <city>#<name>      gsi4
 *   editRequestByToken/Requester  USER#… / EDIT_REQUEST#<id>          gsi4 + gsi1
 *   contactRequestsByRequester    USER#… / CONTACT_REQUEST#<id>       gsi1
 *   youtubeOAuthAll               USER#… / OAUTH#youtube              gsi4
 *
 * It only ever ADDS gsi attributes, with UpdateItem SET on just those
 * attributes. It never deletes an item or touches any other attribute. An item
 * that already holds a DIFFERENT value in one of those attributes is reported
 * and skipped, never overwritten. A second run reports 0 to write.
 *
 * DRY RUN BY DEFAULT — prints counts per pattern only (no names, no addresses).
 *
 * Usage:
 *   npx tsx scripts/backfill-access-patterns.ts            # dry run
 *   npx tsx scripts/backfill-access-patterns.ts --apply    # write
 *
 * Credentials: uses AWS_* env vars if set, else the default CLI profile.
 * Refuses to run against any account other than 911911532459.
 */
import { execSync } from 'node:child_process'
import { ENTRIES } from '../packages/app/provider/dynamodb/access-patterns'

const EXPECTED_ACCOUNT = '911911532459'
const TABLE = 'tee-admin'

type Item = Record<string, any> & { pkey: string; skey: string }

export interface PlannedWrite {
  pattern: string
  key: { pkey: string; skey: string }
  set: Record<string, string>
}

export interface BackfillPlan {
  writes: PlannedWrite[]
  counts: Record<string, { candidates: number; alreadySet: number; toWrite: number; conflicts: number }>
}

/** Which entries an existing item should carry, by its keys. */
function desiredEntries(item: Item): Array<{ pattern: string; attrs: Record<string, string> }> {
  const { pkey, skey } = item
  if (pkey.startsWith('POST#') && skey.startsWith('POST#') && typeof item.gsi2sk === 'string') {
    const out = [{ pattern: 'postsAll', attrs: ENTRIES.post({ sortKey: item.gsi2sk }) }]
    if (item.seriesId) {
      const both = ENTRIES.post({ seriesId: item.seriesId, sortKey: item.gsi2sk })
      out.push({ pattern: 'postsBySeries', attrs: { gsi3pk: both.gsi3pk!, gsi3sk: both.gsi3sk! } })
    }
    return out
  }
  if (pkey.startsWith('MEETING#') && skey === 'DETAILS') {
    return [{ pattern: 'meetingsAll', attrs: ENTRIES.meeting({ nextOccurrence: item.nextOccurrence }) }]
  }
  if (pkey.startsWith('ORGANIZATION#') && item.name && item.country) {
    return [{ pattern: 'organizationsAll', attrs: ENTRIES.organization(item as any) }]
  }
  if (pkey.startsWith('USER#') && skey.startsWith('EDIT_REQUEST#') && item.requesterEmail && item.requestId) {
    const all = ENTRIES.editRequest({
      approvalToken: item.approvalToken || '',
      requesterEmail: item.requesterEmail,
      createdAt: item.createdAt || '',
      requestId: item.requestId,
    })
    const out: Array<{ pattern: string; attrs: Record<string, string> }> = [
      { pattern: 'editRequestsByRequester', attrs: { gsi1pk: all.gsi1pk, gsi1sk: all.gsi1sk } },
    ]
    if (item.approvalToken) out.push({ pattern: 'editRequestByToken', attrs: { gsi4pk: all.gsi4pk, gsi4sk: all.gsi4sk } })
    return out
  }
  if (pkey.startsWith('USER#') && skey.startsWith('CONTACT_REQUEST#') && item.requesterEmail && item.requestId) {
    return [
      {
        pattern: 'contactRequestsByRequester',
        attrs: ENTRIES.contactRequest({
          requesterEmail: item.requesterEmail,
          createdAt: item.createdAt || '',
          requestId: item.requestId,
        }),
      },
    ]
  }
  if (pkey.startsWith('USER#') && skey === 'OAUTH#youtube') {
    return [{ pattern: 'youtubeOAuthAll', attrs: ENTRIES.youtubeOAuth({ pkey }) }]
  }
  return []
}

/** Pure: what to write. Exported for the unit test. */
export function planBackfill(items: Item[]): BackfillPlan {
  const counts: BackfillPlan['counts'] = {}
  const writes: PlannedWrite[] = []
  for (const item of items) {
    for (const { pattern, attrs } of desiredEntries(item)) {
      const c = (counts[pattern] ||= { candidates: 0, alreadySet: 0, toWrite: 0, conflicts: 0 })
      c.candidates++
      const entries = Object.entries(attrs)
      if (entries.some(([k, v]) => item[k] !== undefined && item[k] !== v)) {
        c.conflicts++
        continue
      }
      if (entries.every(([k, v]) => item[k] === v)) {
        c.alreadySet++
        continue
      }
      c.toWrite++
      writes.push({ pattern, key: { pkey: item.pkey, skey: item.skey }, set: attrs })
    }
  }
  return { writes, counts }
}

/** The UpdateItem input for one write: SET only these attributes, only if absent or equal. */
export function updateInput(write: PlannedWrite) {
  const names: Record<string, string> = {}
  const values: Record<string, string> = {}
  const sets: string[] = []
  const guards: string[] = ['attribute_exists(pkey)']
  Object.entries(write.set).forEach(([attr, value], i) => {
    names[`#a${i}`] = attr
    values[`:v${i}`] = value
    sets.push(`#a${i} = :v${i}`)
    guards.push(`(attribute_not_exists(#a${i}) OR #a${i} = :v${i})`)
  })
  return {
    TableName: TABLE,
    Key: write.key,
    UpdateExpression: `SET ${sets.join(', ')}`,
    ConditionExpression: guards.join(' AND '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }
}

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

async function main() {
  const apply = process.argv.includes('--apply')
  loadCredentials()

  // Imported after credentials are in the environment (config.ts reads them at load).
  const { ScanCommand, UpdateCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient } = await import('../packages/app/provider/dynamodb/config')

  // A script may Scan; request paths may not.
  const items: Item[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const page = await docClient.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }))
    items.push(...((page.Items || []) as Item[]))
    lastKey = page.LastEvaluatedKey
  } while (lastKey)

  const plan = planBackfill(items)
  console.log(`\n=== Access-pattern backfill (${apply ? 'APPLY' : 'DRY RUN'}) — ${items.length} items read ===\n`)
  for (const [pattern, c] of Object.entries(plan.counts).sort()) {
    console.log(
      `${pattern.padEnd(28)} candidates ${String(c.candidates).padStart(4)}  already set ${String(c.alreadySet).padStart(4)}  ` +
        `to write ${String(c.toWrite).padStart(4)}  conflicts (skipped) ${c.conflicts}`
    )
  }
  if (Object.keys(plan.counts).length === 0) console.log('(no candidate items)')

  if (!apply) {
    console.log(`\nDRY RUN — nothing written. ${plan.writes.length} updates would be made. Re-run with --apply.\n`)
    return
  }

  let written = 0
  let refused = 0
  for (const write of plan.writes) {
    try {
      await docClient.send(new UpdateCommand(updateInput(write)))
      written++
    } catch (error: any) {
      if (error?.name !== 'ConditionalCheckFailedException') throw error
      refused++
    }
  }
  console.log(`\nWrote ${written} updates; ${refused} refused by their condition (changed since the read).\n`)
}

if (/backfill-access-patterns\.ts$/.test(process.argv[1] || '')) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
