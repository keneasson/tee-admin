/**
 * Migration Script: Unified People System
 *
 * Migrates from email-based identity to UUID-based PERSON# records
 *
 * Sources:
 * - DIRECTORY#MEMBERS from tee-schedules (member names, ecclesia)
 * - USER# records from tee-admin (auth, roles)
 * - Existing ADDRESS#, PHONE#, EMAIL# records from tee-admin
 *
 * Target:
 * - PERSON#{personId} records in tee-admin with UUID identity
 *
 * Usage:
 *   npx ts-node scripts/migrate-to-unified-people.ts --dry-run
 *   npx ts-node scripts/migrate-to-unified-people.ts --execute
 */

import { DynamoDBClient, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

// Configuration
const REGION = process.env.AWS_REGION || 'ca-central-1'
const DRY_RUN = !process.argv.includes('--execute')

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_ADMIN_TABLE = 'tee-admin'
const TEE_SCHEDULES_TABLE = 'tee-schedules'

// Types
interface DirectoryMember {
  PK: string
  SK: string
  email: string
  firstName: string
  lastName: string
  ecclesia?: string
  contactInfo?: {
    phone?: string
    address?: string
  }
}

interface UserRecord {
  pkey: string
  skey: string
  email?: string
  role?: string
  provider?: string
  id?: string
  // Auth fields
  hashedPassword?: string
  emailVerified?: Date | string | number
  firstName?: string
  lastName?: string
  name?: string
  ecclesia?: string
  image?: string
  googleId?: string
}

interface MigrationPerson {
  personId: string
  email: string
  firstName: string
  lastName: string
  ecclesia: string
  memberStatus: 'member' | 'visitor' | 'friend' | 'former'
  role?: string
  provider?: string
  userId?: string
  phones: Array<{ number: string; type: string }>
  addresses: Array<{ street: string; city?: string }>
  // Auth fields
  hashedPassword?: string
  emailVerified?: string
  googleId?: string
  image?: string
}

// Stats
const stats = {
  directoryMembersRead: 0,
  usersRead: 0,
  personsCreated: 0,
  emailsCreated: 0,
  phonesCreated: 0,
  addressesCreated: 0,
  errors: [] as string[],
}

async function scanDirectoryMembers(): Promise<DirectoryMember[]> {
  console.log('📖 Scanning DIRECTORY#MEMBERS from tee-schedules...')
  const members: DirectoryMember[] = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new QueryCommand({
      TableName: TEE_SCHEDULES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': 'DIRECTORY#MEMBERS' },
      ExclusiveStartKey: lastKey,
    }))

    if (result.Items) {
      members.push(...(result.Items as DirectoryMember[]))
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  stats.directoryMembersRead = members.length
  console.log(`   Found ${members.length} directory members`)
  return members
}

async function scanUserRecords(): Promise<UserRecord[]> {
  console.log('📖 Scanning USER# records from tee-admin...')
  const users: UserRecord[] = []
  const seenEmails = new Set<string>()
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TEE_ADMIN_TABLE,
      FilterExpression: 'begins_with(pkey, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'USER#',
      },
      ExclusiveStartKey: lastKey,
    }))

    if (result.Items) {
      for (const item of result.Items) {
        const user = item as UserRecord
        // Extract email from pkey if it looks like an email
        const pkeyValue = user.pkey?.replace('USER#', '')
        // Clean the email (remove newlines and whitespace)
        const cleanedEmail = pkeyValue?.replace(/[\r\n\s]+/g, '').toLowerCase()
        if (cleanedEmail?.includes('@') && !seenEmails.has(cleanedEmail)) {
          seenEmails.add(cleanedEmail)
          users.push({
            ...user,
            email: cleanedEmail,
          })
        }
      }
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  stats.usersRead = users.length
  console.log(`   Found ${users.length} unique user records`)
  return users
}

async function getExistingPhones(email: string): Promise<Array<{ phoneId: string; number: string; type: string; isPrimary: boolean }>> {
  const result = await docClient.send(new QueryCommand({
    TableName: TEE_ADMIN_TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${email}`,
      ':skPrefix': 'PHONE#',
    },
  }))
  return (result.Items || []) as any[]
}

async function getExistingAddresses(email: string): Promise<Array<{ addressId: string; street1: string; city: string; type: string }>> {
  const result = await docClient.send(new QueryCommand({
    TableName: TEE_ADMIN_TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${email}`,
      ':skPrefix': 'ADDRESS#',
    },
  }))
  return (result.Items || []) as any[]
}

async function getExistingEmails(email: string): Promise<Array<{ emailId: string; email: string; verified: boolean }>> {
  const result = await docClient.send(new QueryCommand({
    TableName: TEE_ADMIN_TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${email}`,
      ':skPrefix': 'EMAIL#',
    },
  }))
  return (result.Items || []) as any[]
}

function cleanEmail(email: string): string {
  // First strip all newlines and extra whitespace
  const cleaned = email.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  // Handle multiple emails in one field - take the first one
  const emails = cleaned.split(/[\s;,]+/).filter(e => e.includes('@'))
  const firstEmail = emails[0] || cleaned
  return firstEmail.trim().toLowerCase()
}

function cleanName(name: string): string {
  // Remove newlines, carriage returns, and extra whitespace
  return name
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function checkExistingPerson(email: string): Promise<boolean> {
  // Check if a PersonRecord already exists for this email via GSI1
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TEE_ADMIN_TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `EMAIL#${email}`,
        ':sk': 'PERSON',
      },
    }))
    return (result.Items && result.Items.length > 0)
  } catch {
    return false
  }
}

async function createPersonRecord(person: MigrationPerson): Promise<boolean> {
  // Pre-check if person already exists (optimization to avoid unnecessary writes)
  const exists = await checkExistingPerson(person.email)
  if (exists) {
    console.log(`   ⏭️  Skipping ${person.email} - PersonRecord already exists`)
    return false
  }

  const now = new Date().toISOString()
  const displayName = `${person.firstName} ${person.lastName}`.trim()

  const record: Record<string, any> = {
    pkey: `PERSON#${person.personId}`,
    skey: 'PROFILE',
    gsi1pk: `EMAIL#${person.email}`,
    gsi1sk: 'PERSON',
    gsi2pk: `ECCLESIA#${person.ecclesia}`,
    gsi2sk: `${person.lastName.toLowerCase()}#${person.firstName.toLowerCase()}#${person.personId}`,
    gsi3pk: `NAME#${person.lastName.toLowerCase()}`,
    gsi3sk: `${person.firstName.toLowerCase()}#${person.personId}`,
    personId: person.personId,
    primaryEmail: person.email,
    firstName: person.firstName,
    lastName: person.lastName,
    displayName,
    ecclesia: person.ecclesia,
    memberStatus: person.memberStatus,
    role: person.role,
    provider: person.provider,
    userId: person.userId,
    createdAt: now,
    lastUpdated: now,
    version: 1,
  }

  // Add auth fields if present
  if (person.hashedPassword) {
    record.hashedPassword = person.hashedPassword
  }
  if (person.emailVerified) {
    record.emailVerified = person.emailVerified
  }
  if (person.googleId) {
    record.googleId = person.googleId
  }
  if (person.image) {
    record.image = person.image
  }

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would create PERSON: ${displayName} (${person.email})`)
    stats.personsCreated++
    return true
  }

  try {
    // Use conditional write to prevent duplicate entries if two migration runs overlap
    // This is an atomic operation that fails if the record already exists
    await docClient.send(new PutCommand({
      TableName: TEE_ADMIN_TABLE,
      Item: record,
      // Prevent overwriting existing records (race condition protection)
      ConditionExpression: 'attribute_not_exists(pkey)',
    }))
    console.log(`   ✅ Created PERSON: ${displayName} (${person.email})`)
    stats.personsCreated++
    return true
  } catch (error) {
    if (error instanceof ConditionalCheckFailedException) {
      // Another process created this record - this is fine, not an error
      console.log(`   ⏭️  Skipping ${person.email} - PersonRecord was created by concurrent process`)
      return false
    }
    throw error
  }
}

async function createPersonEmailRecord(personId: string, email: string, emailType: 'primary' | 'secondary', order: number, verified: boolean): Promise<void> {
  const emailId = uuidv4()
  const now = new Date().toISOString()

  const record = {
    pkey: `PERSON#${personId}`,
    skey: `EMAIL#${emailId}`,
    gsi1pk: `EMAIL#${email}`,
    gsi1sk: `PERSON#${personId}`,
    emailId,
    email,
    emailType,
    order,
    verified,
    sesSubscribed: false,
    sesStatus: 'active',
    lastUpdated: now,
    version: 1,
  }

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would create EMAIL: ${email} for PERSON#${personId}`)
  } else {
    await docClient.send(new PutCommand({
      TableName: TEE_ADMIN_TABLE,
      Item: record,
    }))
  }
  stats.emailsCreated++
}

async function createPersonPhoneRecord(personId: string, phone: { number: string; type: string; isPrimary: boolean }, order: number): Promise<void> {
  const phoneId = uuidv4()
  const now = new Date().toISOString()

  const record = {
    pkey: `PERSON#${personId}`,
    skey: `PHONE#${phoneId}`,
    phoneId,
    type: phone.type || 'mobile',
    number: phone.number,
    isPrimary: phone.isPrimary,
    isHousehold: false,
    order,
    lastUpdated: now,
    version: 1,
  }

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would create PHONE: ${phone.number} for PERSON#${personId}`)
  } else {
    await docClient.send(new PutCommand({
      TableName: TEE_ADMIN_TABLE,
      Item: record,
    }))
  }
  stats.phonesCreated++
}

async function createPersonAddressRecord(personId: string, address: any, isPrimary: boolean): Promise<void> {
  const addressId = uuidv4()
  const now = new Date().toISOString()

  const record = {
    pkey: `PERSON#${personId}`,
    skey: `ADDRESS#${addressId}`,
    addressId,
    type: address.type || 'home',
    street1: address.street1 || address.street || '',
    street2: address.street2 || '',
    city: address.city || '',
    province: address.province || 'ON',
    postalCode: address.postalCode || '',
    country: address.country || 'Canada',
    isPrimary,
    isHousehold: address.isHousehold || false,
    lastUpdated: now,
    version: 1,
  }

  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would create ADDRESS for PERSON#${personId}`)
  } else {
    await docClient.send(new PutCommand({
      TableName: TEE_ADMIN_TABLE,
      Item: record,
    }))
  }
  stats.addressesCreated++
}

async function linkUserToPersonId(userPkey: string, personId: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would link ${userPkey} to personId: ${personId}`)
    return
  }

  await docClient.send(new UpdateCommand({
    TableName: TEE_ADMIN_TABLE,
    Key: { pkey: userPkey, skey: 'PROFILE' },
    UpdateExpression: 'SET personId = :personId, lastUpdated = :now',
    ExpressionAttributeValues: {
      ':personId': personId,
      ':now': new Date().toISOString(),
    },
  }))
}

async function migrate(): Promise<void> {
  console.log('🚀 Starting Unified People System Migration')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}`)
  console.log('')

  // Step 1: Read all sources
  const directoryMembers = await scanDirectoryMembers()
  const users = await scanUserRecords()

  // Step 2: Build unified person map (email -> PersonData)
  console.log('\n📊 Building unified person map...')
  const personMap = new Map<string, MigrationPerson>()

  // 2a. Start with directory members
  for (const member of directoryMembers) {
    if (!member.email) continue

    const email = cleanEmail(member.email)
    if (!email || email.includes('%0A') || email.includes('\n')) {
      stats.errors.push(`Skipping invalid email: ${member.email}`)
      continue
    }

    const firstName = cleanName(member.firstName || '')
    const lastName = cleanName(member.lastName || '')

    personMap.set(email, {
      personId: uuidv4(),
      email,
      firstName,
      lastName,
      ecclesia: member.ecclesia || 'Toronto East',
      memberStatus: 'member',
      phones: member.contactInfo?.phone ? [{ number: member.contactInfo.phone, type: 'mobile' }] : [],
      addresses: member.contactInfo?.address ? [{ street: member.contactInfo.address }] : [],
    })
  }

  // 2b. Link existing users
  for (const user of users) {
    const email = user.email?.toLowerCase() || user.pkey?.replace('USER#', '').toLowerCase()
    if (!email) continue

    // Parse name from user record
    const nameFromUser = user.name || ''
    const nameParts = nameFromUser.split(' ')
    const userFirstName = user.firstName || nameParts[0] || ''
    const userLastName = user.lastName || nameParts.slice(1).join(' ') || ''

    // Convert emailVerified to ISO string
    let emailVerifiedStr: string | undefined
    if (user.emailVerified) {
      if (user.emailVerified instanceof Date) {
        emailVerifiedStr = user.emailVerified.toISOString()
      } else if (typeof user.emailVerified === 'string') {
        emailVerifiedStr = user.emailVerified
      } else if (typeof user.emailVerified === 'number') {
        emailVerifiedStr = new Date(user.emailVerified).toISOString()
      }
    }

    const existing = personMap.get(email)
    if (existing) {
      existing.userId = user.id || user.pkey?.replace('USER#', '')
      existing.role = user.role as any
      existing.provider = user.provider as any
      // Add auth fields
      if (user.hashedPassword) existing.hashedPassword = user.hashedPassword
      if (emailVerifiedStr) existing.emailVerified = emailVerifiedStr
      if (user.googleId) existing.googleId = user.googleId
      if (user.image) existing.image = user.image
      // Fill in name if directory didn't have it
      if (!existing.firstName && userFirstName) existing.firstName = cleanName(userFirstName)
      if (!existing.lastName && userLastName) existing.lastName = cleanName(userLastName)
      if (!existing.ecclesia && user.ecclesia) existing.ecclesia = user.ecclesia
    } else {
      // User not in directory - create person from user record
      personMap.set(email, {
        personId: uuidv4(),
        email,
        firstName: cleanName(userFirstName),
        lastName: cleanName(userLastName),
        ecclesia: user.ecclesia || '',
        memberStatus: 'visitor',
        userId: user.id || user.pkey?.replace('USER#', ''),
        role: user.role as any,
        provider: user.provider as any,
        phones: [],
        addresses: [],
        // Auth fields
        hashedPassword: user.hashedPassword,
        emailVerified: emailVerifiedStr,
        googleId: user.googleId,
        image: user.image,
      })
    }
  }

  console.log(`   Created ${personMap.size} unique persons`)

  // Step 3: Create PERSON records
  console.log('\n📝 Creating PERSON records...')

  for (const [email, person] of personMap) {
    try {
      // Create the person record (returns false if already exists)
      const created = await createPersonRecord(person)

      // Only create related records if we created the person record
      if (!created) {
        continue
      }

      // Create primary email record
      await createPersonEmailRecord(person.personId, email, 'primary', 0, true)

      // Get and migrate existing phones
      const existingPhones = await getExistingPhones(email)
      for (let i = 0; i < existingPhones.length; i++) {
        await createPersonPhoneRecord(person.personId, existingPhones[i], i)
      }

      // If no existing phones but directory had phone, create it
      if (existingPhones.length === 0 && person.phones.length > 0) {
        for (let i = 0; i < person.phones.length; i++) {
          await createPersonPhoneRecord(person.personId, { ...person.phones[i], isPrimary: i === 0 }, i)
        }
      }

      // Get and migrate existing addresses
      const existingAddresses = await getExistingAddresses(email)
      for (let i = 0; i < existingAddresses.length; i++) {
        await createPersonAddressRecord(person.personId, existingAddresses[i], i === 0)
      }

      // Get and migrate additional emails
      const existingEmails = await getExistingEmails(email)
      for (let i = 0; i < existingEmails.length; i++) {
        if (existingEmails[i].email.toLowerCase() !== email) {
          await createPersonEmailRecord(
            person.personId,
            existingEmails[i].email.toLowerCase(),
            'secondary',
            i + 1,
            existingEmails[i].verified
          )
        }
      }

      // Link USER record to personId
      if (person.userId) {
        await linkUserToPersonId(`USER#${email}`, person.personId)
      }

    } catch (error) {
      stats.errors.push(`Error processing ${email}: ${error}`)
      console.error(`   ❌ Error processing ${email}:`, error)
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Migration Summary')
  console.log('='.repeat(50))
  console.log(`   Directory members read: ${stats.directoryMembersRead}`)
  console.log(`   User records read: ${stats.usersRead}`)
  console.log(`   Persons created: ${stats.personsCreated}`)
  console.log(`   Emails created: ${stats.emailsCreated}`)
  console.log(`   Phones created: ${stats.phonesCreated}`)
  console.log(`   Addresses created: ${stats.addressesCreated}`)
  console.log(`   Errors: ${stats.errors.length}`)

  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:')
    stats.errors.forEach(e => console.log(`   - ${e}`))
  }

  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN. No data was modified.')
    console.log('   Run with --execute to apply changes.')
  } else {
    console.log('\n✅ Migration complete!')
  }
}

// Run migration
migrate().catch(console.error)
