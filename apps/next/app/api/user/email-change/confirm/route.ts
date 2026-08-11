import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'
import { sendEmail } from '../../../../../utils/email/sesClient'
import { getTenantFromHeaders, resolveTenantFromEnv } from '@my/app/config/tenants'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { describeLock, remainingAttempts } from '@my/app/utils/email-change'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

const SUPPORT_CONTACT = 'teerecbro@gmail.com'

/**
 * POST /api/user/email-change/confirm — complete a login-email change.
 *
 * Gated by a fresh step-up (origin). Verifies the code sent to the new address
 * (destination), enforcing the persistent escalating lockout. On success it
 * transfers the login identity to the new address (old one demoted with a grace
 * window) and notifies the OLD address so an unwanted change is caught.
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
    const code = String(body?.code ?? '')
    if (!code.trim()) {
      return NextResponse.json({ error: 'Enter the code we emailed you.' }, { status: 400 })
    }

    const person = await personRepository.getByEmail(currentEmail)
    if (!person) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    const result = await tokenRepository.verifyEmailChangeCode(person.personId, code)

    if (!result.valid) {
      const now = Date.now()
      if (result.error === 'locked' && result.lockout) {
        const d = describeLock(result.lockout, now)
        return NextResponse.json(
          {
            error: d.permanent
              ? `Too many incorrect codes. For your security this change is locked — please contact ${SUPPORT_CONTACT} to continue.`
              : 'Too many incorrect codes. Please wait before trying again.',
            locked: true,
            permanent: d.permanent,
            lockedUntil: d.permanent ? null : d.until,
          },
          { status: 429 }
        )
      }
      if (result.error === 'invalid_code') {
        const remaining = result.lockout ? remainingAttempts(result.lockout) : undefined
        return NextResponse.json(
          {
            error:
              remaining && remaining > 0
                ? `That code isn't right — ${remaining} ${remaining === 1 ? 'try' : 'tries'} left before a temporary lock.`
                : "That code isn't right.",
          },
          { status: 400 }
        )
      }
      // not_found / expired / already_used
      return NextResponse.json(
        { error: 'That code has expired or was already used. Start the change again to get a new one.' },
        { status: 400 }
      )
    }

    const newEmail = result.newEmail
    if (!newEmail) {
      // Shouldn't happen (a valid email_change token always carries newEmail).
      return NextResponse.json({ error: 'Something went wrong. Please start again.' }, { status: 500 })
    }

    // The identity transfer itself (PersonRecords): promote new → primary, demote
    // old → recoverable secondary (30-day grace), re-point the login index.
    const { oldEmail } = await personRepository.changePrimaryEmail(person.personId, newEmail)

    // Notify the OLD address — a paper trail + a path to raise the alarm. Brand-aware,
    // and shows the NEW address IN FULL: we're writing to the account owner about
    // their own change, so masking the very address we just moved them to helps no
    // one (and the old address stays a valid login for the 30-day grace, so they can
    // still sign in and undo, or reply to this mail).
    if (oldEmail && oldEmail !== newEmail.toLowerCase()) {
      try {
        const tenant = getTenantFromHeaders(request.headers) ?? resolveTenantFromEnv()
        const brandName = tenant.senderDisplayName || tenant.publicName
        const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
        const proto =
          request.headers.get('x-forwarded-proto') ||
          (host && host.startsWith('localhost') ? 'http' : 'https')
        const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com')
        await sendEmail({
          to: oldEmail,
          subject: `Your email address on ${brandName} was just changed`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <p>Your email address on <strong>${brandName}</strong> has just been changed to:
                 <strong>${newEmail}</strong>.</p>
              <p>If you didn't make this change, please
                 <a href="${baseUrl}/profile">sign in and undo it</a>, or reply to this email with
                 &ldquo;I didn't make this change&rdquo;.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
              <p style="color:#999; font-size:12px;">${brandName}</p>
            </div>
          `,
          textBody: [
            `Your email address on ${brandName} has just been changed to: ${newEmail}`,
            '',
            `If you didn't make this change, sign in and undo it (${baseUrl}/profile), or reply to this email with "I didn't make this change".`,
            '',
            brandName,
          ].join('\n'),
        })
      } catch (e) {
        console.error('email-change notify old address failed (non-fatal):', e)
      }
    }

    return NextResponse.json({
      success: true,
      newEmail,
      message: 'Your login email has been updated. You’re still signed in — nothing else to do.',
    })
  } catch (error) {
    console.error('email-change/confirm error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
