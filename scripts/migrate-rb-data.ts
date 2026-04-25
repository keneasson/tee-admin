/**
 * Migration Script: Auto-link existing RB data
 *
 * Scans all EcclesiaData with recordingBrotherEmail, looks up the
 * corresponding PersonRecord, and:
 * 1. Sets isRecordingBrother: true on PersonRecord
 * 2. Sets recordingBrotherPersonId on EcclesiaData
 * 3. Sets rbEmailPreference: 'personal' (default assumption)
 * 4. If person's role was 'recorder', changes to 'member'
 *
 * Usage:
 *   npx tsx scripts/migrate-rb-data.ts           # Dry-run (default)
 *   npx tsx scripts/migrate-rb-data.ts --apply    # Apply changes
 */

import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'

const APPLY = process.argv.includes('--apply')

const client = DynamoDBDocument.from(
  new DynamoDB({
    region: process.env.AWS_REGION || 'us-east-1',
  }),
  {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
  }
)

const TABLE_NAME = 'tee-admin'

interface EcclesiaItem {
  pkey: string
  skey: string
  name: string
  recordingBrotherEmail?: string
  recordingBrotherName?: string
  recordingBrotherPersonId?: string
}

interface PersonItem {
  pkey: string
  skey: string
  personId: string
  primaryEmail: string
  ecclesia: string
  displayName: string
  isRecordingBrother?: boolean
  role?: string
}

async function main() {
  console.log(`\n🔄 RB Data Migration ${APPLY ? '(APPLYING)' : '(DRY RUN)'}`)
  console.log('='.repeat(60))

  // 1. Scan all ecclesia records with recordingBrotherEmail
  console.log('\n📋 Scanning ecclesia records...')
  const ecclesias = await scanEcclesias()
  const withRB = ecclesias.filter((e) => e.recordingBrotherEmail)
  console.log(`   Found ${ecclesias.length} ecclesias, ${withRB.length} with Recording Brother email`)

  let matched = 0
  let unmatched = 0
  let alreadyLinked = 0
  let roleChanged = 0

  for (const ecclesia of withRB) {
    const rbEmail = ecclesia.recordingBrotherEmail!.toLowerCase()
    console.log(`\n🔍 ${ecclesia.name}: ${rbEmail}`)

    // Already has personId link?
    if (ecclesia.recordingBrotherPersonId) {
      console.log(`   ✅ Already linked to person: ${ecclesia.recordingBrotherPersonId}`)
      alreadyLinked++
      continue
    }

    // 2. Look up PersonRecord by email (GSI1)
    const person = await findPersonByEmail(rbEmail)
    if (!person) {
      console.log(`   ⚠️  No PersonRecord found for email: ${rbEmail}`)
      unmatched++
      continue
    }

    // 3. Check ecclesia match
    if (person.ecclesia !== ecclesia.name) {
      console.log(`   ⚠️  Ecclesia mismatch: person.ecclesia="${person.ecclesia}" vs "${ecclesia.name}"`)
      unmatched++
      continue
    }

    console.log(`   ✅ Matched: ${person.displayName} (${person.personId})`)
    matched++

    // 4. Apply changes
    if (APPLY) {
      // Set isRecordingBrother on PersonRecord
      if (!person.isRecordingBrother) {
        await client.update({
          TableName: TABLE_NAME,
          Key: { pkey: person.pkey, skey: person.skey },
          UpdateExpression: 'SET isRecordingBrother = :rb, rbEmailPreference = :pref',
          ExpressionAttributeValues: {
            ':rb': true,
            ':pref': 'personal',
          },
        })
        console.log(`   📝 Set isRecordingBrother = true, rbEmailPreference = 'personal'`)
      }

      // Set recordingBrotherPersonId on EcclesiaData
      await client.update({
        TableName: TABLE_NAME,
        Key: { pkey: ecclesia.pkey, skey: ecclesia.skey },
        UpdateExpression: 'SET recordingBrotherPersonId = :pid',
        ExpressionAttributeValues: {
          ':pid': person.personId,
        },
      })
      console.log(`   📝 Set recordingBrotherPersonId = ${person.personId}`)

      // If role was 'recorder', change to 'member'
      if (person.role === 'recorder') {
        await client.update({
          TableName: TABLE_NAME,
          Key: { pkey: person.pkey, skey: person.skey },
          UpdateExpression: 'SET #role = :newRole',
          ExpressionAttributeValues: { ':newRole': 'member' },
          ExpressionAttributeNames: { '#role': 'role' },
        })
        console.log(`   📝 Changed role: recorder → member`)
        roleChanged++
      }
    } else {
      console.log(`   [DRY RUN] Would set isRecordingBrother = true`)
      console.log(`   [DRY RUN] Would set recordingBrotherPersonId = ${person.personId}`)
      if (person.role === 'recorder') {
        console.log(`   [DRY RUN] Would change role: recorder → member`)
        roleChanged++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`📊 Summary:`)
  console.log(`   Total ecclesias with RB: ${withRB.length}`)
  console.log(`   Already linked: ${alreadyLinked}`)
  console.log(`   Matched & ${APPLY ? 'updated' : 'would update'}: ${matched}`)
  console.log(`   Unmatched (manual review needed): ${unmatched}`)
  console.log(`   Role changes (recorder → member): ${roleChanged}`)
  if (!APPLY) {
    console.log(`\n   ℹ️  Run with --apply to execute changes`)
  }
  console.log()
}

async function scanEcclesias(): Promise<EcclesiaItem[]> {
  const items: EcclesiaItem[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await client.scan({
      TableName: TABLE_NAME,
      FilterExpression: '#type = :ecclesiaType',
      ExpressionAttributeValues: { ':ecclesiaType': 'ECCLESIA' },
      ExpressionAttributeNames: { '#type': 'type' },
      ExclusiveStartKey: lastKey,
    })

    if (result.Items) {
      items.push(...(result.Items as EcclesiaItem[]))
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

async function findPersonByEmail(email: string): Promise<PersonItem | null> {
  const result = await client.query({
    TableName: TABLE_NAME,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
    ExpressionAttributeValues: {
      ':pk': `EMAIL#${email}`,
      ':sk': 'PERSON',
    },
    Limit: 1,
  })

  if (!result.Items || result.Items.length === 0) return null

  // The GSI item has the person's pkey — fetch the full PROFILE record
  const gsiItem = result.Items[0]
  const personPkey = gsiItem.pkey as string

  const profileResult = await client.get({
    TableName: TABLE_NAME,
    Key: { pkey: personPkey, skey: 'PROFILE' },
  })

  return (profileResult.Item as PersonItem) || null
}

main().catch((error) => {
  console.error('❌ Migration failed:', error)
  process.exit(1)
})
