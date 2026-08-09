import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '../../../../utils/auth'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import { sendEmail } from '../../../../utils/email/sesClient'
import { getPublicOptInCount } from '../../../../utils/email/public-topics'
import { requireFreshAuth } from '../../../../utils/require-fresh-auth'

// Generate a simple unique ID
function generateEmailId(): string {
  return `email-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Generate secure verification token
function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}

// Token expiry: 24 hours
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * GET /api/user/emails - Get all emails for current user
 * Returns emails sorted by order (first = preferred)
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const result = await userRepository.getEmails(session.user.email)

    // Sort by order and transform to client format
    // Always include the primary login email
    const sorted = result.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    const emails = await Promise.all(
      sorted.map(async (email) => ({
        id: email.emailId,
        email: email.email,
        verified: email.verified,
        verificationSentAt: email.verificationSentAt,
        subscribed: email.subscribed,
        // How many public mailing lists this address is opted into (verified
        // addresses only — no point querying SES for an unverified one).
        subscriptionCount: email.verified ? await getPublicOptInCount(email.email) : undefined,
        isPrimary: email.isPrimary,
      }))
    )

    // If no emails stored, create entry for primary login email
    if (emails.length === 0) {
      const primaryEmail = {
        id: 'primary',
        email: session.user.email,
        verified: true, // Login email is verified by definition
        subscribed: true, // Assume subscribed by default
        subscriptionCount: await getPublicOptInCount(session.user.email),
        isPrimary: true,
      }
      return NextResponse.json({
        success: true,
        emails: [primaryEmail],
      })
    }

    return NextResponse.json({
      success: true,
      emails,
    })
  } catch (error) {
    console.error('Get emails error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/emails - Replace all emails (batch update with ordering)
 * Body: { emails: Array<{ id: string, email: string, verified?: boolean }> }
 * Order is determined by array index (first = preferred)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Editing the email set is a sensitive account change — require fresh step-up.
    const gate = await requireFreshAuth()
    if (!gate.ok) return gate.response

    const body = await request.json()
    const { emails } = body as { emails: Array<{ id: string; email: string; verified?: boolean; isPrimary?: boolean; subscribed?: boolean }> }

    if (!Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails must be an array' },
        { status: 400 }
      )
    }

    // Validate each email
    for (const email of emails) {
      if (email.email && !isValidEmail(email.email)) {
        return NextResponse.json(
          { error: `Invalid email address: ${email.email}` },
          { status: 400 }
        )
      }
    }

    // Get existing emails to preserve verification status
    const existing = await userRepository.getEmails(session.user.email)
    const existingByEmail = new Map(existing.items.map(e => [e.email.toLowerCase(), e]))

    // Ensure primary login email is always included
    let hasPrimary = emails.some(e => e.email.toLowerCase() === session.user.email?.toLowerCase())
    if (!hasPrimary) {
      // Add primary email at the start
      emails.unshift({
        id: 'primary',
        email: session.user.email,
        verified: true,
        isPrimary: true,
        subscribed: true,
      })
    }

    // Filter out empty emails and prepare for save
    const validEmails = emails
      .filter(e => e.email && isValidEmail(e.email))
      .map((email, index) => {
        const existingRecord = existingByEmail.get(email.email.toLowerCase())
        const isPrimaryLogin = email.email.toLowerCase() === session.user.email?.toLowerCase()

        return {
          emailId: email.id || generateEmailId(),
          email: email.email.toLowerCase(),
          verified: isPrimaryLogin ? true : (existingRecord?.verified ?? false),
          order: index,
          isPrimary: isPrimaryLogin,
          subscribed: existingRecord?.subscribed ?? true,
        }
      })

    await userRepository.replaceAllEmails(session.user.email, validEmails)

    return NextResponse.json({
      success: true,
      message: 'Email addresses updated',
      count: validEmails.length,
    })
  } catch (error) {
    console.error('Update emails error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/emails - Add a new email
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Adding an email is a sensitive account change — require fresh step-up.
    const gate = await requireFreshAuth()
    if (!gate.ok) return gate.response

    const body = await request.json()
    const { email } = body

    // Validate email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Valid email address is required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await userRepository.getEmails(session.user.email)
    if (existing.items.some(e => e.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json(
        { error: 'This email address is already added' },
        { status: 409 }
      )
    }

    const emailId = generateEmailId()
    const order = existing.items.length

    await userRepository.addEmail(session.user.email, {
      emailId,
      email: email.toLowerCase(),
      verified: false,
      order,
      isPrimary: false,
    })

    return NextResponse.json({
      success: true,
      emailId,
      message: 'Email added. Please verify it.',
    })
  } catch (error) {
    console.error('Add email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/emails - Delete an email
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Removing an email is a sensitive account change — require fresh step-up.
    const gate = await requireFreshAuth()
    if (!gate.ok) return gate.response

    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('emailId')

    if (!emailId) {
      return NextResponse.json(
        { error: 'emailId is required' },
        { status: 400 }
      )
    }

    // Verify the email exists and is not the primary
    const existing = await userRepository.getEmail(session.user.email, emailId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    if (existing.isPrimary) {
      return NextResponse.json(
        { error: 'Cannot delete your primary login email' },
        { status: 400 }
      )
    }

    await userRepository.deleteEmail(session.user.email, emailId)

    return NextResponse.json({
      success: true,
      message: 'Email deleted',
    })
  } catch (error) {
    console.error('Delete email error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
