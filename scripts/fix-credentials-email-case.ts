/**
 * Fix Credentials User Email Case Sensitivity
 *
 * This script fixes existing credential users who have non-normalized (mixed-case) emails
 * in their GSI1 keys. DynamoDB GSI lookups are case-sensitive, so users with mixed-case
 * emails stored in GSI1 cannot sign in if they type their email in a different case.
 *
 * What this script does:
 * 1. Scans for all USER# records with provider='credentials'
 * 2. For each user, checks if GSI1 email is lowercase
 * 3. If not, creates a new record with lowercase GSI1 and deletes the old one
 *
 * Usage:
 *   npx ts-node scripts/fix-credentials-email-case.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be fixed without making changes
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb'

const TABLE_NAME = 'tee-admin'
const REGION = process.env.AWS_REGION || 'ca-central-1'

// AWS config - uses default credential chain (env vars, ~/.aws/credentials, IAM role)
const dbClient = new DynamoDBClient({ region: REGION })
const client = DynamoDBDocumentClient.from(dbClient)

interface CredentialsUser {
  pkey: string
  skey: string
  gsi1pk: string
  gsi1sk: string
  email: string
  id: string
  provider: string
  [key: string]: any
}

async function findAllCredentialsUsers(): Promise<CredentialsUser[]> {
  const users: CredentialsUser[] = []
  let lastEvaluatedKey: Record<string, any> | undefined

  do {
    const result = await client.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#type = :userType AND provider = :provider',
      ExpressionAttributeNames: {
        '#type': 'type',
      },
      ExpressionAttributeValues: {
        ':userType': 'USER',
        ':provider': 'credentials',
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }))

    if (result.Items) {
      users.push(...(result.Items as CredentialsUser[]))
    }
    lastEvaluatedKey = result.LastEvaluatedKey
  } while (lastEvaluatedKey)

  return users
}

async function fixUserEmailCase(user: CredentialsUser, dryRun: boolean): Promise<boolean> {
  const currentEmail = user.email
  const normalizedEmail = currentEmail.toLowerCase().trim()
  const currentGsi1pk = user.gsi1pk

  // Check if GSI1 already uses normalized email
  const expectedGsi1pk = `USER#${normalizedEmail}`
  if (currentGsi1pk === expectedGsi1pk) {
    return false // Already normalized
  }

  console.log(`\n📧 User: ${user.id}`)
  console.log(`   Current email: ${currentEmail}`)
  console.log(`   Normalized email: ${normalizedEmail}`)
  console.log(`   Current GSI1PK: ${currentGsi1pk}`)
  console.log(`   Expected GSI1PK: ${expectedGsi1pk}`)

  if (dryRun) {
    console.log(`   [DRY RUN] Would update GSI1 keys and email`)
    return true
  }

  try {
    // Update the record with normalized email and GSI1 keys
    // We need to delete and recreate because GSI keys can't be updated in place
    const updatedItem = {
      ...user,
      email: normalizedEmail,
      gsi1pk: expectedGsi1pk,
      gsi1sk: expectedGsi1pk,
    }

    // Put the updated record (overwrites existing since pkey/skey are the same)
    await client.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedItem,
    }))

    console.log(`   ✅ Fixed: Updated email and GSI1 keys`)
    return true
  } catch (error) {
    console.error(`   ❌ Error fixing user ${user.id}:`, error)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('='.repeat(60))
  console.log('Fix Credentials User Email Case Sensitivity')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will make changes)'}`)
  console.log('')

  console.log('Scanning for credentials users...')
  const users = await findAllCredentialsUsers()
  console.log(`Found ${users.length} credentials users`)

  let fixedCount = 0
  let alreadyNormalizedCount = 0

  for (const user of users) {
    const wasFixed = await fixUserEmailCase(user, dryRun)
    if (wasFixed) {
      fixedCount++
    } else {
      alreadyNormalizedCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('Summary:')
  console.log(`  Total users scanned: ${users.length}`)
  console.log(`  Already normalized: ${alreadyNormalizedCount}`)
  console.log(`  ${dryRun ? 'Would be fixed' : 'Fixed'}: ${fixedCount}`)
  console.log('='.repeat(60))

  if (dryRun && fixedCount > 0) {
    console.log('\nRun without --dry-run to apply these fixes.')
  }
}

main().catch(console.error)
