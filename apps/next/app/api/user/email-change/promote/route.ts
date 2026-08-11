import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'
import { notifyLoginEmailChanged } from '../../../../../utils/email/notify-login-email-changed'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

/**
 * POST /api/user/email-change/promote — the fast-path for making an
 * ALREADY-VERIFIED secondary address the login identity.
 *
 * Unlike the code-based change flow (start → confirm), there is no confirmation
 * code: the address is already verified on this account, so re-mailing a code to
 * it would prove nothing. We still require a FRESH step-up (origin proof — the
 * operator has just re-proven control of the account) via requireFreshAuth, then
 * promote immediately and notify the OLD address.
 */
export async function POST(request: NextRequest) {
  try {
    const gate = await requireFreshAuth()
    if (!gate.ok) return gate.response
    const currentEmail = gate.ctx.email
    if (!currentEmail) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Launch-dark: the feature stays invisible (404) until deliberately enabled.
    const flagOn = await checkFeatureFlagFromDB(FEATURE_FLAGS.SECURE_EMAIL_CHANGE, (await auth()) as any)
    if (!flagOn) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Enter the address to make your login.' }, { status: 400 })
    }

    // Resolve the acting person the same way the sibling routes do.
    const person =
      (await personRepository.getByEmail(currentEmail)) ??
      (await personRepository.getAllPersonsByEmail(currentEmail))[0]
    if (!person) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    // The address must already be one of THIS account's EMAIL# rows, verified, and
    // not already the login — those are the only rows for which a no-code promote
    // is safe.
    const rows = await personRepository.getEmails(person.personId)
    const row = rows.find((r) => r.email.toLowerCase() === email)
    if (!row) {
      return NextResponse.json({ error: "That address isn't on your account." }, { status: 400 })
    }
    if (row.verified !== true) {
      return NextResponse.json(
        { error: 'Verify this address before making it your login.' },
        { status: 400 }
      )
    }
    if (row.emailType === 'primary') {
      return NextResponse.json({ error: "That's already your login email." }, { status: 400 })
    }

    // Identity transfer (PersonRecords): promote the verified secondary → primary,
    // demote the old primary → recoverable secondary (30-day grace), re-point login.
    const { oldEmail } = await personRepository.changePrimaryEmail(person.personId, row.email)

    // Notify the OLD address (best-effort). Skip if there was no distinct old address.
    if (oldEmail && oldEmail !== row.email.toLowerCase()) {
      await notifyLoginEmailChanged({ oldEmail: oldEmail ?? '', newEmail: row.email, headers: request.headers })
    }

    return NextResponse.json({ success: true, newEmail: row.email })
  } catch (error) {
    console.error('email-change/promote error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
