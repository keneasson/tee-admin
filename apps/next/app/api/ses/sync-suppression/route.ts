import { NextRequest, NextResponse } from 'next/server'
import {
  ListSuppressedDestinationsCommand,
  ListSuppressedDestinationsRequest,
  SuppressedDestinationSummary,
} from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../utils/email/sesClient'
import { unsubscribeContact, getContact } from '../../../../utils/email/contact'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'

interface SyncResult {
  email: string
  reason: string
  dateAdded: string
  action: 'unsubscribed' | 'already_unsubscribed' | 'not_in_contact_list' | 'error'
  error?: string
}

/**
 * GET /api/ses/sync-suppression
 *
 * Fetches the SES suppression list and unsubscribes any contacts
 * that are in the suppression list but still subscribed.
 *
 * This is useful for:
 * - Initial sync when setting up bounce handling
 * - Catching bounces that occurred before webhook was set up
 * - Manual cleanup of bounced addresses
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication - only admins can run this
    const session = await auth()
    if (!session?.user?.role || ![ROLES.ADMIN, ROLES.OWNER].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const client = getSesClient()
    const suppressedEmails: SuppressedDestinationSummary[] = []

    // Fetch all suppressed destinations (paginated)
    let nextToken: string | undefined
    do {
      const params: ListSuppressedDestinationsRequest = {
        PageSize: 100,
        ...(nextToken && { NextToken: nextToken }),
      }

      const command = new ListSuppressedDestinationsCommand(params)
      const response = await client.send(command)

      if (response.SuppressedDestinationSummaries) {
        suppressedEmails.push(...response.SuppressedDestinationSummaries)
      }

      nextToken = response.NextToken
    } while (nextToken)

    console.log(`📧 Found ${suppressedEmails.length} suppressed emails in SES`)

    // Process each suppressed email
    const results: SyncResult[] = await Promise.all(
      suppressedEmails.map(async (suppressed) => {
        const email = suppressed.EmailAddress
        const reason = suppressed.Reason || 'unknown'
        const dateAdded = suppressed.LastUpdateTime?.toISOString() || 'unknown'

        if (!email) {
          return {
            email: 'unknown',
            reason,
            dateAdded,
            action: 'error' as const,
            error: 'No email address in suppression record',
          }
        }

        try {
          // Check if contact exists in our list
          const contact = await getContact(email)

          if (!contact) {
            return {
              email,
              reason,
              dateAdded,
              action: 'not_in_contact_list' as const,
            }
          }

          // Check if already unsubscribed
          if (contact.UnsubscribeAll) {
            return {
              email,
              reason,
              dateAdded,
              action: 'already_unsubscribed' as const,
            }
          }

          // Unsubscribe the contact
          await unsubscribeContact(email, `SES Suppression: ${reason}`)

          return {
            email,
            reason,
            dateAdded,
            action: 'unsubscribed' as const,
          }
        } catch (error: any) {
          return {
            email,
            reason,
            dateAdded,
            action: 'error' as const,
            error: error.message || 'Unknown error',
          }
        }
      })
    )

    // Summarize results
    const summary = {
      total: results.length,
      unsubscribed: results.filter((r) => r.action === 'unsubscribed').length,
      alreadyUnsubscribed: results.filter((r) => r.action === 'already_unsubscribed').length,
      notInContactList: results.filter((r) => r.action === 'not_in_contact_list').length,
      errors: results.filter((r) => r.action === 'error').length,
    }

    console.log('📧 Sync suppression results:', summary)

    return NextResponse.json({
      success: true,
      summary,
      results,
    })

  } catch (error) {
    console.error('❌ Error syncing suppression list:', error)
    return NextResponse.json(
      { error: 'Failed to sync suppression list' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ses/sync-suppression
 *
 * Same as GET but allows passing specific emails to check/unsubscribe
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - only admins can run this
    const session = await auth()
    if (!session?.user?.role || ![ROLES.ADMIN, ROLES.OWNER].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { emails } = body as { emails: string[] }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      )
    }

    const results: SyncResult[] = await Promise.all(
      emails.map(async (email) => {
        try {
          // Check if contact exists
          const contact = await getContact(email)

          if (!contact) {
            return {
              email,
              reason: 'manual',
              dateAdded: new Date().toISOString(),
              action: 'not_in_contact_list' as const,
            }
          }

          // Check if already unsubscribed
          if (contact.UnsubscribeAll) {
            return {
              email,
              reason: 'manual',
              dateAdded: new Date().toISOString(),
              action: 'already_unsubscribed' as const,
            }
          }

          // Unsubscribe the contact
          await unsubscribeContact(email, 'Manual suppression sync')

          return {
            email,
            reason: 'manual',
            dateAdded: new Date().toISOString(),
            action: 'unsubscribed' as const,
          }
        } catch (error: any) {
          return {
            email,
            reason: 'manual',
            dateAdded: new Date().toISOString(),
            action: 'error' as const,
            error: error.message || 'Unknown error',
          }
        }
      })
    )

    const summary = {
      total: results.length,
      unsubscribed: results.filter((r) => r.action === 'unsubscribed').length,
      alreadyUnsubscribed: results.filter((r) => r.action === 'already_unsubscribed').length,
      notInContactList: results.filter((r) => r.action === 'not_in_contact_list').length,
      errors: results.filter((r) => r.action === 'error').length,
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
    })

  } catch (error) {
    console.error('❌ Error processing manual suppression sync:', error)
    return NextResponse.json(
      { error: 'Failed to process suppression sync' },
      { status: 500 }
    )
  }
}
