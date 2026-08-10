import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import { sendEmail } from '../../../../../utils/email/sesClient'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'

/**
 * Resolve the acting person from the session login email (primary via GSI1, then
 * any-address fallback).
 */
async function resolveActingPerson(loginEmail: string) {
  const email = loginEmail.toLowerCase()
  let person = await personRepository.getByEmail(email)
  if (!person) {
    const persons = await personRepository.getAllPersonsByEmail(email)
    person = persons[0] || null
  }
  return person
}

/**
 * POST /api/user/emails/verify - Send verification email
 * Body: { emailId: string }
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

    // Sending a verification to an added address is an account edit — require a
    // fresh step-up (a recognized/forwarded-link session must not trigger sends).
    const gate = await requireFreshAuth()
    if (!gate.ok) return gate.response

    const body = await request.json()
    const { emailId } = body

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

    // Guard the target EMAIL# row exists and is still unverified.
    const emailRecord = await personRepository.getEmailById(person.personId, emailId)
    if (!emailRecord) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      )
    }

    if (emailRecord.verified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Mint a single-use verification token in the unified TokenRepository
    // (O(1) GSI4 lookup, atomic consume). Replaces the previous USER# token write.
    const token = await tokenRepository.createEmailVerification(person.personId, emailRecord.email)

    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
    const verificationUrl = `${baseUrl}/api/user/emails/verify?token=${token.tokenValue}`

    // Send verification email
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Verify Your Email Address</h2>
        <p>You've added this email address to your TEE Admin profile. Please click the button below to verify it:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}"
             style="background-color: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          If you didn't add this email address to your profile, you can safely ignore this message.
        </p>
        <p style="color: #666; font-size: 14px;">
          This link will expire in 24 hours.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
          Toronto East Christadelphian Ecclesia
        </p>
      </div>
    `

    const textBody = `
Verify Your Email Address

You've added this email address to your TEE Admin profile. Please visit the link below to verify it:

${verificationUrl}

If you didn't add this email address to your profile, you can safely ignore this message.

This link will expire in 24 hours.

Toronto East Christadelphian Ecclesia
    `.trim()

    await sendEmail({
      to: emailRecord.email,
      subject: 'Verify Your Email Address - TEE Admin',
      body: emailBody,
      textBody,
    })

    return NextResponse.json({
      success: true,
      message: 'Verification email sent',
    })
  } catch (error) {
    console.error('Send verification error:', error)
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/emails/verify?token=xxx - Verify email with token (link click,
 * UNauthenticated). Consumes the unified token, then marks the matching
 * PersonRecord EMAIL# row verified. Falls back to the legacy USER# token store
 * for one release, to drain in-flight links minted before this change.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return redirectWithMessage('error', 'Invalid verification link')
    }

    // Primary path: unified TokenRepository (O(1), atomic single-use).
    const result = await tokenRepository.verifyAndConsume(token, 'email_verification')
    if (result.valid && result.token) {
      await personRepository.markEmailVerifiedByAddress(result.token.personId, result.token.email)
      return redirectWithMessage('success', 'Email verified successfully!')
    }

    // Token found but not consumable — report the reason without falling back.
    if (result.token) {
      if (result.error === 'expired') {
        return redirectWithMessage('error', 'Verification link has expired. Please request a new one.')
      }
      return redirectWithMessage('error', 'Invalid or expired verification link')
    }

    // FALLBACK (drain window): no unified token → try the legacy USER# store for
    // links minted before this release. Keep the `pkey` crash-fix.
    const emailRecord = await userRepository.getEmailByToken(token)
    if (!emailRecord) {
      return redirectWithMessage('error', 'Invalid or expired verification link')
    }

    if (emailRecord.verificationTokenExpiry) {
      const expiry = new Date(emailRecord.verificationTokenExpiry)
      if (expiry < new Date()) {
        return redirectWithMessage('error', 'Verification link has expired. Please request a new one.')
      }
    }

    // Records are stored with the legacy `pkey` attribute (not `PK`), so
    // `emailRecord.PK` is undefined at runtime — read `pkey` defensively and
    // guard a missing key rather than throwing a misleading generic error.
    const storedPk = (emailRecord as { pkey?: string; PK?: string }).pkey ?? emailRecord.PK
    if (!storedPk) {
      return redirectWithMessage('error', 'Invalid or expired verification link')
    }
    const primaryEmail = storedPk.replace('USER#', '')

    // Mark legacy record verified + clear token.
    await userRepository.updateEmail(primaryEmail, emailRecord.emailId, {
      verified: true,
      verificationToken: undefined,
      verificationTokenExpiry: undefined,
    })

    // Also heal the PersonRecord so the single system agrees. Best-effort.
    try {
      const owner = await resolveActingPerson(primaryEmail)
      if (owner) {
        await personRepository.markEmailVerifiedByAddress(owner.personId, emailRecord.email)
      }
    } catch (healErr) {
      console.error('[user/emails/verify] PersonRecord heal on legacy verify failed (non-fatal):', healErr)
    }

    return redirectWithMessage('success', 'Email verified successfully!')
  } catch (error) {
    console.error('Verify email error:', error)
    return redirectWithMessage('error', 'Verification failed. Please try again.')
  }
}

function redirectWithMessage(status: 'success' | 'error', message: string) {
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
  const redirectUrl = `${baseUrl}/profile?verification=${status}&message=${encodeURIComponent(message)}`
  return NextResponse.redirect(redirectUrl)
}
