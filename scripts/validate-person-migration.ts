/**
 * Validation Script: Unified People System Migration
 *
 * Validates that all USER# records have corresponding PERSON# records
 * and that data integrity is maintained.
 *
 * Usage:
 *   npx ts-node scripts/validate-person-migration.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'

// Configuration
const REGION = process.env.AWS_REGION || 'ca-central-1'

const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient)

const TEE_ADMIN_TABLE = 'tee-admin'

// Validation results
interface ValidationResult {
  passed: boolean
  totalUsers: number
  totalPersons: number
  usersWithPersonRecord: number
  usersMissingPersonRecord: string[]
  personsMissingEmailRecord: string[]
  duplicateEmails: string[]
  authFieldsMissing: string[]
  warnings: string[]
}

async function countAllUsers(): Promise<Map<string, any>> {
  console.log('📖 Scanning all USER# records...')
  const users = new Map<string, any>()
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
        const email = item.email?.toLowerCase() || item.pkey?.replace('USER#', '').toLowerCase()
        if (email?.includes('@')) {
          users.set(email, item)
        }
      }
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  console.log(`   Found ${users.size} unique USER# records`)
  return users
}

async function countAllPersons(): Promise<Map<string, any>> {
  console.log('📖 Scanning all PERSON# records...')
  const persons = new Map<string, any>()
  let lastKey: Record<string, any> | undefined

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TEE_ADMIN_TABLE,
      FilterExpression: 'begins_with(pkey, :prefix) AND skey = :skey',
      ExpressionAttributeValues: {
        ':prefix': 'PERSON#',
        ':skey': 'PROFILE',
      },
      ExclusiveStartKey: lastKey,
    }))

    if (result.Items) {
      for (const item of result.Items) {
        const email = item.primaryEmail?.toLowerCase()
        if (email) {
          if (persons.has(email)) {
            // Duplicate email detected
            console.log(`   ⚠️  Duplicate email: ${email}`)
          }
          persons.set(email, item)
        }
      }
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  console.log(`   Found ${persons.size} PERSON# records`)
  return persons
}

async function checkPersonHasEmailRecord(personId: string): Promise<boolean> {
  const result = await docClient.send(new QueryCommand({
    TableName: TEE_ADMIN_TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `PERSON#${personId}`,
      ':skPrefix': 'EMAIL#',
    },
    Limit: 1,
  }))

  return (result.Items && result.Items.length > 0)
}

async function validate(): Promise<ValidationResult> {
  console.log('🔍 Starting Unified People System Validation\n')

  const result: ValidationResult = {
    passed: true,
    totalUsers: 0,
    totalPersons: 0,
    usersWithPersonRecord: 0,
    usersMissingPersonRecord: [],
    personsMissingEmailRecord: [],
    duplicateEmails: [],
    authFieldsMissing: [],
    warnings: [],
  }

  // Step 1: Get all users and persons
  const users = await countAllUsers()
  const persons = await countAllPersons()

  result.totalUsers = users.size
  result.totalPersons = persons.size

  // Step 2: Check each user has a corresponding person
  console.log('\n🔗 Checking USER# → PERSON# mapping...')
  for (const [email, user] of users) {
    const person = persons.get(email)
    if (person) {
      result.usersWithPersonRecord++

      // Validate auth fields are preserved
      if (user.provider === 'credentials') {
        if (user.hashedPassword && !person.hashedPassword) {
          result.authFieldsMissing.push(`${email}: hashedPassword missing in PERSON record`)
        }
        if (user.emailVerified && !person.emailVerified) {
          result.authFieldsMissing.push(`${email}: emailVerified missing in PERSON record`)
        }
      }

      // Validate role is preserved
      if (user.role && !person.role) {
        result.authFieldsMissing.push(`${email}: role missing in PERSON record`)
      }
    } else {
      result.usersMissingPersonRecord.push(email)
    }
  }

  console.log(`   ${result.usersWithPersonRecord}/${result.totalUsers} users have PERSON records`)

  // Step 3: Check each person has an email record
  console.log('\n📧 Checking PERSON# → EMAIL# records...')
  let checkedCount = 0
  for (const [email, person] of persons) {
    const hasEmail = await checkPersonHasEmailRecord(person.personId)
    if (!hasEmail) {
      result.personsMissingEmailRecord.push(email)
    }
    checkedCount++
    if (checkedCount % 50 === 0) {
      process.stdout.write(`   Checked ${checkedCount}/${persons.size}...\r`)
    }
  }
  console.log(`   ${persons.size - result.personsMissingEmailRecord.length}/${persons.size} persons have EMAIL records`)

  // Step 4: Check for duplicate emails in GSI1
  console.log('\n🔄 Checking for duplicate GSI1 email entries...')
  const emailCounts = new Map<string, number>()
  for (const [email] of persons) {
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
  }
  for (const [email, count] of emailCounts) {
    if (count > 1) {
      result.duplicateEmails.push(`${email} (${count} records)`)
    }
  }

  // Determine pass/fail
  if (result.usersMissingPersonRecord.length > 0) {
    result.passed = false
  }
  if (result.personsMissingEmailRecord.length > 0) {
    result.passed = false
  }
  if (result.authFieldsMissing.length > 0) {
    result.passed = false
  }
  if (result.duplicateEmails.length > 0) {
    result.passed = false
  }

  return result
}

async function main(): Promise<void> {
  const result = await validate()

  console.log('\n' + '='.repeat(60))
  console.log(result.passed ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED')
  console.log('='.repeat(60))

  console.log('\n📊 Summary:')
  console.log(`   Total USER# records: ${result.totalUsers}`)
  console.log(`   Total PERSON# records: ${result.totalPersons}`)
  console.log(`   Users with PersonRecord: ${result.usersWithPersonRecord}`)
  console.log(`   Coverage: ${((result.usersWithPersonRecord / result.totalUsers) * 100).toFixed(1)}%`)

  if (result.usersMissingPersonRecord.length > 0) {
    console.log(`\n❌ Users missing PERSON records (${result.usersMissingPersonRecord.length}):`)
    result.usersMissingPersonRecord.slice(0, 20).forEach(email => {
      console.log(`   - ${email}`)
    })
    if (result.usersMissingPersonRecord.length > 20) {
      console.log(`   ... and ${result.usersMissingPersonRecord.length - 20} more`)
    }
  }

  if (result.personsMissingEmailRecord.length > 0) {
    console.log(`\n❌ Persons missing EMAIL records (${result.personsMissingEmailRecord.length}):`)
    result.personsMissingEmailRecord.slice(0, 20).forEach(email => {
      console.log(`   - ${email}`)
    })
    if (result.personsMissingEmailRecord.length > 20) {
      console.log(`   ... and ${result.personsMissingEmailRecord.length - 20} more`)
    }
  }

  if (result.authFieldsMissing.length > 0) {
    console.log(`\n⚠️  Auth fields not migrated (${result.authFieldsMissing.length}):`)
    result.authFieldsMissing.slice(0, 20).forEach(msg => {
      console.log(`   - ${msg}`)
    })
    if (result.authFieldsMissing.length > 20) {
      console.log(`   ... and ${result.authFieldsMissing.length - 20} more`)
    }
  }

  if (result.duplicateEmails.length > 0) {
    console.log(`\n⚠️  Duplicate emails detected (${result.duplicateEmails.length}):`)
    result.duplicateEmails.forEach(email => {
      console.log(`   - ${email}`)
    })
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`)
    result.warnings.forEach(warning => {
      console.log(`   - ${warning}`)
    })
  }

  // Exit with appropriate code
  process.exit(result.passed ? 0 : 1)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
