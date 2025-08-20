import { NextRequest, NextResponse } from 'next/server'
import {
  findCredentialsUserByEmail,
  createEmailVerificationToken,
} from '../../../../utils/dynamodb/credentials-users'
import { sendVerificationEmail } from '../../../../utils/email/send-verification-email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Check if user exists and is unverified (but don't reveal this information for security)
    const user = await findCredentialsUserByEmail(email)

    if (user && !user.emailVerified) {
      // Create new verification token
      const verificationToken = await createEmailVerificationToken(email)

      // Send verification email
      await sendVerificationEmail(email, verificationToken, user.name)
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message:
        'If an unverified account with that email exists, we have sent verification instructions.',
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
