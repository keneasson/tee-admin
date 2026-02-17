/**
 * One-time Sync Script: Copy USER# phones/addresses to PERSON#
 *
 * After redirecting /api/user/phones and /api/user/addresses to personRepository,
 * any phones/addresses previously saved under USER#{email} need to be copied to
 * PERSON#{personId}. This script is idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx ts-node scripts/sync-user-phones-to-person.ts
 *   npx ts-node scripts/sync-user-phones-to-person.ts --dry-run
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { v4 as uuidv4 } from 'uuid'

const REGION = process.env.AWS_REGION || 'ca-central-1'
const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)
const TABLE = 'tee-admin'

const DRY_RUN = process.argv.includes('--dry-run')

interface SyncStats {
  userPhonesScanned: number
  userAddressesScanned: number
  phonesCopied: number
  phonesSkipped: number
  addressesCopied: number
  addressesSkipped: number
  personsNotFound: number
  errors: string[]
}

/**
 * Look up a PERSON# record by email via GSI1
 */
async function getPersonByEmail(email: string): Promise<{ personId: string } | null> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'gsi1',
    KeyConditionExpression: 'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
    ExpressionAttributeValues: {
      ':gsi1pk': `EMAIL#${email.toLowerCase()}`,
      ':gsi1sk': 'PERSON',
    },
    Limit: 1,
  }))

  const item = result.Items?.[0]
  if (!item) return null

  const pkey = item.pkey as string
  if (!pkey?.startsWith('PERSON#')) return null
  return { personId: pkey.replace('PERSON#', '') }
}

/**
 * Get all PHONE# items under a PERSON#
 */
async function getPersonPhones(personId: string): Promise<Array<{ number: string }>> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PERSON#${personId}`,
      ':sk': 'PHONE#',
    },
  }))
  return (result.Items || []) as Array<{ number: string }>
}

/**
 * Get all ADDRESS# items under a PERSON#
 */
async function getPersonAddresses(personId: string): Promise<Array<{ street1: string; city: string }>> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PERSON#${personId}`,
      ':sk': 'ADDRESS#',
    },
  }))
  return (result.Items || []) as Array<{ street1: string; city: string }>
}

/**
 * Scan all USER# PHONE# records
 */
async function scanUserPhones(): Promise<Array<Record<string, any>>> {
  const items: Array<Record<string, any>> = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(pkey, :userPrefix) AND begins_with(skey, :phonePrefix)',
      ExpressionAttributeValues: {
        ':userPrefix': 'USER#',
        ':phonePrefix': 'PHONE#',
      },
      ExclusiveStartKey: lastKey,
    }))
    items.push(...(result.Items || []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

/**
 * Scan all USER# ADDRESS# records
 */
async function scanUserAddresses(): Promise<Array<Record<string, any>>> {
  const items: Array<Record<string, any>> = []
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(pkey, :userPrefix) AND begins_with(skey, :addrPrefix)',
      ExpressionAttributeValues: {
        ':userPrefix': 'USER#',
        ':addrPrefix': 'ADDRESS#',
      },
      ExclusiveStartKey: lastKey,
    }))
    items.push(...(result.Items || []))
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  return items
}

async function main() {
  console.log(`\n=== Sync USER# Phones/Addresses → PERSON# ===`)
  if (DRY_RUN) console.log('🔍 DRY RUN — no writes will be made\n')
  else console.log('')

  const stats: SyncStats = {
    userPhonesScanned: 0,
    userAddressesScanned: 0,
    phonesCopied: 0,
    phonesSkipped: 0,
    addressesCopied: 0,
    addressesSkipped: 0,
    personsNotFound: 0,
    errors: [],
  }

  // --- PHONES ---
  console.log('📱 Scanning USER# phone records...')
  const userPhones = await scanUserPhones()
  stats.userPhonesScanned = userPhones.length
  console.log(`   Found ${userPhones.length} USER# phone records`)

  for (const userPhone of userPhones) {
    const email = (userPhone.pkey as string).replace('USER#', '')
    try {
      const person = await getPersonByEmail(email)
      if (!person) {
        console.log(`   ⚠️  No PERSON# for ${email} — skipping phone`)
        stats.personsNotFound++
        continue
      }

      // Check if this phone number already exists under PERSON#
      const existingPhones = await getPersonPhones(person.personId)
      const alreadyExists = existingPhones.some(p => p.number === userPhone.number)

      if (alreadyExists) {
        stats.phonesSkipped++
        continue
      }

      // Copy to PERSON#
      const phoneId = uuidv4()
      const record = {
        pkey: `PERSON#${person.personId}`,
        skey: `PHONE#${phoneId}`,
        phoneId,
        type: userPhone.type || 'mobile',
        number: userPhone.number,
        isPrimary: userPhone.isPrimary ?? false,
        isHousehold: userPhone.isHousehold ?? false,
        order: userPhone.order ?? existingPhones.length,
        lastUpdated: new Date().toISOString(),
        version: 0,
      }

      if (!DRY_RUN) {
        await docClient.send(new PutCommand({ TableName: TABLE, Item: record }))
      }

      console.log(`   ✅ ${DRY_RUN ? 'Would copy' : 'Copied'} phone ${userPhone.number} for ${email} → PERSON#${person.personId}`)
      stats.phonesCopied++
    } catch (err) {
      const msg = `Error processing phone for ${email}: ${err}`
      console.error(`   ❌ ${msg}`)
      stats.errors.push(msg)
    }
  }

  // --- ADDRESSES ---
  console.log('\n🏠 Scanning USER# address records...')
  const userAddresses = await scanUserAddresses()
  stats.userAddressesScanned = userAddresses.length
  console.log(`   Found ${userAddresses.length} USER# address records`)

  for (const userAddr of userAddresses) {
    const email = (userAddr.pkey as string).replace('USER#', '')
    try {
      const person = await getPersonByEmail(email)
      if (!person) {
        console.log(`   ⚠️  No PERSON# for ${email} — skipping address`)
        stats.personsNotFound++
        continue
      }

      // Check if this address already exists under PERSON# (match by street1+city)
      const existingAddresses = await getPersonAddresses(person.personId)
      const alreadyExists = existingAddresses.some(
        a => a.street1 === userAddr.street1 && a.city === userAddr.city
      )

      if (alreadyExists) {
        stats.addressesSkipped++
        continue
      }

      // Copy to PERSON#
      const addressId = uuidv4()
      const record = {
        pkey: `PERSON#${person.personId}`,
        skey: `ADDRESS#${addressId}`,
        addressId,
        type: userAddr.type || 'home',
        street1: userAddr.street1,
        street2: userAddr.street2,
        city: userAddr.city,
        province: userAddr.province,
        postalCode: userAddr.postalCode,
        country: userAddr.country || 'Canada',
        isPrimary: userAddr.isPrimary ?? false,
        isHousehold: userAddr.isHousehold ?? false,
        label: userAddr.label,
        householdId: userAddr.householdId,
        lastUpdated: new Date().toISOString(),
        version: 0,
      }

      if (!DRY_RUN) {
        await docClient.send(new PutCommand({ TableName: TABLE, Item: record }))
      }

      console.log(`   ✅ ${DRY_RUN ? 'Would copy' : 'Copied'} address "${userAddr.street1}, ${userAddr.city}" for ${email} → PERSON#${person.personId}`)
      stats.addressesCopied++
    } catch (err) {
      const msg = `Error processing address for ${email}: ${err}`
      console.error(`   ❌ ${msg}`)
      stats.errors.push(msg)
    }
  }

  // --- SUMMARY ---
  console.log('\n=== Summary ===')
  console.log(`Phones:    ${stats.userPhonesScanned} scanned, ${stats.phonesCopied} copied, ${stats.phonesSkipped} already existed`)
  console.log(`Addresses: ${stats.userAddressesScanned} scanned, ${stats.addressesCopied} copied, ${stats.addressesSkipped} already existed`)
  console.log(`Persons not found: ${stats.personsNotFound}`)
  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.length}`)
    for (const err of stats.errors) console.log(`  - ${err}`)
  }
  if (DRY_RUN) console.log('\n🔍 DRY RUN complete — no data was written')
  else console.log('\n✅ Sync complete')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
