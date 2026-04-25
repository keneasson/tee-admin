/**
 * Fix Script: Update PersonRecords with auth fields from USER# records
 *
 * This handles the case where credentials users have auth fields in USER#
 * that weren't migrated to their PersonRecords.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_ADMIN_TABLE = 'tee-admin'

interface UserRecord {
  pkey: string
  skey: string
  email?: string
  role?: string
  provider?: string
  hashedPassword?: string
  emailVerified?: string
  firstName?: string
  lastName?: string
  name?: string
  ecclesia?: string
  gsi1pk?: string
}

async function getCredentialsUsers(): Promise<UserRecord[]> {
  console.log('📖 Scanning USER# records with credentials...')
  const users: UserRecord[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TEE_ADMIN_TABLE,
      FilterExpression: 'begins_with(pkey, :prefix) AND provider = :provider',
      ExpressionAttributeValues: {
        ':prefix': 'USER#',
        ':provider': 'credentials',
      },
      ExclusiveStartKey: lastKey,
    }))

    if (result.Items) {
      users.push(...(result.Items as UserRecord[]))
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  console.log(`   Found ${users.length} credentials users`)
  return users
}

async function getPersonByEmail(email: string): Promise<any | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: TEE_ADMIN_TABLE,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
    ExpressionAttributeValues: {
      ':pk': `EMAIL#${email.toLowerCase()}`,
      ':sk': 'PERSON',
    },
  }))
  return result.Items?.[0] || null
}

async function updatePersonAuthFields(personId: string, updates: Record<string, any>): Promise<void> {
  const updateExpressions: string[] = []
  const expressionAttributeNames: Record<string, string> = {}
  const expressionAttributeValues: Record<string, any> = {}

  let index = 0
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== null) {
      const nameKey = `#attr${index}`
      const valueKey = `:val${index}`
      updateExpressions.push(`${nameKey} = ${valueKey}`)
      expressionAttributeNames[nameKey] = key
      expressionAttributeValues[valueKey] = value
      index++
    }
  }

  if (updateExpressions.length === 0) return

  updateExpressions.push('#lastUpdated = :lastUpdated')
  expressionAttributeNames['#lastUpdated'] = 'lastUpdated'
  expressionAttributeValues[':lastUpdated'] = new Date().toISOString()

  await docClient.send(new UpdateCommand({
    TableName: TEE_ADMIN_TABLE,
    Key: { pkey: `PERSON#${personId}`, skey: 'PROFILE' },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }))
}

async function createPersonRecord(user: UserRecord): Promise<string> {
  const personId = uuidv4()
  const email = user.email || user.gsi1pk?.replace('USER#', '') || ''
  const nameParts = (user.name || '').split(' ')
  const firstName = user.firstName || nameParts[0] || ''
  const lastName = user.lastName || nameParts.slice(1).join(' ') || ''
  const displayName = `${firstName} ${lastName}`.trim()
  const now = new Date().toISOString()

  const record: Record<string, any> = {
    pkey: `PERSON#${personId}`,
    skey: 'PROFILE',
    gsi1pk: `EMAIL#${email.toLowerCase()}`,
    gsi1sk: 'PERSON',
    gsi2pk: `ECCLESIA#${user.ecclesia || 'Toronto East'}`,
    gsi2sk: `${lastName.toLowerCase()}#${firstName.toLowerCase()}#${personId}`,
    gsi3pk: `NAME#${lastName.toLowerCase()}`,
    gsi3sk: `${firstName.toLowerCase()}#${personId}`,
    personId,
    primaryEmail: email.toLowerCase(),
    firstName,
    lastName,
    displayName,
    ecclesia: user.ecclesia || 'Toronto East',
    memberStatus: 'member',
    role: user.role,
    provider: user.provider,
    hashedPassword: user.hashedPassword,
    emailVerified: user.emailVerified,
    createdAt: now,
    lastUpdated: now,
    version: 1,
  }

  await docClient.send(new PutCommand({
    TableName: TEE_ADMIN_TABLE,
    Item: record,
    ConditionExpression: 'attribute_not_exists(pkey)',
  }))

  // Also create email record
  const emailId = uuidv4()
  await docClient.send(new PutCommand({
    TableName: TEE_ADMIN_TABLE,
    Item: {
      pkey: `PERSON#${personId}`,
      skey: `EMAIL#${emailId}`,
      gsi1pk: `EMAIL#${email.toLowerCase()}`,
      gsi1sk: `PERSON#${personId}`,
      emailId,
      email: email.toLowerCase(),
      emailType: 'primary',
      order: 0,
      verified: !!user.emailVerified,
      sesSubscribed: false,
      sesStatus: 'active',
      lastUpdated: now,
      version: 1,
    },
  }))

  return personId
}

async function fix(): Promise<void> {
  console.log('🔧 Fixing PersonRecord auth fields')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}\n`)

  const credentialsUsers = await getCredentialsUsers()

  let updated = 0
  let created = 0
  let skipped = 0

  for (const user of credentialsUsers) {
    const email = user.email || user.gsi1pk?.replace('USER#', '') || ''
    if (!email || !email.includes('@')) {
      console.log(`   ⏭️  Skipping invalid email: ${email}`)
      skipped++
      continue
    }

    const cleanEmail = email.toLowerCase().trim()
    const person = await getPersonByEmail(cleanEmail)

    if (person) {
      // Update existing person with auth fields
      const updates: Record<string, any> = {}

      if (user.hashedPassword && !person.hashedPassword) {
        updates.hashedPassword = user.hashedPassword
      }
      if (user.emailVerified && !person.emailVerified) {
        updates.emailVerified = user.emailVerified
      }
      if (user.role && !person.role) {
        updates.role = user.role
      }
      if (user.provider && !person.provider) {
        updates.provider = user.provider
      }

      if (Object.keys(updates).length > 0) {
        if (DRY_RUN) {
          console.log(`   [DRY-RUN] Would update ${cleanEmail} with:`, Object.keys(updates).join(', '))
        } else {
          await updatePersonAuthFields(person.personId, updates)
          console.log(`   ✅ Updated ${cleanEmail} with: ${Object.keys(updates).join(', ')}`)
        }
        updated++
      } else {
        console.log(`   ⏭️  ${cleanEmail} already has auth fields`)
        skipped++
      }
    } else {
      // Create new person with auth fields
      if (DRY_RUN) {
        console.log(`   [DRY-RUN] Would create PERSON for ${cleanEmail}`)
      } else {
        try {
          await createPersonRecord(user)
          console.log(`   ✅ Created PERSON for ${cleanEmail}`)
        } catch (error: any) {
          if (error.name === 'ConditionalCheckFailedException') {
            console.log(`   ⏭️  ${cleanEmail} already exists (concurrent creation)`)
            skipped++
            continue
          }
          throw error
        }
      }
      created++
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary')
  console.log('='.repeat(50))
  console.log(`   Updated: ${updated}`)
  console.log(`   Created: ${created}`)
  console.log(`   Skipped: ${skipped}`)

  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN. No data was modified.')
    console.log('   Run with --execute to apply changes.')
  } else {
    console.log('\n✅ Fix complete!')
  }
}

fix().catch(console.error)
