import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * Resolve the acting person from the session login email — primary-email GSI1
 * fast-path, then any-address fallback (mirrors the sibling email-change routes).
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
 * POST /api/user/email-change/undo — restore a demoted former-primary address.
 *
 * "Changed by mistake?" recovery: clears the `archiveAfter` on a retired
 * (demoted-to-secondary) address so it becomes a permanent secondary again.
 *
 * Deliberately LOW friction: session gate + the launch-dark flag only, NO fresh
 * step-up. Restoring an address that already belongs to this account (keeping it
 * from being archived) is not a sensitive identity transfer — the risky direction
 * (moving the login handle away) is what start/confirm gate with a step-up. Adding
 * friction here would only discourage people from undoing a genuine mistake.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Launch-dark: same flag the other email-change routes enforce — 404 when off.
    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.SECURE_EMAIL_CHANGE, session as any)
    if (!flagOn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const emailId = String(body?.emailId ?? '').trim()
    if (!emailId) {
      return NextResponse.json({ error: 'emailId is required' }, { status: 400 })
    }

    const person = await resolveActingPerson(session.user.email)
    if (!person) {
      return NextResponse.json({ error: 'No profile found for your account' }, { status: 404 })
    }

    try {
      await personRepository.undoEmailRetire(person.personId, emailId)
    } catch (err) {
      // not-found / primary → a bad request against this account's own data.
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Could not restore this address.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('email-change/undo error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
