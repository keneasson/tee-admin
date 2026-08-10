import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '../../../../utils/auth'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
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
    type ClientEmail = {
      id: string
      email: string
      verified: boolean
      verificationSentAt?: string
      subscribed?: boolean
      subscriptionCount?: number
      isPrimary?: boolean
      /** A role this address represents (e.g. Recording Brother) — shown read-only. */
      roleLabel?: string
    }
    const sorted = result.items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    let emails: ClientEmail[] = await Promise.all(
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

    // If nothing is stored yet, seed with the login email.
    if (emails.length === 0) {
      emails = [
        {
          id: 'primary',
          email: session.user.email,
          verified: true, // Login email is verified by definition
          subscribed: true,
          subscriptionCount: await getPublicOptInCount(session.user.email),
          isPrimary: true,
        },
      ]
    }

    // Surface the Recording Brother ECCLESIA email. It lives on the PersonRecord
    // (`rbEcclesiaEmail`), NOT the USER# email store, so it never appeared here —
    // yet the RB genuinely receives on it. Shown read-only: it's a role address,
    // managed via the ecclesia / RB settings, not deletable from a personal profile.
    try {
      const person = await personRepository.getByEmail(session.user.email.toLowerCase())
      const rbEmail = person?.isRecordingBrother ? person.rbEcclesiaEmail?.toLowerCase() : undefined
      if (rbEmail && !emails.some((e) => e.email.toLowerCase() === rbEmail)) {
        emails.push({
          id: 'rb-ecclesia',
          email: rbEmail,
          verified: true,
          isPrimary: false,
          subscriptionCount: await getPublicOptInCount(rbEmail),
          roleLabel: 'Recording Brother',
        })
      }
    } catch (rbErr) {
      console.error('Surface RB ecclesia email failed (non-fatal):', rbErr)
    }

    return NextResponse.json({ success: true, emails })
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

    const normalized = email.toLowerCase()

    // Check if email already exists (legacy USER# store)
    const existing = await userRepository.getEmails(session.user.email)
    if (existing.items.some(e => e.email.toLowerCase() === normalized)) {
      return NextResponse.json(
        { error: 'This email address is already added' },
        { status: 409 }
      )
    }

    // Resolve the acting person, and guard against attaching an address that
    // already belongs to a DIFFERENT person — silently doing so would merge two
    // identities. (Resolves via any address now that getByEmail sees secondaries.)
    const person = await personRepository.getByEmail(session.user.email.toLowerCase())
    if (person) {
      const owners = await personRepository.getAllPersonsByEmail(normalized)
      if (owners.some(p => p.personId !== person.personId)) {
        return NextResponse.json(
          { error: 'That email is already associated with another person in the directory.' },
          { status: 409 }
        )
      }
    }

    const emailId = generateEmailId()
    const order = existing.items.length

    await userRepository.addEmail(session.user.email, {
      emailId,
      email: normalized,
      verified: false,
      order,
      isPrimary: false,
    })

    // Mirror the address onto the PersonRecord as a SECONDARY EMAIL# item, so it
    // resolves (via GSI1) to this person. Without this the verify/lookup flow
    // can't find the owner and mints a duplicate orphan profile. Best-effort:
    // never fail the request if this half hiccups (the USER# add already stuck).
    if (person) {
      try {
        const pEmails = await personRepository.getEmails(person.personId)
        const alreadyOnPerson = pEmails.some(e => e.email.toLowerCase() === normalized)
        if (!alreadyOnPerson) {
          await personRepository.addEmail(person.personId, {
            email: normalized,
            emailType: 'secondary',
            order: pEmails.length,
            verified: false,
            sesSubscribed: false,
            sesStatus: 'active',
          })
        }
      } catch (err) {
        console.error('[user/emails] failed to mirror secondary email to PersonRecord:', err)
      }
    }

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
