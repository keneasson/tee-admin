import { NextRequest, NextResponse } from 'next/server'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'
import { sendEmail } from '../../../../../utils/email/sesClient'
import { maskEmail } from '../../../../../utils/mask-email'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { describeLock, remainingAttempts } from '@my/app/utils/email-change'

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
    // old → recoverable secondary (14-day grace), re-point the login index.
    const { oldEmail } = await personRepository.changePrimaryEmail(person.personId, newEmail)

    // Notify the OLD address — a paper trail + a path to raise the alarm.
    if (oldEmail && oldEmail !== newEmail.toLowerCase()) {
      try {
        await sendEmail({
          to: oldEmail,
          subject: 'Your login email was changed – TEE Admin',
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color:#333;">Your login email was changed</h2>
              <p>The login email for your Toronto East account was just changed to <strong>${maskEmail(newEmail)}</strong>.</p>
              <p>If this was you, no action is needed. This address stays on your account as a secondary for 14 days, then is archived.</p>
              <p style="color:#b00;"><strong>If this wasn't you</strong>, contact <a href="mailto:${SUPPORT_CONTACT}">${SUPPORT_CONTACT}</a> right away.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
              <p style="color:#999; font-size:12px;">Toronto East Christadelphian Ecclesia</p>
            </div>
          `,
          textBody: [
            'Your login email was changed',
            '',
            `The login email for your Toronto East account was just changed to ${maskEmail(newEmail)}.`,
            'If this was you, no action is needed. This address stays on your account as a secondary for 14 days, then is archived.',
            `If this wasn't you, contact ${SUPPORT_CONTACT} right away.`,
            '',
            'Toronto East Christadelphian Ecclesia',
          ].join('\n'),
        })
      } catch (e) {
        console.error('email-change notify old address failed (non-fatal):', e)
      }
    }

    return NextResponse.json({
      success: true,
      newEmail,
      message: 'Your login email has been changed. Please sign in again with your new address.',
    })
  } catch (error) {
    console.error('email-change/confirm error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
