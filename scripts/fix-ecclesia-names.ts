/**
 * Fix inconsistent ecclesia names in PersonRecords.
 * Consolidates "TEE" and "Toronto East" → "Toronto East Ecclesia"
 * Also updates GSI2 keys (ECCLESIA# prefix).
 *
 * Usage: npx tsx scripts/fix-ecclesia-names.ts
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../apps/next/.env') })

const TABLE = 'tee-admin'
const TARGET = 'Toronto East Ecclesia'
const WRONG = ['TEE', 'Toronto East']

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ca-central-1' }),
  { marshallOptions: { removeUndefinedValues: true } }
)

async function main() {
  const toFix: any[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await client.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(pkey, :prefix) AND skey = :sk AND (ecclesia = :e1 OR ecclesia = :e2)',
      ExpressionAttributeValues: { ':prefix': 'PERSON#', ':sk': 'PROFILE', ':e1': WRONG[0], ':e2': WRONG[1] },
      ExclusiveStartKey: lastKey,
    }))
    toFix.push(...(result.Items || []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  console.log(`Found ${toFix.length} records to update\n`)

  for (const person of toFix) {
    const personId = person.personId
    const firstName = person.firstName || ''
    const lastName = person.lastName || ''

    await client.send(new UpdateCommand({
      TableName: TABLE,
      Key: { pkey: person.pkey, skey: person.skey },
      UpdateExpression: 'SET ecclesia = :ecc, gsi2pk = :g2pk, gsi2sk = :g2sk, lastUpdated = :now',
      ExpressionAttributeValues: {
        ':ecc': TARGET,
        ':g2pk': `ECCLESIA#${TARGET}`,
        ':g2sk': `${lastName.toLowerCase()}#${firstName.toLowerCase()}#${personId}`,
        ':now': new Date().toISOString(),
      },
    }))
    console.log(`  ✅ ${person.displayName || person.primaryEmail}: "${person.ecclesia}" → "${TARGET}"`)
  }

  console.log(`\nDone. Updated ${toFix.length} records.`)
}

main().catch(console.error)
