import { NextRequest, NextResponse } from 'next/server'
import { verifyEcclesiaToken, generateEcclesiaUpdateUrl } from '@/utils/email/ecclesia-token'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { findCredentialsUserByEmail, findAnyUserByEmail } from '@/utils/dynamodb/credentials-users'

// Unified user type that works with both PersonRecord and auth users
type UnifiedUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  ecclesia: string
  isRecordingBrother?: boolean
  source: 'person' | 'user'
}

// Try to find user by email - prioritizes efficient GSI queries
async function findUserByEmail(email: string): Promise<UnifiedUser | null> {
  // 1. First try PersonRecord (imported inter-ecclesia contacts)
  // Uses GSI query: gsi1pk = EMAIL#${email} - O(1)
  const person = await personRepository.getByEmail(email)
  if (person) {
    return {
      id: person.personId,
      email: person.primaryEmail,
      firstName: person.firstName,
      lastName: person.lastName,
      ecclesia: person.ecclesia,
      isRecordingBrother: person.isRecordingBrother,
      source: 'person',
    }
  }

  // 2. Try credentials user (email/password accounts)
  // Uses GSI query: gsi1pk = USER#${email} - O(1)
  const credUser = await findCredentialsUserByEmail(email)
  if (credUser) {
    return {
      id: credUser.id,
      email: credUser.email,
      firstName: credUser.firstName || '',
      lastName: credUser.lastName || '',
      ecclesia: credUser.ecclesia || '',
      isRecordingBrother: false,
      source: 'user',
    }
  }

  // 3. Fallback to any auth user (Google OAuth, etc.)
  // Uses scan - expensive but necessary for OAuth users without GSI
  const anyUser = await findAnyUserByEmail(email)
  if (anyUser) {
    const nameParts = (anyUser.name || '').split(' ')
    return {
      id: anyUser.id,
      email: anyUser.email,
      firstName: anyUser.firstName || nameParts[0] || '',
      lastName: anyUser.lastName || nameParts.slice(1).join(' ') || '',
      ecclesia: anyUser.ecclesia || '',
      isRecordingBrother: false,
      source: 'user',
    }
  }

  return null
}

/**
 * GET: Get ecclesia contact info using token
 * Flow: Token → Email → User (from PersonRecord or auth DB)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Token → Email (single GetItem)
    const tokenResult = await verifyEcclesiaToken(token)

    if (!tokenResult.valid) {
      return NextResponse.json({
        error: tokenResult.error || 'Invalid token',
        expired: tokenResult.expired
      }, { status: 401 })
    }

    const email = tokenResult.email!

    // Email → User (try PersonRecord first, then auth DB)
    const user = await findUserByEmail(email)

    if (!user) {
      return NextResponse.json({
        error: 'Contact not found',
        email
      }, { status: 404 })
    }

    // Get other contacts from the same ecclesia (only if ecclesia is set)
    let ecclesiaMembers: Array<{
      email: string
      firstName: string
      lastName: string
      isRecordingBrother?: boolean
    }> = []

    if (user.ecclesia) {
      try {
        const result = await personRepository.listByEcclesia(user.ecclesia)
        ecclesiaMembers = result.items
          .filter(p => p.primaryEmail.toLowerCase() !== email.toLowerCase()) // Exclude current user
          .map(p => ({
            email: p.primaryEmail,
            firstName: p.firstName,
            lastName: p.lastName,
            isRecordingBrother: p.isRecordingBrother || false,
          }))
      } catch (err) {
        console.error('Error fetching ecclesia members:', err)
      }
    }

    return NextResponse.json({
      success: true,
      personId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      ecclesia: user.ecclesia,
      isRecordingBrother: user.isRecordingBrother || false,
      ecclesiaMembers,
      source: user.source, // Helpful for debugging
    })

  } catch (error) {
    console.error('Error getting ecclesia contact:', error)
    return NextResponse.json(
      { error: 'Failed to get contact info' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Update ecclesia contact info
 * Flow: Token → Email → User → Update
 * Note: For now, only PersonRecord users can be updated via this endpoint.
 * Auth-only users should use the main profile page.
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Token → Email
    const tokenResult = await verifyEcclesiaToken(token)

    if (!tokenResult.valid) {
      return NextResponse.json({
        error: tokenResult.error || 'Invalid token',
        expired: tokenResult.expired
      }, { status: 401 })
    }

    const email = tokenResult.email!

    // Email → User
    const user = await findUserByEmail(email)

    if (!user) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Get request body
    const body = await request.json()
    const { firstName, lastName, isRecordingBrother } = body

    // For PersonRecord users, update directly
    if (user.source === 'person') {
      const updates: Record<string, any> = {}
      if (firstName !== undefined) updates.firstName = firstName
      if (lastName !== undefined) updates.lastName = lastName
      if (isRecordingBrother !== undefined) updates.isRecordingBrother = isRecordingBrother

      const updated = await personRepository.updatePerson(user.id, updates)

      return NextResponse.json({
        success: true,
        message: 'Contact info updated successfully',
        personId: updated.personId,
        email: updated.primaryEmail,
        firstName: updated.firstName,
        lastName: updated.lastName,
        ecclesia: updated.ecclesia,
        isRecordingBrother: updated.isRecordingBrother || false,
      })
    }

    // For auth-only users, they need to use the main profile page
    // But we can still show their info (read-only for now)
    return NextResponse.json({
      success: true,
      message: 'Your profile is managed through the main app. Please log in to update your details.',
      personId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      ecclesia: user.ecclesia,
      isRecordingBrother: false,
      readOnly: true,
    })

  } catch (error) {
    console.error('Error updating ecclesia contact:', error)
    return NextResponse.json(
      { error: 'Failed to update contact info' },
      { status: 500 }
    )
  }
}

/**
 * POST: Add a new ecclesia member
 * Flow: Token → Email → User (adder) → Create new PersonRecord
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Token → Email (adder)
    const tokenResult = await verifyEcclesiaToken(token)

    if (!tokenResult.valid) {
      return NextResponse.json({
        error: tokenResult.error || 'Invalid token',
        expired: tokenResult.expired
      }, { status: 401 })
    }

    // Email → User (adder)
    const adder = await findUserByEmail(tokenResult.email!)

    if (!adder) {
      return NextResponse.json({ error: 'Your contact not found' }, { status: 404 })
    }

    if (!adder.ecclesia) {
      return NextResponse.json({
        error: 'Your ecclesia is not set. Please update your profile first.'
      }, { status: 400 })
    }

    // Get request body
    const body = await request.json()
    const { email, firstName, lastName } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 })
    }

    // Check if person already exists (in PersonRecord)
    const existing = await personRepository.getByEmail(email)

    if (existing) {
      // Check if same ecclesia
      if (existing.ecclesia.toLowerCase() !== adder.ecclesia.toLowerCase()) {
        return NextResponse.json({
          error: `This email is already associated with "${existing.ecclesia}". Cannot add to "${adder.ecclesia}".`
        }, { status: 400 })
      }

      // Update existing person if needed
      const updates: Record<string, any> = {}
      if (firstName && firstName !== existing.firstName) updates.firstName = firstName
      if (lastName && lastName !== existing.lastName) updates.lastName = lastName

      if (Object.keys(updates).length > 0) {
        await personRepository.updatePerson(existing.personId, updates)
      }

      return NextResponse.json({
        success: true,
        message: 'Contact updated successfully',
        email: existing.primaryEmail,
        firstName: firstName || existing.firstName,
        lastName: lastName || existing.lastName,
        ecclesia: existing.ecclesia,
      })
    }

    // Create new PersonRecord with adder's ecclesia
    const newPerson = await personRepository.create({
      email: email.toLowerCase(),
      firstName: firstName || '',
      lastName: lastName || '',
      ecclesia: adder.ecclesia,
      memberStatus: 'member',
    })

    return NextResponse.json({
      success: true,
      message: 'Contact added successfully',
      email: newPerson.primaryEmail,
      firstName: newPerson.firstName,
      lastName: newPerson.lastName,
      ecclesia: newPerson.ecclesia,
    })

  } catch (error) {
    console.error('Error adding ecclesia member:', error)
    return NextResponse.json(
      { error: 'Failed to add ecclesia member' },
      { status: 500 }
    )
  }
}

/**
 * PUT: Generate a test token URL for an email (admin use only)
 * Query param: email
 */
export async function PUT(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Verify the user exists (either PersonRecord or auth user)
    const user = await findUserByEmail(email)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Generate token URL
    const url = await generateEcclesiaUpdateUrl(email, 'http://localhost:4000')

    return NextResponse.json({
      success: true,
      email: user.email,
      ecclesia: user.ecclesia,
      source: user.source,
      url,
    })

  } catch (error) {
    console.error('Error generating test token:', error)
    return NextResponse.json(
      { error: 'Failed to generate test token' },
      { status: 500 }
    )
  }
}
