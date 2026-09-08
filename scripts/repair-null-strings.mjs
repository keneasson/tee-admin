#!/usr/bin/env node
/**
 * Repair records corrupted by `convertEmptyValues: true`.
 *
 * That legacy AWS SDK v2 setting rewrote every empty string to a DynamoDB NULL
 * on write, across every repository sharing the client. It has already produced
 * two production defects (the doc-editor `body: null` crash, #214; and an
 * ecclesia whose NULL province/city made its key unlistable), and a live scan
 * found NULL `firstName`/`lastName`/`displayName` on real PersonRecords — the
 * always-shown PII floor.
 *
 * The setting is now off, so no NEW corruption occurs. This repairs what is
 * already stored: every top-level NULL attribute becomes an empty string, which
 * is what was actually saved.
 *
 * DRY RUN BY DEFAULT. Pass --apply to write.
 *
 *   node scripts/repair-null-strings.mjs            # report only
 *   node scripts/repair-null-strings.mjs --apply    # repair
 *
 * Only touches attributes that are exactly `{ NULL: true }`, only at the top
 * level of an item, and never touches key attributes (pkey/skey/gsi*) — a NULL
 * there means the record is malformed in a way that needs a human decision, not
 * a rewrite that could collide with an existing key.
 */
import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb'

const TABLE = process.env.TEE_TABLE || 'tee-admin'
const REGION = process.env.AWS_REGION || 'ca-central-1'
const APPLY = process.argv.includes('--apply')

const KEY_ATTRS = new Set(['pkey', 'skey', 'gsi1pk', 'gsi1sk', 'gsi2pk', 'gsi2sk'])

const client = new DynamoDBClient({ region: REGION })

async function* scanAll() {
  let ExclusiveStartKey
  do {
    const res = await client.send(
      new ScanCommand({ TableName: TABLE, ExclusiveStartKey, Limit: 200 })
    )
    for (const item of res.Items ?? []) yield item
    ExclusiveStartKey = res.LastEvaluatedKey
  } while (ExclusiveStartKey)
}

const isNull = (v) => v && typeof v === 'object' && v.NULL === true && Object.keys(v).length === 1

let scanned = 0
let itemsWithNulls = 0
let attrsRepaired = 0
let skippedKeyNulls = 0
const byPrefix = new Map()

for await (const item of scanAll()) {
  scanned++
  const bad = Object.entries(item)
    .filter(([k, v]) => isNull(v))
    .map(([k]) => k)

  if (bad.length === 0) continue

  const keyNulls = bad.filter((k) => KEY_ATTRS.has(k))
  const fixable = bad.filter((k) => !KEY_ATTRS.has(k))

  if (keyNulls.length > 0) {
    skippedKeyNulls++
    console.warn(
      `  ! ${item.pkey?.S} / ${item.skey?.S} — NULL in KEY attribute(s) ${keyNulls.join(', ')}; needs a human decision, skipped`
    )
  }
  if (fixable.length === 0) continue

  itemsWithNulls++
  const prefix = (item.pkey?.S ?? '?').split('#')[0]
  byPrefix.set(prefix, (byPrefix.get(prefix) ?? 0) + fixable.length)
  attrsRepaired += fixable.length

  console.log(`  ${APPLY ? 'FIX ' : 'would fix'} ${item.pkey?.S} / ${item.skey?.S} → ${fixable.join(', ')}`)

  if (APPLY) {
    const names = {}
    const values = {}
    const sets = fixable.map((attr, i) => {
      names[`#a${i}`] = attr
      values[`:e${i}`] = { S: '' }
      return `#a${i} = :e${i}`
    })
    await client.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: { pkey: item.pkey, skey: item.skey },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      })
    )
  }
}

console.log('\n--- summary ---')
console.log(`table            ${TABLE} (${REGION})`)
console.log(`mode             ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`)
console.log(`records scanned  ${scanned}`)
console.log(`records affected ${itemsWithNulls}`)
console.log(`attrs ${APPLY ? 'repaired' : 'repairable'}   ${attrsRepaired}`)
if (skippedKeyNulls) console.log(`skipped (key NULL) ${skippedKeyNulls}`)
for (const [p, n] of [...byPrefix].sort((a, b) => b[1] - a[1])) console.log(`  ${p.padEnd(18)} ${n}`)
if (!APPLY) console.log('\nRe-run with --apply to write these changes.')
