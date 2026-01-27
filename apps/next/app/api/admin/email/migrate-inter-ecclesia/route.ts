import { NextRequest, NextResponse } from 'next/server'
import { getContacts } from '@/utils/email/contact'
import { getRawContactLists, createContactListTopic } from '@/utils/email/contact-lists'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/**
 * Contact from SES with AttributesData
 */
interface SESContactWithAttributes {
  EmailAddress?: string
  UnsubscribeAll?: boolean
  AttributesData?: string
}

/**
 * Migration result for a single contact
 */
interface MigrationResult {
  email: string
  ecclesia: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  personId?: string
  message?: string
}

/**
 * Ensure the interEcclesia topic exists in SES, create if not
 */
async function ensureInterEcclesiaTopicExists(): Promise<{ existed: boolean; created: boolean }> {
  const contactList = await getRawContactLists()
  const topicExists = contactList.Topics?.some(t => t.TopicName === 'interEcclesia')

  if (topicExists) {
    return { existed: true, created: false }
  }

  // Create the topic
  console.log('📧 Creating interEcclesia topic in SES...')
  await createContactListTopic({
    listName: 'interEcclesia',
    displayName: 'Inter-Ecclesia Leaders',
    defaultOptIn: false,
  })
  console.log('✅ Created interEcclesia topic')

  return { existed: false, created: true }
}

/**
 * Get all contacts from SES interEcclesia topic (paginated)
 */
async function getAllInterEcclesiaContacts(): Promise<SESContactWithAttributes[]> {
  const allContacts: SESContactWithAttributes[] = []
  let nextToken: string | undefined

  do {
    const response = await getContacts({ listTopic: 'interEcclesia', nextPageToken: nextToken })
    if (response.Contacts) {
      allContacts.push(...(response.Contacts as SESContactWithAttributes[]))
    }
    nextToken = response.NextToken
  } while (nextToken)

  return allContacts
}

/**
 * POST: Migrate inter-ecclesia contacts from SES to PersonRecords
 * Sets isInterEcclesiaRep = true on each PersonRecord
 *
 * Query params:
 *   - dryRun=true: Preview changes without making them
 */
export async function POST(request: NextRequest) {
  try {
    const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
    console.log(`🔄 Starting inter-ecclesia migration to PersonRecords (dryRun: ${dryRun})...`)

    // Ensure the interEcclesia topic exists in SES
    const topicStatus = await ensureInterEcclesiaTopicExists()
    if (topicStatus.created) {
      console.log('📧 interEcclesia topic was just created - no contacts to migrate yet')
      return NextResponse.json({
        success: true,
        dryRun,
        message: 'interEcclesia topic created in SES. No contacts exist yet - add contacts to this topic first.',
        topicCreated: true,
        summary: { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
        results: []
      })
    }

    // Get all contacts from SES interEcclesia topic
    const sesContacts = await getAllInterEcclesiaContacts()
    console.log(`📧 Found ${sesContacts.length} contacts in SES interEcclesia topic`)

    const results: MigrationResult[] = []

    for (const contact of sesContacts) {
      const email = contact.EmailAddress?.toLowerCase()
      if (!email) {
        results.push({
          email: 'EMPTY',
          ecclesia: '',
          status: 'skipped',
          message: 'No email address'
        })
        continue
      }

      // Skip unsubscribed contacts
      if (contact.UnsubscribeAll) {
        results.push({
          email,
          ecclesia: '',
          status: 'skipped',
          message: 'Unsubscribed'
        })
        continue
      }

      // Parse ecclesia from AttributesData
      let ecclesia = ''
      let firstName = ''
      let lastName = ''
      if (contact.AttributesData) {
        try {
          const attrs = JSON.parse(contact.AttributesData)
          ecclesia = attrs.ecclesia || ''
          firstName = attrs.firstName || ''
          lastName = attrs.lastName || ''
        } catch {
          // Ignore parse errors
        }
      }

      if (!ecclesia) {
        results.push({
          email,
          ecclesia: '',
          status: 'skipped',
          message: 'No ecclesia in SES AttributesData'
        })
        continue
      }

      try {
        // Check if PersonRecord exists
        const existingPerson = await personRepository.getByEmail(email)

        if (dryRun) {
          results.push({
            email,
            ecclesia,
            status: existingPerson ? 'updated' : 'created',
            personId: existingPerson?.personId,
            message: dryRun ?
              (existingPerson ? 'Would set isInterEcclesiaRep=true' : 'Would create new PersonRecord') :
              undefined
          })
          continue
        }

        if (existingPerson) {
          // Update existing PersonRecord
          await personRepository.setInterEcclesiaRep(existingPerson.personId, true)

          // Also update ecclesia if not set
          if (!existingPerson.ecclesia && ecclesia) {
            await personRepository.updatePerson(existingPerson.personId, { ecclesia })
          }

          results.push({
            email,
            ecclesia: existingPerson.ecclesia || ecclesia,
            status: 'updated',
            personId: existingPerson.personId,
            message: 'Set isInterEcclesiaRep=true'
          })
          console.log(`✅ Updated ${email} - set isInterEcclesiaRep=true`)
        } else {
          // Create new PersonRecord
          const newPerson = await personRepository.create({
            email,
            firstName,
            lastName,
            ecclesia,
            memberStatus: 'member',
            isInterEcclesiaRep: true,
          })

          results.push({
            email,
            ecclesia,
            status: 'created',
            personId: newPerson.personId,
            message: 'Created new PersonRecord with isInterEcclesiaRep=true'
          })
          console.log(`✅ Created ${email} (${ecclesia}) as inter-ecclesia rep`)
        }

      } catch (error: any) {
        console.error(`❌ Failed to process ${email}:`, error.message)
        results.push({
          email,
          ecclesia,
          status: 'error',
          message: error.message
        })
      }
    }

    // Summary
    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    }

    console.log(`✅ Migration complete: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors} errors`)

    return NextResponse.json({
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run complete - would process ${summary.total} contacts`
        : `Migration complete - processed ${summary.total} contacts`,
      summary,
      results
    })

  } catch (error: any) {
    console.error('❌ Error migrating inter-ecclesia contacts:', error)
    return NextResponse.json(
      { error: 'Failed to migrate inter-ecclesia contacts', details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET: Show current inter-ecclesia reps from PersonRecords
 */
export async function GET() {
  try {
    // Get all inter-ecclesia reps from PersonRecords
    const reps = await personRepository.listInterEcclesiaReps()

    // Group by ecclesia
    const byEcclesia: Record<string, Array<{ email: string; name: string; personId: string }>> = {}
    for (const rep of reps) {
      const ecclesia = rep.ecclesia || 'Unknown'
      if (!byEcclesia[ecclesia]) {
        byEcclesia[ecclesia] = []
      }
      byEcclesia[ecclesia].push({
        email: rep.primaryEmail,
        name: rep.displayName,
        personId: rep.personId,
      })
    }

    return NextResponse.json({
      success: true,
      totalReps: reps.length,
      totalEcclesias: Object.keys(byEcclesia).length,
      byEcclesia,
      reps: reps.map(r => ({
        personId: r.personId,
        email: r.primaryEmail,
        name: r.displayName,
        ecclesia: r.ecclesia,
      }))
    })

  } catch (error) {
    console.error('❌ Error listing inter-ecclesia reps:', error)
    return NextResponse.json(
      { error: 'Failed to list inter-ecclesia reps' },
      { status: 500 }
    )
  }
}
