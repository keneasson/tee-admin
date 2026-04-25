import { NextRequest, NextResponse } from 'next/server'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import {
  getRoleFromLegacyUser,
  getUserFromLegacyDirectory,
} from '@my/app/provider/auth/get-user-from-legacy'

/**
 * POST - Verify OTP code (manual entry)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, code, magicLinkToken } = body

    // Magic link token verification (from callback page)
    if (magicLinkToken) {
      const result = await tokenRepository.verifyAndConsume(magicLinkToken, 'otp')

      if (!result.valid || !result.token) {
        const errorMessages: Record<string, string> = {
          not_found: 'Invalid or expired link.',
          expired: 'This link has expired. Please request a new code.',
          already_used: 'This link has already been used.',
          type_mismatch: 'Invalid link.',
        }
        return NextResponse.json(
          { error: errorMessages[result.error || 'not_found'] || 'Verification failed.' },
          { status: 400 }
        )
      }

      const tokenEmail = result.token.email
      const personResult = await ensurePersonRecord(tokenEmail)

      return NextResponse.json({
        success: true,
        email: tokenEmail,
        personId: personResult.personId,
        isNewUser: personResult.isNewUser,
      })
    }

    // OTP code verification (manual entry)
    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Please enter a valid 6-digit code.' },
        { status: 400 }
      )
    }

    const result = await tokenRepository.verifyOtp(normalizedEmail, code)

    if (!result.valid) {
      const errorMessages: Record<string, string> = {
        not_found: 'No verification code found. Please request a new code.',
        expired: 'This code has expired. Please request a new code.',
        already_used: 'This code has already been used.',
        max_attempts: 'Too many incorrect attempts. Please request a new code.',
        invalid_code: 'Incorrect code. Please try again.',
        rate_limited: 'Please wait before requesting a new code.',
      }
      return NextResponse.json(
        { error: errorMessages[result.error || 'not_found'] || 'Verification failed.' },
        { status: 400 }
      )
    }

    const personResult = await ensurePersonRecord(normalizedEmail)

    return NextResponse.json({
      success: true,
      email: normalizedEmail,
      personId: personResult.personId,
      isNewUser: personResult.isNewUser,
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    )
  }
}

/**
 * Ensure a PersonRecord exists for the verified email.
 * If one exists, mark email as verified and determine role.
 * If not, create a new one with guest role.
 */
async function ensurePersonRecord(email: string): Promise<{
  personId: string
  isNewUser: boolean
  role: string
}> {
  const normalizedEmail = email.toLowerCase()

  // Check for existing PersonRecord (full record, not just auth fields)
  const existingPerson = await personRepository.getByEmail(normalizedEmail)

  if (existingPerson) {
    // Mark email as verified if not already
    if (!existingPerson.emailVerified) {
      await personRepository.markEmailVerified(existingPerson.personId)
    }

    // Determine role: use explicit role, derive from record, or check legacy directory
    let role = existingPerson.role
    if (!role) {
      // Derive from memberStatus/isInterEcclesiaRep
      if (existingPerson.memberStatus === 'member' || existingPerson.isInterEcclesiaRep) {
        role = 'member'
      }

      // Also check legacy directory for a more specific role
      if (!role) {
        try {
          const legacyUser = await getUserFromLegacyDirectory({ email: normalizedEmail })
          if (legacyUser) {
            const legacyRole = await getRoleFromLegacyUser({ user: legacyUser })
            if (legacyRole) role = legacyRole as 'owner' | 'admin' | 'member' | 'guest' | 'deceased'
          }
        } catch (err) {
          console.error('Legacy directory lookup for existing person:', err)
        }
      }

      // Persist the derived role so future logins are fast
      if (role) {
        try {
          await personRepository.updatePerson(existingPerson.personId, { role })
        } catch (err) {
          console.error('Failed to persist derived role:', err)
        }
      }
    }

    return {
      personId: existingPerson.personId,
      isNewUser: false,
      role: role || 'guest',
    }
  }

  // Check legacy directory for role determination
  let role: string = 'guest'
  let firstName = ''
  let lastName = ''
  let ecclesia = 'Unknown'

  try {
    const legacyUser = await getUserFromLegacyDirectory({ email: normalizedEmail })
    if (legacyUser) {
      const legacyRole = await getRoleFromLegacyUser({ user: legacyUser })
      if (legacyRole) role = legacyRole
      firstName = legacyUser.FirstName || ''
      lastName = legacyUser.LastName || ''
      ecclesia = legacyUser.ecclesia || 'Unknown'
    }
  } catch (err) {
    console.error('Legacy directory lookup error:', err)
  }

  // Create new PersonRecord
  try {
    const person = await personRepository.create({
      email: normalizedEmail,
      firstName,
      lastName,
      ecclesia,
      memberStatus: 'visitor',
      role: role as 'owner' | 'admin' | 'member' | 'guest' | 'deceased',
      provider: 'credentials',
    })
    // Mark as verified since OTP already verified the email
    await personRepository.markEmailVerified(person.personId)
    return { personId: person.personId, isNewUser: true, role }
  } catch (createError) {
    console.error('Failed to create PersonRecord:', createError)
  }

  // Fallback - shouldn't normally reach here
  return { personId: 'unknown', isNewUser: true, role }
}
