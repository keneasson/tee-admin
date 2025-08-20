import { NextRequest, NextResponse } from 'next/server'
import {
  findCredentialsUserByEmail,
  createPasswordResetToken,
} from '../../../../utils/dynamodb/credentials-users'
import { sendPasswordResetEmail } from '../../../../utils/email/send-verification-email'

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

    console.log('Forgot password request for email:', email)

    // Check if user exists (but don't reveal this information for security)
    const user = await findCredentialsUserByEmail(email)
    console.log('User found:', !!user, user ? `ID: ${user.id}, Name: ${user.name}` : 'No user')

    if (user) {
      try {
        console.log('Creating password reset token...')
        // Create password reset token
        const resetToken = await createPasswordResetToken(email)
        console.log('Password reset token created:', resetToken)

        // Send password reset email
        const userName = user.name || `${user.firstName} ${user.lastName}` || 'User'
        console.log('Attempting to send password reset email to:', email, 'for user:', userName)
        await sendPasswordResetEmail(email, resetToken, userName)
        console.log('Password reset email sent successfully')
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError)
        if (emailError instanceof Error) {
          console.error('Error details:', emailError.message, emailError.stack)
        }
        // Continue execution - don't reveal email sending failures for security
      }
    } else {
      console.log('No credentials user found for email:', email)
    }

    // Always return success to prevent email enumeration attacks
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, we have sent password reset instructions.',
    })
  } catch (error) {
    console.error('Password reset request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
