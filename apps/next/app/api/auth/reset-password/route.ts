import { NextRequest, NextResponse } from 'next/server'
import { validatePassword } from '../../../../utils/password'
import {
  validatePasswordResetToken,
  resetPassword,
  deletePasswordResetToken,
} from '../../../../utils/dynamodb/credentials-users'
import { hashPassword } from '../../../../utils/password'
import { personPasswordPathOn } from '../../../../utils/password-signin'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // With person_password_signin on, sign-in reads the PersonRecord password,
    // so the reset must write it there (the legacy record is kept in step as
    // the rollback path).
    const person = await personRepository.getByEmail(tokenData.email)
    if (person && (await personPasswordPathOn(tokenData.email.toLowerCase(), person))) {
      await personRepository.updatePassword(person.personId, await hashPassword(password))
      const legacyUpdated = await resetPassword(token, password)
      if (!legacyUpdated) await deletePasswordResetToken(token)
      return NextResponse.json({
        success: true,
        message: 'Password reset successfully! You can now sign in with your new password.',
      })
    }

    // Reset the password
    const success = await resetPassword(token, password)
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to reset password' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.',
    })

  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}