import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import { getPublicOptInCount } from '../../../../utils/email/public-topics'
import { requireFreshAuth } from '../../../../utils/require-fresh-auth'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Resolve the acting person from the session login email. Prefers the O(1)
 * primary-email GSI1 lookup, then falls back to any-address match so a login on
 * a secondary still resolves the owner.
 */
async function resolveActingPerson(loginEmail: string): Promise<PersonRecord | null> {
  const email = loginEmail.toLowerCase()
  let person = await personRepository.getByEmail(email)
  if (!person) {
    const persons = await personRepository.getAllPersonsByEmail(email)
    person = persons[0] || null
  }
  return person
}

/**
 * GET /api/user/emails - Get all emails for current user
 * Sourced from PersonRecord EMAIL# rows (the single system). Lazily heals any
 * historical USER#-only addresses onto the PersonRecord on read.
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

    const loginEmail = session.user.email.toLowerCase()
    const person = await resolveActingPerson(loginEmail)

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

    let emails: ClientEmail[] = []

    if (person) {
      // Lazy-migrate: fold any USER#-only addresses into the PersonRecord. This is
      // per-session, additive and idempotent — it heals historical addresses that
      // only ever lived in the legacy USER# store (no data loss, no batch job).
      try {
        const [personEmails, legacy] = await Promise.all([
          personRepository.getEmails(person.personId),
          userRepository.getEmails(loginEmail),
        ])
        const known = new Set(personEmails.map(e => e.email.toLowerCase()))
        for (const legacyEmail of legacy.items) {
          const addr = legacyEmail.email.toLowerCase()
          if (known.has(addr)) continue
          await personRepository.addEmail(person.personId, {
            email: addr,
            emailType: legacyEmail.isPrimary ? 'primary' : 'secondary',
            order: legacyEmail.order ?? known.size,
            verified: !!legacyEmail.verified,
            sesSubscribed: legacyEmail.subscribed ?? false,
            sesStatus: 'active',
          })
          known.add(addr)
        }
      } catch (migrateErr) {
        console.error('[user/emails] lazy-migrate of legacy USER# emails failed (non-fatal):', migrateErr)
      }

      // Re-read so freshly-healed rows are included in the response.
      const personEmails = await personRepository.getEmails(person.personId)

      // Derive "verification pending" from an active email_verification token for
      // the address (createEmailVerification keeps at most one per person). No
      // schema field needed — the token IS the pending state.
      const pendingByEmail = new Map<string, string>()
      try {
        const tokens = await tokenRepository.getByPersonAndType(person.personId, 'email_verification')
        const now = Date.now()
        for (const t of tokens) {
          if (t.usedAt) continue
          if (new Date(t.expiresAt).getTime() < now) continue
          pendingByEmail.set(t.email.toLowerCase(), t.createdAt)
        }
      } catch (tokErr) {
        console.error('[user/emails] deriving verificationSentAt failed (non-fatal):', tokErr)
      }

      const sorted = [...personEmails].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      emails = await Promise.all(
        sorted.map(async (email) => ({
          id: email.emailId,
          email: email.email,
          verified: email.verified,
          verificationSentAt: pendingByEmail.get(email.email.toLowerCase()),
          subscribed: email.sesSubscribed,
          // How many public mailing lists this address is opted into (verified
          // addresses only — no point querying SES for an unverified one).
          subscriptionCount: email.verified ? await getPublicOptInCount(email.email) : undefined,
          isPrimary: email.emailType === 'primary',
        }))
      )
    }

    // If nothing is stored yet, seed with the login email.
    if (emails.length === 0) {
      emails = [
        {
          id: 'primary',
          email: loginEmail,
          verified: true, // Login email is verified by definition
          subscribed: true,
          subscriptionCount: await getPublicOptInCount(loginEmail),
          isPrimary: true,
        },
      ]
    }

    // Surface the Recording Brother ECCLESIA email. It lives on the PersonRecord
    // (`rbEcclesiaEmail`), NOT the personal email set, so it never appeared here —
    // yet the RB genuinely receives on it. Shown read-only: it's a role address,
    // managed via the ecclesia / RB settings, not deletable from a personal profile.
    try {
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
 * PUT /api/user/emails - Reorder emails ("set as preferred" moves an address to
 * the front). Order is the array index. Display order only — never an identity
 * transfer, so the primary login email is untouched.
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
    const { emails } = body as { emails: Array<{ id: string; email: string }> }

    if (!Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails must be an array' },
        { status: 400 }
      )
    }

    const person = await resolveActingPerson(session.user.email)
    if (!person) {
      return NextResponse.json(
        { error: 'No profile found for your account' },
        { status: 404 }
      )
    }

    // Only reorder real EMAIL# rows — filter out synthetic ids (seeded 'primary',
    // read-only 'rb-ecclesia') and anything not on this person.
    const personEmails = await personRepository.getEmails(person.personId)
    const validIds = new Set(personEmails.map(e => e.emailId))
    const orderedIds = emails.map(e => e.id).filter(id => validIds.has(id))

    await personRepository.setEmailOrder(person.personId, orderedIds)

    return NextResponse.json({
      success: true,
      message: 'Email addresses updated',
      count: orderedIds.length,
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
 * POST /api/user/emails - Add a new secondary email to the acting person.
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

    const person = await resolveActingPerson(session.user.email)
    if (!person) {
      return NextResponse.json(
        { error: 'No profile found for your account' },
        { status: 404 }
      )
    }

    // Dup-check against THIS person's existing addresses (PersonRecord is the
    // single source of truth now).
    const personEmails = await personRepository.getEmails(person.personId)
    if (personEmails.some(e => e.email.toLowerCase() === normalized)) {
      return NextResponse.json(
        { error: 'This email address is already added' },
        { status: 409 }
      )
    }

    // Collision guard: never attach an address that already belongs to a
    // DIFFERENT person — silently doing so would merge two identities.
    const owners = await personRepository.getAllPersonsByEmail(normalized)
    if (owners.some(p => p.personId !== person.personId)) {
      return NextResponse.json(
        { error: 'That email is already associated with another person in the directory.' },
        { status: 409 }
      )
    }

    const record = await personRepository.addEmail(person.personId, {
      email: normalized,
      emailType: 'secondary',
      order: personEmails.length,
      verified: false,
      sesSubscribed: false,
      sesStatus: 'active',
    })

    return NextResponse.json({
      success: true,
      emailId: record.emailId,
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
 * DELETE /api/user/emails - Delete a secondary email
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

    const person = await resolveActingPerson(session.user.email)
    if (!person) {
      return NextResponse.json(
        { error: 'No profile found for your account' },
        { status: 404 }
      )
    }

    // Verify the email exists and is not the primary login address.
    const target = await personRepository.getEmailById(person.personId, emailId)
    if (!target) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    if (target.emailType === 'primary') {
      return NextResponse.json(
        { error: 'Cannot delete your primary login email' },
        { status: 400 }
      )
    }

    await personRepository.removeEmail(person.personId, emailId)

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
