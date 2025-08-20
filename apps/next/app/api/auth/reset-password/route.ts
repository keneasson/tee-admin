import { NextRequest, NextResponse } from 'next/server'
import { validatePassword } from '../../../../utils/password'
import {
  validatePasswordResetToken,
  resetPassword,
} from '../../../../utils/dynamodb/credentials-users'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    // Validate password
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: 'Password requirements not met', details: passwordValidation.errors },
        { status: 400 }
      )
    }

    // Validate the reset token
    const tokenData = await validatePasswordResetToken(token)
    if (!tokenData) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    // Reset the password
    const success = await resetPassword(token, password)

    if (!success) {
      return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
