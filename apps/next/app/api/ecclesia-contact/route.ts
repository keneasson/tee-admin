import { NextRequest, NextResponse } from 'next/server'
import { verifyEcclesiaToken, generateEcclesiaUpdateUrl } from '@/utils/email/ecclesia-token'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/**
 * GET: Get ecclesia contact info using token
 * Flow: Token → Email → PersonRecord
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

    // Email → PersonRecord (GSI lookup)
    const person = await personRepository.getByEmail(email)

    if (!person) {
      return NextResponse.json({
        error: 'Contact not found',
        email
      }, { status: 404 })
    }

    // Get other contacts from the same ecclesia
    let ecclesiaMembers: Array<{
      email: string
      firstName: string
      lastName: string
    }> = []

    if (person.ecclesia) {
      try {
        const result = await personRepository.listByEcclesia(person.ecclesia)
        ecclesiaMembers = result.items
          .filter(p => p.primaryEmail !== email) // Exclude current user
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
      personId: person.personId,
      email: person.primaryEmail,
      firstName: person.firstName,
      lastName: person.lastName,
      ecclesia: person.ecclesia,
      isRecordingBrother: person.isRecordingBrother || false,
      ecclesiaMembers,
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
 * Flow: Token → Email → PersonRecord → Update
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

    // Email → PersonRecord
    const person = await personRepository.getByEmail(email)

    if (!person) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Get request body
    const body = await request.json()
    const { firstName, lastName, isRecordingBrother } = body

    // Build updates
    const updates: Record<string, any> = {}
    if (firstName !== undefined) updates.firstName = firstName
    if (lastName !== undefined) updates.lastName = lastName
    if (isRecordingBrother !== undefined) updates.isRecordingBrother = isRecordingBrother

    // Update PersonRecord
    const updated = await personRepository.updatePerson(person.personId, updates)

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
 * Flow: Token → Email → PersonRecord (adder) → Create new PersonRecord
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

    // Email → PersonRecord (adder)
    const adder = await personRepository.getByEmail(tokenResult.email!)

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

    // Check if person already exists
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

    // Verify the person exists
    const person = await personRepository.getByEmail(email)
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Generate token URL
    const url = await generateEcclesiaUpdateUrl(email, 'http://localhost:4000')

    return NextResponse.json({
      success: true,
      email: person.primaryEmail,
      ecclesia: person.ecclesia,
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
