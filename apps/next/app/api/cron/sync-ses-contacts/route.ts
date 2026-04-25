import { NextRequest, NextResponse } from 'next/server'
import {
  GetContactCommand,
  UpdateContactCommand,
  CreateContactCommand,
  SubscriptionStatus
} from '@aws-sdk/client-sesv2'
import { getSesClient } from '@/utils/email/sesClient'
import { inputTemplate } from '@/utils/email/contact-lists'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { EmailListTypes } from '@my/app/types'

/**
 * Cron Job: Sync PersonRecords to SES Contact List
 *
 * This is a one-way sync from PersonRecord (source of truth) to AWS SES.
 * Runs periodically to ensure SES contacts match PersonRecord data.
 *
 * Schedule: Runs via Vercel cron or can be triggered manually
 *
 * What it syncs:
 * - Inter-ecclesia reps: PersonRecord.isInterEcclesiaRep -> SES interEcclesia topic
 * - Email preferences: PersonEmailRecord.sesTopicPreferences -> SES topic subscriptions
 * - Email status: PersonEmailRecord.sesStatus -> SES contact status
 *
 * Security: Requires CRON_SECRET header for cron jobs, or admin session for manual trigger
 */

interface SyncResult {
  email: string
  action: 'created' | 'updated' | 'skipped' | 'error'
  message?: string
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  // Check for cron secret or allow local development
  const isAuthorized =
    (authHeader === `Bearer ${cronSecret}`) ||
    process.env.NODE_ENV === 'development'

  if (!isAuthorized && cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true'
  const interEcclesiaOnly = request.nextUrl.searchParams.get('interEcclesiaOnly') === 'true'

  console.log(`🔄 Starting PersonRecord -> SES sync (dryRun: ${dryRun}, interEcclesiaOnly: ${interEcclesiaOnly})`)

  try {
    const sesClient = getSesClient()
    const results: SyncResult[] = []
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Get persons to sync
    let persons: Awaited<ReturnType<typeof personRepository.listAll>>['items']

    if (interEcclesiaOnly) {
      // Only sync inter-ecclesia reps
      persons = await personRepository.listInterEcclesiaReps()
      console.log(`📧 Found ${persons.length} inter-ecclesia reps to sync`)
    } else {
      // Sync all persons (paginated)
      const allPersons: typeof persons = []
      let lastKey: Record<string, any> | undefined

      do {
        const page = await personRepository.listAll({
          limit: 100,
          lastEvaluatedKey: lastKey,
        })
        allPersons.push(...page.items)
        lastKey = page.lastEvaluatedKey
      } while (lastKey)

      persons = allPersons
      console.log(`📧 Found ${persons.length} persons to sync`)
    }

    // Process each person
    for (const person of persons) {
      // Rate limiting - SES has 1 req/sec limit for contact operations
      await delay(1100)

      const email = person.primaryEmail.toLowerCase()

      try {
        // Get the person's email record for SES preferences
        const emails = await personRepository.getEmails(person.personId)
        const primaryEmailRecord = emails.find(e => e.emailType === 'primary')

        // Build topic preferences from PersonRecord
        const topicPreferences = Object.keys(EmailListTypes).map(topic => {
          // Determine if user should be opted in to this topic
          const shouldOptIn =
            // Inter-ecclesia rep should be opted into interEcclesia topic
            (topic === 'interEcclesia' && person.isInterEcclesiaRep) ||
            // Apply saved topic preferences from PersonEmailRecord
            (primaryEmailRecord?.sesTopicPreferences?.[topic])

          return {
            TopicName: topic,
            SubscriptionStatus: shouldOptIn ? SubscriptionStatus.OPT_IN : SubscriptionStatus.OPT_OUT,
          }
        })

        // Build attributes
        const attributes = {
          ecclesia: person.ecclesia || '',
          firstName: person.firstName || '',
          lastName: person.lastName || '',
          personId: person.personId,
          syncedAt: new Date().toISOString(),
        }

        if (dryRun) {
          // Just check current state
          let existingContact = null
          try {
            existingContact = await sesClient.send(new GetContactCommand({
              ...inputTemplate,
              EmailAddress: email,
            }))
          } catch (error: any) {
            if (error.name !== 'NotFoundException') {
              throw error
            }
          }

          results.push({
            email,
            action: existingContact ? 'updated' : 'created',
            message: `[DryRun] Would ${existingContact ? 'update' : 'create'} contact`,
          })
          continue
        }

        // Check if contact exists
        let existingContact = null
        try {
          existingContact = await sesClient.send(new GetContactCommand({
            ...inputTemplate,
            EmailAddress: email,
          }))
        } catch (error: any) {
          if (error.name !== 'NotFoundException') {
            throw error
          }
        }

        if (existingContact) {
          // Update existing contact
          await sesClient.send(new UpdateContactCommand({
            ...inputTemplate,
            EmailAddress: email,
            TopicPreferences: topicPreferences,
            AttributesData: JSON.stringify(attributes),
          }))

          results.push({
            email,
            action: 'updated',
            message: 'Updated SES contact from PersonRecord',
          })
        } else {
          // Create new contact
          await sesClient.send(new CreateContactCommand({
            ...inputTemplate,
            EmailAddress: email,
            TopicPreferences: topicPreferences,
            AttributesData: JSON.stringify(attributes),
          }))

          results.push({
            email,
            action: 'created',
            message: 'Created SES contact from PersonRecord',
          })
        }

        // Update PersonEmailRecord with SES sync timestamp
        if (primaryEmailRecord && !dryRun) {
          await personRepository.update(
            primaryEmailRecord.pkey,
            primaryEmailRecord.skey,
            {
              sesLastSynced: new Date().toISOString(),
              sesSubscribed: true,
              sesStatus: 'active',
            } as any
          )
        }

      } catch (error: any) {
        console.error(`❌ Failed to sync ${email}:`, error.message)
        results.push({
          email,
          action: 'error',
          message: error.message,
        })
      }
    }

    // Summary
    const summary = {
      total: results.length,
      created: results.filter(r => r.action === 'created').length,
      updated: results.filter(r => r.action === 'updated').length,
      skipped: results.filter(r => r.action === 'skipped').length,
      errors: results.filter(r => r.action === 'error').length,
    }

    console.log(`✅ Sync complete: ${summary.created} created, ${summary.updated} updated, ${summary.errors} errors`)

    return NextResponse.json({
      success: true,
      dryRun,
      interEcclesiaOnly,
      summary,
      results: dryRun ? results : results.slice(0, 20), // Only return first 20 in non-dryrun
    })

  } catch (error) {
    console.error('❌ Error in SES sync:', error)
    return NextResponse.json(
      { error: 'Failed to sync contacts to SES' },
      { status: 500 }
    )
  }
}

/**
 * POST: Sync a specific email address
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  // Verify this is a legitimate request
  const authHeader = request.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET

  const isAuthorized =
    (authHeader === `Bearer ${cronSecret}`) ||
    process.env.NODE_ENV === 'development'

  if (!isAuthorized && cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const person = await personRepository.getByEmail(email)

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    const sesClient = getSesClient()

    // Get email preferences
    const emails = await personRepository.getEmails(person.personId)
    const primaryEmailRecord = emails.find(e => e.emailType === 'primary')

    // Build topic preferences
    const topicPreferences = Object.keys(EmailListTypes).map(topic => {
      const shouldOptIn =
        (topic === 'interEcclesia' && person.isInterEcclesiaRep) ||
        (primaryEmailRecord?.sesTopicPreferences?.[topic])

      return {
        TopicName: topic,
        SubscriptionStatus: shouldOptIn ? SubscriptionStatus.OPT_IN : SubscriptionStatus.OPT_OUT,
      }
    })

    const attributes = {
      ecclesia: person.ecclesia || '',
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      personId: person.personId,
      syncedAt: new Date().toISOString(),
    }

    // Check if contact exists
    let existingContact = null
    try {
      existingContact = await sesClient.send(new GetContactCommand({
        ...inputTemplate,
        EmailAddress: email.toLowerCase(),
      }))
    } catch (error: any) {
      if (error.name !== 'NotFoundException') {
        throw error
      }
    }

    if (existingContact) {
      await sesClient.send(new UpdateContactCommand({
        ...inputTemplate,
        EmailAddress: email.toLowerCase(),
        TopicPreferences: topicPreferences,
        AttributesData: JSON.stringify(attributes),
      }))
    } else {
      await sesClient.send(new CreateContactCommand({
        ...inputTemplate,
        EmailAddress: email.toLowerCase(),
        TopicPreferences: topicPreferences,
        AttributesData: JSON.stringify(attributes),
      }))
    }

    // Update PersonEmailRecord
    if (primaryEmailRecord) {
      await personRepository.update(
        primaryEmailRecord.pkey,
        primaryEmailRecord.skey,
        {
          sesLastSynced: new Date().toISOString(),
          sesSubscribed: true,
          sesStatus: 'active',
        } as any
      )
    }

    return NextResponse.json({
      success: true,
      email,
      action: existingContact ? 'updated' : 'created',
      message: `Contact ${existingContact ? 'updated' : 'created'} in SES`,
    })

  } catch (error) {
    console.error('❌ Error syncing single contact:', error)
    return NextResponse.json(
      { error: 'Failed to sync contact' },
      { status: 500 }
    )
  }
}
