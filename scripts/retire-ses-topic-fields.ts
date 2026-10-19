#!/usr/bin/env tsx
/**
 * Remove the retired SES topic NAMES from DynamoDB (R5). OWNER-RUN. Dry run
 * by default.
 *
 *  - `sesTopicPreferences` on every PERSON# / EMAIL# item (nothing reads or
 *    writes it since R5; subscriptions are SUB# rows keyed by listId).
 *  - `sesTopic` on every LIST# / DETAILS item — ONLY once the SES safety net
 *    is on (scripts/ses-safety-net-topics.ts); before that, sends still read
 *    it, so those are left alone and the script says so.
 *
 * Writes nothing else and never touches SES. Each removal is a conditional
 * REMOVE (attribute_exists), so a re-run is a no-op.
 *
 * --apply first backs up every affected item, verified, to
 *   s3://tee-admin-backups/backups/<date>-retire-ses-topic-fields/
 * Prints counts only.
 *
 * Usage (repo root):
 *   npx tsx scripts/retire-ses-topic-fields.ts            # dry run
 *   npx tsx scripts/retire-ses-topic-fields.ts --apply    # back up, then remove
 */

import { backupJsonToS3, loadCredentials } from '../apps/next/utils/mailing-lists/script-env'
import { planTopicFieldRetirement } from '../apps/next/utils/mailing-lists/retire-topic-fields'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  loadCredentials()

  const { ScanCommand, UpdateCommand } = await import('@aws-sdk/lib-dynamodb')
  const { docClient, tableNames } = await import('@my/app/provider/dynamodb/config')
  const { mailingListRepository } = await import(
    '@my/app/provider/dynamodb/repositories/mailing-list-repository'
  )

  console.log(`\n=== Retire SES topic fields (${apply ? 'APPLY' : 'DRY-RUN'}) ===\n`)

  const items: Record<string, any>[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: tableNames.admin,
        FilterExpression:
          '(begins_with(pkey, :person) AND begins_with(skey, :email) AND attribute_exists(sesTopicPreferences)) OR (begins_with(pkey, :list) AND skey = :details AND attribute_exists(sesTopic))',
        ExpressionAttributeValues: { ':person': 'PERSON#', ':email': 'EMAIL#', ':list': 'LIST#', ':details': 'DETAILS' },
        ExclusiveStartKey: lastKey,
      })
    )
    items.push(...(page.Items ?? []))
    lastKey = page.LastEvaluatedKey
  } while (lastKey)

  const { enabled } = await mailingListRepository.getSafetyNetSetting()
  const plan = planTopicFieldRetirement(items, enabled)
  const count = (a: string) => plan.removals.filter((r) => r.attribute === a).length
  console.log(
    JSON.stringify(
      {
        safetyNetEnabled: enabled,
        emailItemsWithSesTopicPreferences: count('sesTopicPreferences'),
        listItemsWithSesTopicToRemove: count('sesTopic'),
        ...(plan.listsSkippedReason ? { listsSkipped: plan.listsSkippedReason } : {}),
      },
      null,
      2
    )
  )

  if (plan.removals.length === 0) {
    console.log('\nNothing to remove.\n')
    return
  }
  if (!apply) {
    console.log('\nDRY RUN — nothing changed. Re-run with --apply to back up and remove.\n')
    return
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const key = `backups/${stamp}-retire-ses-topic-fields/items-${Date.now()}.json`
  const affected = new Set(plan.removals.map((r) => `${r.pkey}|${r.skey}`))
  backupJsonToS3(key, {
    table: tableNames.admin,
    takenAt: new Date().toISOString(),
    items: items.filter((i) => affected.has(`${i.pkey}|${i.skey}`)),
  })
  console.log(`Backed up ${affected.size} item(s) to s3://tee-admin-backups/${key}`)

  let removed = 0
  for (const r of plan.removals) {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: tableNames.admin,
          Key: { pkey: r.pkey, skey: r.skey },
          UpdateExpression: 'REMOVE #a',
          ConditionExpression: 'attribute_exists(#a)',
          ExpressionAttributeNames: { '#a': r.attribute },
        })
      )
      removed++
    } catch (error: any) {
      if (error?.name !== 'ConditionalCheckFailedException') throw error
    }
  }
  console.log(`\nRemoved ${removed} attribute(s). Re-run (dry) to confirm 0 remain.\n`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
