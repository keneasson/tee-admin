import { NextRequest, NextResponse } from 'next/server'
import { validatePassword } from '../../../../utils/password'
import {
  createCredentialsUser,
  findCredentialsUserByEmail,
  validateInvitationCode,
  createEmailVerificationToken,
} from '../../../../utils/dynamodb/credentials-users'
import { sendVerificationEmail } from '../../../../utils/email/send-verification-email'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, firstName, lastName, ecclesia, invitationCode } = body

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !ecclesia) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
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

    // Check if user already exists
    const existingUser = await findCredentialsUserByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Validate invitation code if provided
    let role = ROLES.GUEST
    let codeFirstName = firstName
    let codeLastName = lastName
    let codeEcclesia = ecclesia

    if (invitationCode) {
      const invitation = await validateInvitationCode(invitationCode)
      if (!invitation) {
        return NextResponse.json(
          { error: 'Invalid or expired invitation code' },
          { status: 400 }
        )
      }

      // Use the role and details from the invitation
      role = invitation.role
      codeFirstName = invitation.firstName
      codeLastName = invitation.lastName
      codeEcclesia = invitation.ecclesia
    }

    // Create the user
    const user = await createCredentialsUser({
      email,
      password,
      firstName: codeFirstName,
      lastName: codeLastName,
      ecclesia: codeEcclesia,
      role,
      invitationCode,
    })

    // Create email verification token
    const verificationToken = await createEmailVerificationToken(email)

    // Send verification email
    await sendVerificationEmail(email, verificationToken, `${codeFirstName} ${codeLastName}`)

    return NextResponse.json({
      success: true,
      message: 'User registered successfully. Please check your email to verify your account.',
      userId: user.id,
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}