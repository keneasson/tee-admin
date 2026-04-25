/**
 * Merge duplicate PersonRecords that were created by the migration
 * when it split concatenated emails into separate PERSON# records.
 *
 * For each group of duplicates (same displayName + ecclesia):
 * 1. Pick the "keeper" (prefer: has role > has auth data > first created)
 * 2. Add all secondary emails as EMAIL# items on the keeper
 * 3. Delete secondary PERSON# records and their child items
 *
 * Usage:
 *   npx tsx scripts/merge-duplicate-persons.ts           # dry run
 *   npx tsx scripts/merge-duplicate-persons.ts --apply    # apply changes
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../apps/next/.env') })

const TABLE = 'tee-admin'
const dryRun = !process.argv.includes('--apply')

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'ca-central-1' }),
  { marshallOptions: { removeUndefinedValues: true } }
)

interface PersonProfile {
  pkey: string
  skey: string
  personId: string
  primaryEmail: string
  displayName: string
  firstName: string
  lastName: string
  ecclesia: string
  role?: string
  hashedPassword?: string
  googleId?: string
  emailVerified?: string
  provider?: string
  createdAt?: string
  [key: string]: any
}

async function scanAllPersonProfiles(): Promise<PersonProfile[]> {
  const items: PersonProfile[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await client.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(pkey, :prefix) AND skey = :sk',
      ExpressionAttributeValues: { ':prefix': 'PERSON#', ':sk': 'PROFILE' },
      ExclusiveStartKey: lastKey,
    }))
    items.push(...(result.Items || []) as PersonProfile[])
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

async function getChildItems(personId: string): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await client.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pkey = :pk',
      ExpressionAttributeValues: { ':pk': `PERSON#${personId}` },
      ExclusiveStartKey: lastKey,
    }))
    items.push(...(result.Items || []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

function pickKeeper(records: PersonProfile[]): { keeper: PersonProfile; duplicates: PersonProfile[] } {
  // Priority: has role with highest privilege > has auth data > earliest created
  const rolePriority: Record<string, number> = { owner: 4, admin: 3, member: 2, guest: 1 }

  const sorted = [...records].sort((a, b) => {
    // Higher role wins
    const aRole = rolePriority[a.role || ''] || 0
    const bRole = rolePriority[b.role || ''] || 0
    if (aRole !== bRole) return bRole - aRole

    // Has auth data wins
    const aAuth = (a.hashedPassword || a.googleId || a.emailVerified) ? 1 : 0
    const bAuth = (b.hashedPassword || b.googleId || b.emailVerified) ? 1 : 0
    if (aAuth !== bAuth) return bAuth - aAuth

    // Earlier creation wins
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  return {
    keeper: sorted[0],
    duplicates: sorted.slice(1),
  }
}

async function emailExistsOnPerson(personId: string, email: string): Promise<boolean> {
  const children = await getChildItems(personId)
  return children.some(item =>
    item.skey?.startsWith('EMAIL#') && item.email?.toLowerCase() === email.toLowerCase()
  )
}

async function addEmailToPerson(personId: string, email: string, order: number): Promise<void> {
  const emailId = uuidv4()
  const record = {
    pkey: `PERSON#${personId}`,
    skey: `EMAIL#${emailId}`,
    gsi1pk: `EMAIL#${email.toLowerCase()}`,
    gsi1sk: `PERSON#${personId}`,
    emailId,
    email: email.toLowerCase(),
    emailType: 'secondary',
    order,
    verified: true,
    sesSubscribed: false,
    sesStatus: 'active',
    lastUpdated: new Date().toISOString(),
    version: 1,
  }

  if (dryRun) {
    console.log(`    [DRY RUN] Would add EMAIL#${emailId} → ${email} to PERSON#${personId}`)
    return
  }

  await client.send(new PutCommand({ TableName: TABLE, Item: record }))
  console.log(`    ✅ Added EMAIL#${emailId} → ${email}`)
}

async function deletePersonAndChildren(personId: string): Promise<number> {
  const children = await getChildItems(personId)

  if (dryRun) {
    console.log(`    [DRY RUN] Would delete ${children.length} items for PERSON#${personId}`)
    return children.length
  }

  for (const item of children) {
    await client.send(new DeleteCommand({
      TableName: TABLE,
      Key: { pkey: item.pkey, skey: item.skey },
    }))
  }
  console.log(`    ✅ Deleted ${children.length} items for PERSON#${personId}`)
  return children.length
}

async function main() {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  Merge Duplicate PersonRecords ${dryRun ? '(DRY RUN)' : '(APPLYING)'}`)
  console.log(`${'='.repeat(60)}\n`)

  const allPersons = await scanAllPersonProfiles()
  console.log(`Total PersonRecords: ${allPersons.length}\n`)

  // Group by displayName + ecclesia
  const groups = new Map<string, PersonProfile[]>()
  for (const person of allPersons) {
    const key = `${person.displayName}|${person.ecclesia}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(person)
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, records]) => records.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))

  if (duplicateGroups.length === 0) {
    console.log('No duplicates found!')
    return
  }

  console.log(`Found ${duplicateGroups.length} groups with duplicates:\n`)

  // Skip empty-name groups (might be different people)
  const emptyNameGroups: typeof duplicateGroups = []
  const mergeGroups: typeof duplicateGroups = []

  for (const group of duplicateGroups) {
    const [key] = group
    const name = key.split('|')[0]
    if (!name || !name.trim() || name === 'null' || name === 'undefined') {
      emptyNameGroups.push(group)
    } else {
      mergeGroups.push(group)
    }
  }

  if (emptyNameGroups.length > 0) {
    console.log('⚠️  SKIPPING empty-name groups (may be different people):')
    for (const [key, records] of emptyNameGroups) {
      const ecclesia = key.split('|')[1]
      console.log(`  "${ecclesia}": ${records.map(r => r.primaryEmail).join(', ')}`)
    }
    console.log()
  }

  let totalDeleted = 0
  let totalEmailsAdded = 0

  for (const [key, records] of mergeGroups) {
    const [name, ecclesia] = key.split('|')
    const { keeper, duplicates } = pickKeeper(records)

    console.log(`📋 ${name} (${ecclesia})`)
    console.log(`  Keeper: ${keeper.primaryEmail} (personId: ${keeper.personId}, role: ${keeper.role || 'none'})`)

    // Get existing emails on keeper
    const keeperChildren = await getChildItems(keeper.personId)
    const existingEmails = keeperChildren
      .filter(item => item.skey?.startsWith('EMAIL#'))
      .map(item => item.email?.toLowerCase())
    const nextOrder = existingEmails.length

    for (const dup of duplicates) {
      console.log(`  Merge: ${dup.primaryEmail} (personId: ${dup.personId}, role: ${dup.role || 'none'})`)

      // Add the duplicate's primary email to keeper if not already there
      if (!existingEmails.includes(dup.primaryEmail.toLowerCase())) {
        await addEmailToPerson(keeper.personId, dup.primaryEmail, nextOrder + totalEmailsAdded)
        totalEmailsAdded++
      } else {
        console.log(`    (email ${dup.primaryEmail} already on keeper)`)
      }

      // Also grab any EMAIL# items from the duplicate that the keeper doesn't have
      const dupChildren = await getChildItems(dup.personId)
      for (const child of dupChildren) {
        if (child.skey?.startsWith('EMAIL#') && child.email) {
          if (!existingEmails.includes(child.email.toLowerCase()) &&
              child.email.toLowerCase() !== dup.primaryEmail.toLowerCase()) {
            await addEmailToPerson(keeper.personId, child.email, nextOrder + totalEmailsAdded)
            totalEmailsAdded++
          }
        }
      }

      // Delete the duplicate and all its children
      const deleted = await deletePersonAndChildren(dup.personId)
      totalDeleted += deleted
    }
    console.log()
  }

  console.log(`${'='.repeat(60)}`)
  console.log(`Summary:`)
  console.log(`  Groups merged: ${mergeGroups.length}`)
  console.log(`  Emails added to keepers: ${totalEmailsAdded}`)
  console.log(`  Items deleted: ${totalDeleted}`)
  console.log(`  Skipped (empty name): ${emptyNameGroups.length}`)
  if (dryRun) {
    console.log(`\n  Run with --apply to execute changes.`)
  }
  console.log()
}

main().catch(console.error)
