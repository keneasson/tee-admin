import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '../../../../../utils/auth'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import { sendEmail } from '../../../../../utils/email/sesClient'
import { requireFreshAuth } from '../../../../../utils/require-fresh-auth'

// Token expiry: 24 hours
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000

// Generate secure verification token
function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
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

    // Get the email record
    const emailRecord = await userRepository.getEmail(session.user.email, emailId)
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

    // Generate token and expiry
    const token = generateVerificationToken()
    const expiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

    // Update the email record with verification token
    await userRepository.updateEmail(session.user.email, emailId, {
      verificationToken: token,
      verificationTokenExpiry: expiry,
      verificationSentAt: new Date().toISOString(),
    })

    // Build verification URL
    const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
    const verificationUrl = `${baseUrl}/api/user/emails/verify?token=${token}`

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
 * GET /api/user/emails/verify?token=xxx - Verify email with token
 * This is called when user clicks the link in their email
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return redirectWithMessage('error', 'Invalid verification link')
    }

    // Find email by token
    const emailRecord = await userRepository.getEmailByToken(token)
    if (!emailRecord) {
      return redirectWithMessage('error', 'Invalid or expired verification link')
    }

    // Check if token has expired
    if (emailRecord.verificationTokenExpiry) {
      const expiry = new Date(emailRecord.verificationTokenExpiry)
      if (expiry < new Date()) {
        return redirectWithMessage('error', 'Verification link has expired. Please request a new one.')
      }
    }

    // Extract primary email from the partition key (format: USER#{primaryEmail}).
    // These records are stored with the legacy `pkey` attribute (not `PK`), so
    // `emailRecord.PK` is undefined at runtime — reading `.replace` off it threw a
    // TypeError that the catch below rendered as the misleading "Verification
    // failed. Please try again." Read `pkey` defensively and guard a missing key.
    const storedPk = (emailRecord as { pkey?: string; PK?: string }).pkey ?? emailRecord.PK
    if (!storedPk) {
      return redirectWithMessage('error', 'Invalid or expired verification link')
    }
    const primaryEmail = storedPk.replace('USER#', '')

    // Mark email as verified and clear token
    await userRepository.updateEmail(primaryEmail, emailRecord.emailId, {
      verified: true,
      verificationToken: undefined,
      verificationTokenExpiry: undefined,
    })

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
