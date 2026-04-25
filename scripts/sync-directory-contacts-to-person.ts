/**
 * One-time Sync Script: Import phone/address from Google Sheets Directory → PERSON# records
 *
 * The Google Sheets directory has columns for phone and address but this data
 * was never imported into DynamoDB PersonRecords. This script reads directly
 * from the Google Sheet, parses the raw strings into structured fields, and
 * writes PersonPhoneRecord / PersonAddressRecord items under PERSON#{personId}.
 *
 * Idempotent – safe to run multiple times (skips duplicates).
 *
 * Usage:
 *   npx tsx scripts/sync-directory-contacts-to-person.ts --dry-run
 *   npx tsx scripts/sync-directory-contacts-to-person.ts
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { google } from 'googleapis'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'

const REGION = process.env.AWS_REGION || 'ca-central-1'
const dbClient = new DynamoDBClient({ region: REGION })
const docClient = DynamoDBDocumentClient.from(dbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})
const TABLE = 'tee-admin'

const DRY_RUN = process.argv.includes('--dry-run')

// ===== GOOGLE SHEETS =====

/**
 * Load the service account config and return the directory sheet ID + auth
 */
function loadGoogleConfig(): { sheetId: string; auth: any } {
  // Try multiple locations for the service account file
  const possiblePaths = [
    './apps/next/tee-services-db47a9e534d3.json',
    '../apps/next/tee-services-db47a9e534d3.json',
    path.resolve(process.cwd(), 'apps/next/tee-services-db47a9e534d3.json'),
  ]

  let configPath: string | null = null
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      configPath = p
      break
    }
  }

  if (!configPath) {
    throw new Error('Cannot find tee-services-db47a9e534d3.json — run from project root')
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

  // Get directory sheet ID from config
  const directoryConfig = config.sheet_ids?.directory
  if (!directoryConfig?.key) {
    throw new Error('No directory sheet configured in service account JSON')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: config,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })

  return { sheetId: directoryConfig.key, auth }
}

/**
 * Read all rows from the directory Google Sheet
 */
async function readDirectorySheet(sheetId: string, auth: any): Promise<Array<{
  email: string
  firstName: string
  lastName: string
  phone: string
  address: string
}>> {
  const sheets = google.sheets({ version: 'v4', auth })

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A:Z',
    valueRenderOption: 'FORMATTED_VALUE',
  })

  const rows = response.data.values || []
  if (rows.length === 0) return []

  // Build header mapping (case-insensitive)
  const headers = (rows[0] || []).map((h: any) => String(h).trim().toLowerCase())
  const dataRows = rows.slice(1)

  // Map common header names
  const headerAliases: Record<string, string[]> = {
    email: ['email', 'email address', 'e-mail'],
    firstName: ['firstname', 'first name', 'first', 'given name'],
    lastName: ['lastname', 'last name', 'last', 'surname', 'family name'],
    phone: ['phone', 'phone number', 'telephone', 'tel', 'cell', 'mobile', 'home phone'],
    address: ['address', 'home address', 'mailing address', 'street address'],
  }

  function findColumn(field: string): number {
    const aliases = headerAliases[field] || [field]
    for (const alias of aliases) {
      const idx = headers.indexOf(alias.toLowerCase())
      if (idx >= 0) return idx
    }
    return -1
  }

  const emailIdx = findColumn('email')
  const firstNameIdx = findColumn('firstName')
  const lastNameIdx = findColumn('lastName')
  const phoneIdx = findColumn('phone')
  const addressIdx = findColumn('address')

  console.log(`  Column mapping:`)
  console.log(`    email: ${emailIdx >= 0 ? `col ${emailIdx} ("${headers[emailIdx]}")` : 'NOT FOUND'}`)
  console.log(`    firstName: ${firstNameIdx >= 0 ? `col ${firstNameIdx} ("${headers[firstNameIdx]}")` : 'NOT FOUND'}`)
  console.log(`    lastName: ${lastNameIdx >= 0 ? `col ${lastNameIdx} ("${headers[lastNameIdx]}")` : 'NOT FOUND'}`)
  console.log(`    phone: ${phoneIdx >= 0 ? `col ${phoneIdx} ("${headers[phoneIdx]}")` : 'NOT FOUND'}`)
  console.log(`    address: ${addressIdx >= 0 ? `col ${addressIdx} ("${headers[addressIdx]}")` : 'NOT FOUND'}`)
  console.log(`  Headers found: ${headers.join(', ')}`)

  if (emailIdx < 0) {
    throw new Error(`Cannot find email column. Headers: ${headers.join(', ')}`)
  }

  const results: Array<{
    email: string
    firstName: string
    lastName: string
    phone: string
    address: string
  }> = []

  for (const row of dataRows) {
    const email = String(row[emailIdx] || '').trim()
    if (!email) continue

    results.push({
      email,
      firstName: firstNameIdx >= 0 ? String(row[firstNameIdx] || '').trim() : '',
      lastName: lastNameIdx >= 0 ? String(row[lastNameIdx] || '').trim() : '',
      phone: phoneIdx >= 0 ? String(row[phoneIdx] || '').trim() : '',
      address: addressIdx >= 0 ? String(row[addressIdx] || '').trim() : '',
    })
  }

  return results
}

// ===== PHONE PARSING =====

/**
 * Normalize a phone string to 10 digits, or return null if unparseable.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return digits
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
  if (digits.length === 7) return digits
  if (digits.length >= 7 && digits.length <= 15) return digits
  return null
}

/**
 * Parse phone field — may contain multiple numbers separated by delimiters,
 * newlines, or name prefixes like "Ken (C) 647-393-3153\nNipun (C) 647-567-6416".
 * Also handles annotations like "(C)", "Cell:", "Shop:", "(address updated ...)".
 */
function parsePhones(raw: string): string[] {
  if (!raw || !raw.trim()) return []

  // Remove non-phone annotations like "(address updated 2020-12-03)"
  let cleaned = raw.replace(/\(address[^)]*\)/gi, '')

  // Split on newlines, commas, semicolons, slashes, "and", "or"
  const parts = cleaned.split(/[\n\r,;\/]|\band\b|\bor\b/i)

  const phones: string[] = []
  for (const part of parts) {
    let trimmed = part.trim()
    if (!trimmed) continue

    // Handle "Name (C) 416-587-6763 Name (C) 416-587-1950" on a single line
    // Split on pattern: word(s) + (C) + number, then recurse
    const multiNameMatch = trimmed.match(/^[A-Za-z]+\s*\(C\)\s*[\d\-()+ ]+\s+[A-Za-z]+\s*\(C\)\s*[\d\-()+ ]+$/i)
    if (multiNameMatch) {
      // Split into individual "Name (C) Number" chunks
      const chunks = trimmed.split(/(?<=[\d])\s+(?=[A-Za-z]+\s*\(C\))/i)
      for (const chunk of chunks) {
        const cleanChunk = chunk
          .replace(/^[A-Za-z]+\s*\(C\)\s*/i, '')
          .trim()
        const n = normalizePhone(cleanChunk)
        if (n) phones.push(n)
      }
      continue
    }

    // Handle "Name (C) Number Name (C) Number" without newlines — also try splitting on space before name
    const multiNameMatch2 = trimmed.match(/^([A-Za-z]+)\s*\(C\)\s*([\d\-()+ ]+)\s+([A-Za-z]+)\s*\(C\)\s*([\d\-()+ ]+)$/i)
    if (multiNameMatch2) {
      const n1 = normalizePhone(multiNameMatch2[2]!)
      const n2 = normalizePhone(multiNameMatch2[4]!)
      if (n1) phones.push(n1)
      if (n2) phones.push(n2)
      continue
    }

    // Strip name prefixes: "Ken (C) 647-393-3153" → "647-393-3153"
    // Also handles "Cell: 705-931-2705", "Shop: 705-738-6178", "(C) 416-854-5521"
    trimmed = trimmed
      .replace(/^[A-Za-z]+\s*\(C\)\s*/i, '')   // "Ken (C) " prefix
      .replace(/^[A-Za-z]+\s+(?=\d)/i, '')      // "Steve " before digits
      .replace(/^\(C\)\s*/i, '')                  // "(C) " prefix
      .replace(/^Cell:\s*/i, '')                  // "Cell: " prefix
      .replace(/^Shop:\s*/i, '')                  // "Shop: " prefix
      .replace(/^Home:\s*/i, '')                  // "Home: " prefix
      .replace(/^Work:\s*/i, '')                  // "Work: " prefix
      .replace(/^Tel:\s*/i, '')                   // "Tel: " prefix
      .trim()

    if (!trimmed) continue
    const normalized = normalizePhone(trimmed)
    if (normalized) phones.push(normalized)
  }
  return phones
}

// ===== ADDRESS PARSING =====

interface ParsedAddress {
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country: string
}

const POSTAL_CODE_RE = /([A-Z]\d[A-Z])\s*(\d[A-Z]\d)/i

const PROVINCE_MAP: Record<string, string> = {
  'ontario': 'ON', 'on': 'ON',
  'quebec': 'QC', 'qc': 'QC', 'québec': 'QC',
  'british columbia': 'BC', 'bc': 'BC',
  'alberta': 'AB', 'ab': 'AB',
  'manitoba': 'MB', 'mb': 'MB',
  'saskatchewan': 'SK', 'sk': 'SK',
  'nova scotia': 'NS', 'ns': 'NS',
  'new brunswick': 'NB', 'nb': 'NB',
  'newfoundland': 'NL', 'nl': 'NL', 'newfoundland and labrador': 'NL',
  'prince edward island': 'PE', 'pe': 'PE', 'pei': 'PE',
  'northwest territories': 'NT', 'nt': 'NT',
  'nunavut': 'NU', 'nu': 'NU',
  'yukon': 'YT', 'yt': 'YT',
}

function parseAddress(raw: string): ParsedAddress | null {
  if (!raw || !raw.trim()) return null

  // Normalize: replace newlines with commas (Google Sheets uses newlines within cells)
  const normalized = raw.trim().replace(/[\n\r]+/g, ', ').replace(/,\s*,/g, ',')

  // Extract postal code (Canadian or US ZIP)
  let postalCode = ''
  let remaining = normalized
  const canadianPostalMatch = remaining.match(POSTAL_CODE_RE)
  const usZipMatch = remaining.match(/\b(\d{5}(?:-\d{4})?)\b/)

  if (canadianPostalMatch) {
    postalCode = `${canadianPostalMatch[1].toUpperCase()} ${canadianPostalMatch[2].toUpperCase()}`
    remaining = remaining.replace(POSTAL_CODE_RE, '').trim()
    remaining = remaining.replace(/,\s*$/, '').trim()
  } else if (usZipMatch) {
    postalCode = usZipMatch[1]!
    remaining = remaining.replace(usZipMatch[0], '').trim()
    remaining = remaining.replace(/,\s*$/, '').trim()
  }

  // Check for country indicators
  let country = 'Canada'
  const usIndicators = /\b(USA|U\.S\.A\.|United States|US)\b/i
  if (usIndicators.test(remaining)) {
    country = 'USA'
    remaining = remaining.replace(usIndicators, '').trim()
    remaining = remaining.replace(/,\s*$/, '').trim()
  }

  // Extract province/state
  let province = ''
  const parts = remaining.split(',').map(p => p.trim()).filter(Boolean)

  // Also check US state abbreviations for non-Canadian addresses
  const US_STATE_MAP: Record<string, string> = {
    'or': 'OR', 'oregon': 'OR', 'va': 'VA', 'virginia': 'VA',
    'bc': 'BC', 'ny': 'NY', 'ca': 'CA', 'fl': 'FL', 'tx': 'TX',
    'il': 'IL', 'wa': 'WA', 'al': 'AL', 'mi': 'MI', 'oh': 'OH',
  }
  const allProvinces = { ...PROVINCE_MAP, ...US_STATE_MAP }

  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1]!.trim()
    const provinceKey = lastPart.toLowerCase()
    if (allProvinces[provinceKey]) {
      province = allProvinces[provinceKey]!
      parts.pop()
    } else {
      const lastWords = lastPart.split(/\s+/)
      const lastWord = lastWords[lastWords.length - 1]!.toLowerCase()
      if (allProvinces[lastWord]) {
        province = allProvinces[lastWord]!
        parts[parts.length - 1] = lastWords.slice(0, -1).join(' ')
      }
    }
  } else if (parts.length === 1) {
    const words = parts[0]!.split(/\s+/)
    const lastWord = words[words.length - 1]!.toLowerCase()
    if (allProvinces[lastWord]) {
      province = allProvinces[lastWord]!
      parts[0] = words.slice(0, -1).join(' ')
    }
  }

  if (!province) province = country === 'Canada' ? 'ON' : ''

  // Parse remaining parts into street + city
  // Clean up empty parts after province/postal removal
  const cleanParts = parts.map(p => p.trim()).filter(Boolean)

  let street1 = ''
  let street2: string | undefined
  let city = ''

  if (cleanParts.length >= 3) {
    street1 = cleanParts[0]!
    street2 = cleanParts[1]!
    city = cleanParts.slice(2).join(', ')
  } else if (cleanParts.length === 2) {
    street1 = cleanParts[0]!
    city = cleanParts[1]!
  } else if (cleanParts.length === 1) {
    street1 = cleanParts[0]!
    city = ''
  } else {
    return null
  }

  if (!street1) return null

  return {
    street1,
    street2,
    city: city || '',
    province,
    postalCode,
    country,
  }
}

// ===== DYNAMO HELPERS =====

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

async function getPersonAddresses(personId: string): Promise<Array<{ street1: string; city: string; postalCode?: string }>> {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PERSON#${personId}`,
      ':sk': 'ADDRESS#',
    },
  }))
  return (result.Items || []) as Array<{ street1: string; city: string; postalCode?: string }>
}

// ===== MAIN =====

interface SyncStats {
  sheetRowsRead: number
  rowsWithPhone: number
  rowsWithAddress: number
  phonesCopied: number
  phonesSkipped: number
  phonesUnparseable: number
  addressesCopied: number
  addressesSkipped: number
  addressesUnparseable: number
  personsNotFound: number
  personsNotFoundList: string[]
  errors: string[]
}

async function main() {
  console.log(`\n=== Import Google Sheets Directory → PERSON# Phone/Address ===`)
  if (DRY_RUN) console.log('  DRY RUN — no writes will be made\n')
  else console.log('')

  const stats: SyncStats = {
    sheetRowsRead: 0,
    rowsWithPhone: 0,
    rowsWithAddress: 0,
    phonesCopied: 0,
    phonesSkipped: 0,
    phonesUnparseable: 0,
    addressesCopied: 0,
    addressesSkipped: 0,
    addressesUnparseable: 0,
    personsNotFound: 0,
    personsNotFoundList: [],
    errors: [],
  }

  // Step 1: Read from Google Sheet
  console.log('Step 1: Loading Google Sheets config...')
  const { sheetId, auth } = loadGoogleConfig()
  console.log(`  Directory sheet ID: ${sheetId}\n`)

  console.log('Step 2: Reading directory sheet...')
  const rows = await readDirectorySheet(sheetId, auth)
  stats.sheetRowsRead = rows.length
  console.log(`  Read ${rows.length} data rows\n`)

  if (rows.length === 0) {
    console.log('No data rows found. Exiting.')
    return
  }

  // Step 2: Process each row
  console.log('Step 3: Matching to PersonRecords and importing contacts...\n')

  for (const row of rows) {
    const hasPhone = !!row.phone
    const hasAddress = !!row.address

    if (hasPhone) stats.rowsWithPhone++
    if (hasAddress) stats.rowsWithAddress++

    if (!hasPhone && !hasAddress) continue

    // Look up the PersonRecord — email field may contain multiple emails
    // separated by newlines or spaces
    const emails = row.email.split(/[\n\r\s]+/).map((e: string) => e.trim()).filter(Boolean)
    let person: { personId: string } | null = null
    for (const email of emails) {
      person = await getPersonByEmail(email)
      if (person) break
    }
    if (!person) {
      const name = `${row.firstName} ${row.lastName}`.trim() || row.email
      console.log(`  [skip] No PERSON# for ${name} (${emails.join(', ')})`)
      stats.personsNotFound++
      stats.personsNotFoundList.push(`${row.firstName} ${row.lastName} <${emails.join(', ')}>`)
      continue
    }

    const name = `${row.firstName} ${row.lastName}`.trim() || row.email

    // --- PHONES ---
    if (hasPhone) {
      try {
        const phones = parsePhones(row.phone)
        if (phones.length === 0) {
          console.log(`  [phone] Could not parse "${row.phone}" for ${name}`)
          stats.phonesUnparseable++
        } else {
          const existingPhones = await getPersonPhones(person.personId)
          const existingNumbers = new Set(existingPhones.map(p => p.number))

          for (let i = 0; i < phones.length; i++) {
            const phoneNumber = phones[i]!
            if (existingNumbers.has(phoneNumber)) {
              stats.phonesSkipped++
              continue
            }

            const phoneId = uuidv4()
            const record = {
              pkey: `PERSON#${person.personId}`,
              skey: `PHONE#${phoneId}`,
              phoneId,
              type: 'home',
              number: phoneNumber,
              isPrimary: existingPhones.length === 0 && i === 0,
              isHousehold: false,
              order: existingPhones.length + i,
              lastUpdated: new Date().toISOString(),
              version: 0,
            }

            if (!DRY_RUN) {
              await docClient.send(new PutCommand({ TableName: TABLE, Item: record }))
            }

            console.log(`  [phone] ${DRY_RUN ? 'Would add' : 'Added'} ${phoneNumber} for ${name}`)
            stats.phonesCopied++
          }
        }
      } catch (err) {
        const msg = `Error processing phone for ${row.email}: ${err}`
        console.error(`  [error] ${msg}`)
        stats.errors.push(msg)
      }
    }

    // --- ADDRESSES ---
    if (hasAddress) {
      try {
        const parsed = parseAddress(row.address)
        if (!parsed) {
          console.log(`  [addr] Could not parse "${row.address}" for ${name}`)
          stats.addressesUnparseable++
        } else {
          const existingAddresses = await getPersonAddresses(person.personId)
          const alreadyExists = existingAddresses.some(a =>
            a.street1.toLowerCase() === parsed.street1.toLowerCase() &&
            (a.city.toLowerCase() === parsed.city.toLowerCase() ||
             (a.postalCode && parsed.postalCode && a.postalCode === parsed.postalCode))
          )

          if (alreadyExists) {
            stats.addressesSkipped++
          } else {
            const addressId = uuidv4()
            const record = {
              pkey: `PERSON#${person.personId}`,
              skey: `ADDRESS#${addressId}`,
              addressId,
              type: 'home',
              street1: parsed.street1,
              ...(parsed.street2 && { street2: parsed.street2 }),
              city: parsed.city,
              province: parsed.province,
              postalCode: parsed.postalCode,
              country: parsed.country,
              isPrimary: existingAddresses.length === 0,
              isHousehold: false,
              lastUpdated: new Date().toISOString(),
              version: 0,
            }

            if (!DRY_RUN) {
              await docClient.send(new PutCommand({ TableName: TABLE, Item: record }))
            }

            console.log(`  [addr] ${DRY_RUN ? 'Would add' : 'Added'} "${parsed.street1}, ${parsed.city}" for ${name}`)
            stats.addressesCopied++
          }
        }
      } catch (err) {
        const msg = `Error processing address for ${row.email}: ${err}`
        console.error(`  [error] ${msg}`)
        stats.errors.push(msg)
      }
    }
  }

  // --- SUMMARY ---
  console.log('\n=== Summary ===')
  console.log(`Sheet rows read:      ${stats.sheetRowsRead}`)
  console.log(`Rows with phone:      ${stats.rowsWithPhone}`)
  console.log(`Rows with address:    ${stats.rowsWithAddress}`)
  console.log('')
  console.log(`Phones:    ${stats.phonesCopied} ${DRY_RUN ? 'would be' : ''} copied, ${stats.phonesSkipped} already existed, ${stats.phonesUnparseable} unparseable`)
  console.log(`Addresses: ${stats.addressesCopied} ${DRY_RUN ? 'would be' : ''} copied, ${stats.addressesSkipped} already existed, ${stats.addressesUnparseable} unparseable`)
  console.log(`Persons not found: ${stats.personsNotFound}`)
  if (stats.personsNotFoundList.length > 0) {
    console.log(`  These people are in the sheet but have no PersonRecord:`)
    for (const p of stats.personsNotFoundList) console.log(`    - ${p}`)
  }
  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`)
    for (const err of stats.errors) console.log(`  - ${err}`)
  }
  if (DRY_RUN) console.log('\n  DRY RUN complete — no data was written')
  else console.log('\n  Sync complete')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
