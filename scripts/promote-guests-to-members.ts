/**
 * One-time script: Promote all current guest PersonRecords to member role.
 *
 * All existing people were manually added by the admin and should be members.
 * After this script, new sign-ups will correctly start as guests.
 *
 * Usage:
 *   npx tsx scripts/promote-guests-to-members.ts          # Dry run
 *   npx tsx scripts/promote-guests-to-members.ts --execute # Actually update
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_ADMIN_TABLE = 'tee-admin'

interface PersonProfile {
  pkey: string // PERSON#{personId}
  skey: string // PROFILE
  primaryEmail: string
  displayName?: string
  role?: string
  ecclesia?: string
}

async function getGuestPersons(): Promise<PersonProfile[]> {
  console.log('📖 Scanning for guest PersonRecords...')
  const guests: PersonProfile[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TEE_ADMIN_TABLE,
      FilterExpression: 'begins_with(pkey, :prefix) AND skey = :profile AND (#role = :guest OR attribute_not_exists(#role))',
      ExpressionAttributeNames: {
        '#role': 'role',
      },
      ExpressionAttributeValues: {
        ':prefix': 'PERSON#',
        ':profile': 'PROFILE',
        ':guest': 'guest',
      },
      ExclusiveStartKey: lastKey,
    }))

    if (result.Items) {
      guests.push(...(result.Items as PersonProfile[]))
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return guests
}

async function promoteToMember(person: PersonProfile): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: TEE_ADMIN_TABLE,
    Key: { pkey: person.pkey, skey: person.skey },
    UpdateExpression: 'SET #role = :member',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':member': 'member' },
  }))
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN MODE (use --execute to apply changes)\n' : '🚀 EXECUTE MODE\n')

  const guests = await getGuestPersons()
  console.log(`\nFound ${guests.length} guest PersonRecords:\n`)

  for (const person of guests) {
    const personId = person.pkey.replace('PERSON#', '')
    const name = person.displayName || person.primaryEmail || personId
    const ecclesia = person.ecclesia || '(none)'
    const currentRole = person.role || '(undefined)'

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would promote: ${name} (${person.primaryEmail}) | ecclesia: ${ecclesia} | role: ${currentRole} → member`)
    } else {
      await promoteToMember(person)
      console.log(`  ✅ Promoted: ${name} (${person.primaryEmail}) | ecclesia: ${ecclesia} | role: ${currentRole} → member`)
    }
  }

  console.log(`\n${DRY_RUN ? '🔍 Dry run complete.' : '✅ Done.'} ${guests.length} guests ${DRY_RUN ? 'would be' : 'were'} promoted to member.`)
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
