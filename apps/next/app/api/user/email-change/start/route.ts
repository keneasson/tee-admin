import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'
import { sendEmail } from '../../../../../utils/email/sesClient'
import { maskEmail } from '../../../../../utils/mask-email'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { codeFromBytes, EMAIL_CHANGE_CODE_LENGTH } from '@my/app/utils/email-change'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * POST /api/user/email-change/start — begin a login-email change.
 *
 * Gated by a FRESH step-up (origin proof — the operator has just re-proven
 * control of the account). Sends a confirmation code to the NEW address so the
 * operator must also prove they can receive there (destination proof) before the
 * identity actually transfers. Nothing changes here except a pending code.
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
    const newEmail = String(body?.newEmail ?? '').trim().toLowerCase()

    if (!newEmail || !isValidEmail(newEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }
    if (newEmail === currentEmail.toLowerCase()) {
      return NextResponse.json(
        { error: 'That is already your login email.' },
        { status: 400 }
      )
    }

    const person = await personRepository.getByEmail(currentEmail)
    if (!person) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    }

    // Guard against colliding with a DIFFERENT account's login handle.
    const ownerOfNew = await personRepository.getByEmail(newEmail)
    if (ownerOfNew && ownerOfNew.personId !== person.personId) {
      return NextResponse.json(
        { error: 'That email address is already associated with another account and cannot be used.' },
        { status: 409 }
      )
    }

    // Light resend throttle: one active code per person, min 60s between sends.
    const existing = await tokenRepository.findActiveEmailChangeToken(person.personId)
    if (existing && Date.now() - new Date(existing.createdAt).getTime() < 60 * 1000) {
      return NextResponse.json(
        { error: 'A code was just sent. Please wait a moment before trying again.' },
        { status: 429 }
      )
    }

    // 6 chars over the confusable-free alphabet (crypto randomness supplied here).
    const code = codeFromBytes(randomBytes(EMAIL_CHANGE_CODE_LENGTH), EMAIL_CHANGE_CODE_LENGTH)
    await tokenRepository.createEmailChangeCode(person.personId, newEmail, code)

    await sendEmail({
      to: newEmail,
      subject: 'Confirm your new email address – TEE Admin',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color:#333;">Confirm your new email address</h2>
          <p>You're changing the login email for your Toronto East account to <strong>this</strong> address. Enter this code to confirm:</p>
          <p style="font-size:28px; font-weight:bold; letter-spacing:4px; margin:24px 0;">${code}</p>
          <p style="color:#666; font-size:14px;">This code expires in 15 minutes. If you didn't request this change, you can safely ignore this email — nothing will change.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
          <p style="color:#999; font-size:12px;">Toronto East Christadelphian Ecclesia</p>
        </div>
      `,
      textBody: [
        'Confirm your new email address',
        '',
        "You're changing the login email for your Toronto East account to this address.",
        `Enter this code to confirm: ${code}`,
        '',
        "This code expires in 15 minutes. If you didn't request this change, ignore this email — nothing will change.",
        '',
        'Toronto East Christadelphian Ecclesia',
      ].join('\n'),
    })

    return NextResponse.json({ success: true, newEmailMasked: maskEmail(newEmail) })
  } catch (error) {
    console.error('email-change/start error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
