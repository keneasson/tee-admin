import { NextRequest, NextResponse } from 'next/server'
import {
  ListSuppressedDestinationsCommand,
  ListSuppressedDestinationsRequest,
  DeleteSuppressedDestinationCommand,
} from '@aws-sdk/client-sesv2'
import { getSesClient } from '../../../../utils/email/sesClient'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export interface SuppressedEmail {
  email: string
  reason: 'BOUNCE' | 'COMPLAINT' | string
  dateAdded: string
}

/**
 * GET /api/ses/suppression-list
 *
 * Fetches the SES account-level suppression list for display in the UI.
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication - only admins can view this
    const session = await auth()
    if (!session?.user?.role || ![ROLES.ADMIN, ROLES.OWNER].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const client = getSesClient()
    const suppressedEmails: SuppressedEmail[] = []

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
        for (const item of response.SuppressedDestinationSummaries) {
          if (item.EmailAddress) {
            suppressedEmails.push({
              email: item.EmailAddress,
              reason: item.Reason || 'UNKNOWN',
              dateAdded: item.LastUpdateTime?.toISOString() || 'unknown',
            })
          }
        }
      }

      nextToken = response.NextToken
    } while (nextToken)

    // Sort by date added (newest first)
    suppressedEmails.sort((a, b) => {
      if (a.dateAdded === 'unknown') return 1
      if (b.dateAdded === 'unknown') return -1
      return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    })

    return NextResponse.json({
      success: true,
      count: suppressedEmails.length,
      suppressedEmails,
    })

  } catch (error) {
    console.error('❌ Error fetching suppression list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppression list' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/ses/suppression-list
 *
 * Removes an email from the SES suppression list.
 * Use with caution - only remove if you're sure the email is valid now.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication - only admins can do this
    const session = await auth()
    if (!session?.user?.role || ![ROLES.ADMIN, ROLES.OWNER].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'email parameter is required' },
        { status: 400 }
      )
    }

    const client = getSesClient()
    const command = new DeleteSuppressedDestinationCommand({
      EmailAddress: email,
    })

    await client.send(command)

    console.log(`✅ Removed ${email} from SES suppression list`)

    return NextResponse.json({
      success: true,
      message: `Removed ${email} from suppression list`,
    })

  } catch (error: any) {
    console.error('❌ Error removing from suppression list:', error)

    if (error.name === 'NotFoundException') {
      return NextResponse.json(
        { error: 'Email not found in suppression list' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to remove from suppression list' },
      { status: 500 }
    )
  }
}
