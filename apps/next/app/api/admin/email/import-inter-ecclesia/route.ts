import { NextRequest, NextResponse } from 'next/server'
import { GetContactCommand, UpdateContactCommand, CreateContactCommand, SubscriptionStatus } from '@aws-sdk/client-sesv2'
import { getSesClient } from '@/utils/email/sesClient'
import { inputTemplate, createContactListTopic, getRawContactLists } from '@/utils/email/contact-lists'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { getEcclesiaByName, createEcclesia } from '@/utils/dynamodb/locations'
import { EmailListTypes } from '@my/app/types'
import * as fs from 'fs'
import * as path from 'path'

type ImportResult = {
  email: string
  ecclesia: string
  sesStatus: 'added' | 'updated' | 'skipped' | 'error'
  personStatus: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

/**
 * Parse simple CSV content
 * Handles quoted fields and commas within quotes
 */
function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  // Parse header line
  const headers = parseCSVLine(lines[0])

  // Parse data rows
  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header] = values[i] || ''
    })
    return row
  })

  return { headers, rows }
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * Ensure the interEcclesia topic exists in SES
 */
async function ensureInterEcclesiaTopicExists(): Promise<boolean> {
  try {
    const lists = await getRawContactLists()
    const topicExists = lists.Topics?.some(t => t.TopicName === 'interEcclesia')

    if (!topicExists) {
      console.log('📋 Creating interEcclesia topic in SES...')
      await createContactListTopic({
        listName: 'interEcclesia',
        displayName: 'Inter-Ecclesia Leaders',
        defaultOptIn: false,
      })
      console.log('✅ interEcclesia topic created')
    }

    return true
  } catch (error) {
    console.error('❌ Failed to ensure interEcclesia topic exists:', error)
    return false
  }
}

/**
 * POST: Import inter-ecclesia contacts from CSV file
 * Supports ?dryRun=true query param to preview changes
 */
export async function POST(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
    console.log(`🔄 Starting inter-ecclesia contact import (dryRun: ${dryRun})...`)

    // Ensure the interEcclesia topic exists first
    if (!dryRun) {
      const topicReady = await ensureInterEcclesiaTopicExists()
      if (!topicReady) {
        return NextResponse.json({
          error: 'Failed to ensure interEcclesia topic exists in SES'
        }, { status: 500 })
      }
    }

    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'data', 'subscribed_email_audience_export_76bfa2143c.csv')

    if (!fs.existsSync(csvPath)) {
      return NextResponse.json({
        error: `CSV file not found at ${csvPath}`
      }, { status: 404 })
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const { rows } = parseCSV(csvContent)

    console.log(`📧 Found ${rows.length} contacts in CSV`)

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contacts found in CSV',
        dryRun,
        added: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      })
    }

    const sesClient = getSesClient()
    const results: ImportResult[] = []

    // Rate limiting helpers
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Retry with exponential backoff for rate limit errors
    async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn()
        } catch (error: any) {
          if (error.message?.includes('Rate exceeded') && attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
            console.log(`⏳ Rate limited, waiting ${backoffMs}ms before retry ${attempt + 1}/${maxRetries}`)
            await delay(backoffMs)
            continue
          }
          throw error
        }
      }
      throw new Error('Max retries exceeded')
    }

    for (const row of rows) {
      // Add delay between contacts to avoid AWS SES rate limiting (1 req/sec)
      await delay(1100)
      const email = (row['Email Address'] || '').trim().toLowerCase()
      const ecclesia = (row['Name'] || '').trim()

      if (!email) {
        results.push({
          email: 'EMPTY',
          ecclesia,
          sesStatus: 'skipped',
          personStatus: 'skipped',
          message: 'No email address'
        })
        continue
      }

      // Validate email format
      if (!email.includes('@')) {
        results.push({
          email,
          ecclesia,
          sesStatus: 'skipped',
          personStatus: 'skipped',
          message: 'Invalid email format'
        })
        continue
      }

      try {
        // Check if contact exists (with retry for rate limits)
        let existingContact = null
        try {
          existingContact = await withRetry(async () => {
            const getCommand = new GetContactCommand({
              ...inputTemplate,
              EmailAddress: email
            })
            return await sesClient.send(getCommand)
          })
        } catch (getError: any) {
          if (getError.name !== 'NotFoundException') {
            throw getError
          }
        }

        if (dryRun) {
          // Dry run - check PersonRecord too
          const existingPerson = await personRepository.getByEmail(email)
          results.push({
            email,
            ecclesia,
            sesStatus: existingContact ? 'updated' : 'added',
            personStatus: existingPerson ? 'updated' : 'created',
            message: `[DryRun] SES: ${existingContact ? 'would update' : 'would create'}, Person: ${existingPerson ? 'would update' : 'would create'}`
          })
          continue
        }

        // Build attributes data with ecclesia name
        const attributes = {
          ecclesia,
          interEcclesiaImportDate: new Date().toISOString(),
        }

        if (existingContact) {
          // Contact exists - update to add interEcclesia topic while preserving others
          const updatedTopicPreferences = existingContact.TopicPreferences?.map(pref => {
            if (pref.TopicName === 'interEcclesia') {
              return {
                ...pref,
                SubscriptionStatus: SubscriptionStatus.OPT_IN
              }
            }
            return pref
          }) || []

          // If interEcclesia topic doesn't exist in preferences, add it
          if (!updatedTopicPreferences.find(p => p.TopicName === 'interEcclesia')) {
            updatedTopicPreferences.push({
              TopicName: 'interEcclesia',
              SubscriptionStatus: SubscriptionStatus.OPT_IN
            })
          }

          // Merge existing attributes with new ones
          let mergedAttributes = attributes
          if (existingContact.AttributesData) {
            try {
              const existingAttrs = JSON.parse(existingContact.AttributesData)
              mergedAttributes = { ...existingAttrs, ...attributes }
            } catch {
              // Ignore parse errors
            }
          }

          await withRetry(async () => {
            const updateCommand = new UpdateContactCommand({
              ...inputTemplate,
              EmailAddress: email,
              TopicPreferences: updatedTopicPreferences,
              AttributesData: JSON.stringify(mergedAttributes)
            })
            return await sesClient.send(updateCommand)
          })

          // Also handle PersonRecord
          let personStatus: ImportResult['personStatus'] = 'skipped'
          const existingPerson = await personRepository.getByEmail(email)
          if (existingPerson) {
            await personRepository.setInterEcclesiaRep(existingPerson.personId, true)
            if (!existingPerson.ecclesia && ecclesia) {
              await personRepository.updatePerson(existingPerson.personId, { ecclesia })
            }
            personStatus = 'updated'
          } else {
            await personRepository.create({
              email,
              firstName: '',
              lastName: '',
              ecclesia,
              memberStatus: 'member',
              isInterEcclesiaRep: true,
            })
            personStatus = 'created'
          }

          results.push({
            email,
            ecclesia,
            sesStatus: 'updated',
            personStatus,
            message: 'Added interEcclesia topic to existing contact'
          })

          console.log(`✅ Updated ${email} (${ecclesia}) - SES: updated, Person: ${personStatus}`)

        } else {
          // Contact doesn't exist - create new with only interEcclesia OPT_IN
          const topicPreferences = Object.keys(EmailListTypes).map(topic => ({
            TopicName: topic,
            SubscriptionStatus: topic === 'interEcclesia'
              ? SubscriptionStatus.OPT_IN
              : SubscriptionStatus.OPT_OUT
          }))

          await withRetry(async () => {
            const createCommand = new CreateContactCommand({
              ...inputTemplate,
              EmailAddress: email,
              TopicPreferences: topicPreferences,
              AttributesData: JSON.stringify(attributes)
            })
            return await sesClient.send(createCommand)
          })

          // Also create PersonRecord
          let personStatus: ImportResult['personStatus'] = 'skipped'
          const existingPerson = await personRepository.getByEmail(email)
          if (existingPerson) {
            await personRepository.setInterEcclesiaRep(existingPerson.personId, true)
            if (!existingPerson.ecclesia && ecclesia) {
              await personRepository.updatePerson(existingPerson.personId, { ecclesia })
            }
            personStatus = 'updated'
          } else {
            await personRepository.create({
              email,
              firstName: '',
              lastName: '',
              ecclesia,
              memberStatus: 'member',
              isInterEcclesiaRep: true,
            })
            personStatus = 'created'
          }

          results.push({
            email,
            ecclesia,
            sesStatus: 'added',
            personStatus,
            message: 'Created new contact with interEcclesia topic'
          })

          console.log(`✅ Added ${email} (${ecclesia}) - SES: added, Person: ${personStatus}`)
        }

      } catch (error: any) {
        console.error(`❌ Failed to process ${email}:`, error.message)
        results.push({
          email,
          ecclesia,
          sesStatus: 'error',
          personStatus: 'error',
          message: error.message
        })
      }
    }

    // Summary
    const summary = {
      total: results.length,
      ses: {
        added: results.filter(r => r.sesStatus === 'added').length,
        updated: results.filter(r => r.sesStatus === 'updated').length,
        skipped: results.filter(r => r.sesStatus === 'skipped').length,
        errors: results.filter(r => r.sesStatus === 'error').length,
      },
      person: {
        created: results.filter(r => r.personStatus === 'created').length,
        updated: results.filter(r => r.personStatus === 'updated').length,
        skipped: results.filter(r => r.personStatus === 'skipped').length,
        errors: results.filter(r => r.personStatus === 'error').length,
      },
    }

    console.log(`✅ Import complete:`)
    console.log(`   SES: ${summary.ses.added} added, ${summary.ses.updated} updated, ${summary.ses.errors} errors`)
    console.log(`   Person: ${summary.person.created} created, ${summary.person.updated} updated, ${summary.person.errors} errors`)

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete - would process ${rows.length} contacts`
        : `Import complete - processed ${rows.length} contacts`,
      summary,
      results
    })

  } catch (error) {
    console.error('❌ Error importing inter-ecclesia contacts:', error)
    return NextResponse.json(
      { error: 'Failed to import inter-ecclesia contacts' },
      { status: 500 }
    )
  }
}

/**
 * GET: Show information about the CSV file and current import status
 */
export async function GET() {
  try {
    // Check if CSV file exists
    const csvPath = path.join(process.cwd(), 'data', 'subscribed_email_audience_export_76bfa2143c.csv')
    const csvExists = fs.existsSync(csvPath)

    if (!csvExists) {
      return NextResponse.json({
        csvExists: false,
        csvPath,
        message: 'CSV file not found'
      })
    }

    // Parse CSV to get count
    const csvContent = fs.readFileSync(csvPath, 'utf-8')
    const { rows } = parseCSV(csvContent)

    // Check if interEcclesia topic exists
    let topicExists = false
    try {
      const lists = await getRawContactLists()
      topicExists = lists.Topics?.some(t => t.TopicName === 'interEcclesia') ?? false
    } catch {
      // Ignore
    }

    return NextResponse.json({
      csvExists: true,
      csvPath,
      contactCount: rows.length,
      interEcclesiaTopicExists: topicExists,
      ecclesias: rows.map(r => ({
        email: r['Email Address'],
        name: r['Name']
      })),
      instructions: {
        dryRun: 'POST /api/admin/email/import-inter-ecclesia?dryRun=true',
        import: 'POST /api/admin/email/import-inter-ecclesia'
      }
    })

  } catch (error) {
    console.error('❌ Error getting import status:', error)
    return NextResponse.json(
      { error: 'Failed to get import status' },
      { status: 500 }
    )
  }
}

/**
 * Infer location from ecclesia name
 */
function inferLocation(ecclesiaName: string): { country: string; province: string; city: string } {
  const name = ecclesiaName.toLowerCase()

  // US ecclesias (Michigan)
  if (name.includes('detroit') || name.includes('ann arbor')) {
    // Extract city from name
    let city = 'Detroit'
    if (name.includes('ann arbor')) city = 'Ann Arbor'
    else if (name.includes('livonia')) city = 'Livonia'
    else if (name.includes('milford')) city = 'Milford'
    else if (name.includes('royal oak')) city = 'Royal Oak'

    return { country: 'US', province: 'MI', city }
  }

  // Canadian ecclesias - try to infer city from name
  let city = 'Unknown'

  // Map common ecclesia name patterns to cities
  const cityMappings: Record<string, string> = {
    'toronto': 'Toronto',
    'hamilton': 'Hamilton',
    'kitchener': 'Kitchener',
    'waterloo': 'Waterloo',
    'london': 'London',
    'ottawa': 'Ottawa',
    'barrie': 'Barrie',
    'brantford': 'Brantford',
    'brant county': 'Brantford',
    'brampton': 'Brampton',
    'cambridge': 'Cambridge',
    'guelph': 'Guelph',
    'mississauga': 'Mississauga',
    'niagara': 'Niagara Falls',
    'north bay': 'North Bay',
    'peterborough': 'Peterborough',
    'collingwood': 'Collingwood',
    'shelburne': 'Shelburne',
    'picton': 'Picton',
    'huntsville': 'Huntsville',
    'woodstock': 'Woodstock',
    'manitoulin': 'Manitoulin Island',
    'greenaway': 'Greenaway',
    'mountain grove': 'Mountain Grove',
    'book rd': 'Hamilton',
    'macnab': 'Hamilton',
  }

  for (const [pattern, cityName] of Object.entries(cityMappings)) {
    if (name.includes(pattern)) {
      city = cityName
      break
    }
  }

  return { country: 'CA', province: 'ON', city }
}

/**
 * PATCH: Stub ecclesias from inter-ecclesia reps into the Ecclesia table
 * Only creates ecclesias that don't already exist
 *
 * Query params:
 *   - dryRun=true: Preview changes without making them
 */
export async function PATCH(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
    console.log(`🏛️ Stubbing ecclesias from inter-ecclesia reps (dryRun: ${dryRun})...`)

    // Get all inter-ecclesia reps
    const reps = await personRepository.listInterEcclesiaReps()
    console.log(`📧 Found ${reps.length} inter-ecclesia reps`)

    // Get unique ecclesia names
    const ecclesiaNames = [...new Set(reps.map(r => r.ecclesia).filter(Boolean))]
    console.log(`🏛️ Found ${ecclesiaNames.length} unique ecclesias`)

    interface StubResult {
      name: string
      status: 'created' | 'exists' | 'skipped' | 'error'
      location?: { country: string; province: string; city: string }
      message?: string
    }

    const results: StubResult[] = []

    for (const ecclesiaName of ecclesiaNames) {
      if (!ecclesiaName || ecclesiaName === 'Unknown') {
        results.push({
          name: ecclesiaName || 'EMPTY',
          status: 'skipped',
          message: 'Empty or Unknown ecclesia name'
        })
        continue
      }

      try {
        // Check if ecclesia already exists
        const existing = await getEcclesiaByName(ecclesiaName)

        if (existing) {
          results.push({
            name: ecclesiaName,
            status: 'exists',
            location: { country: existing.country, province: existing.province, city: existing.city },
            message: 'Ecclesia already exists in database'
          })
          continue
        }

        // Infer location from name
        const location = inferLocation(ecclesiaName)

        if (dryRun) {
          results.push({
            name: ecclesiaName,
            status: 'created',
            location,
            message: `[DryRun] Would create with inferred location`
          })
          continue
        }

        // Create the ecclesia stub
        await createEcclesia({
          name: ecclesiaName,
          country: location.country,
          province: location.province,
          city: location.city,
        })

        results.push({
          name: ecclesiaName,
          status: 'created',
          location,
          message: 'Created with inferred location'
        })
        console.log(`✅ Created ecclesia: ${ecclesiaName} (${location.city}, ${location.province}, ${location.country})`)

      } catch (error: any) {
        console.error(`❌ Failed to process ${ecclesiaName}:`, error.message)
        results.push({
          name: ecclesiaName,
          status: 'error',
          message: error.message
        })
      }
    }

    // Summary
    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      exists: results.filter(r => r.status === 'exists').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    }

    console.log(`✅ Ecclesia stub complete: ${summary.created} created, ${summary.exists} already exist, ${summary.skipped} skipped, ${summary.errors} errors`)

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete - would stub ${summary.created} ecclesias`
        : `Stub complete - created ${summary.created} ecclesias`,
      summary,
      results
    })

  } catch (error: any) {
    console.error('❌ Error stubbing ecclesias:', error)
    return NextResponse.json(
      { error: 'Failed to stub ecclesias', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}
