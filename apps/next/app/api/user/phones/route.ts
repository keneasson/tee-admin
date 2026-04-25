import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PhoneType } from '@my/app/provider/dynamodb/types'

// Valid phone types
const validPhoneTypes: PhoneType[] = ['mobile', 'home', 'work', 'other']

/**
 * Resolve the logged-in user's personId from their session email.
 * Returns null if no person record found.
 */
async function resolvePersonId(email: string): Promise<string | null> {
  const person = await personRepository.getByEmail(email)
  return person?.personId ?? null
}

/**
 * GET /api/user/phones - Get all phones for current user
 * Returns phones sorted by order (first = preferred)
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    const phones = await personRepository.getPhones(personId)

    // Transform to client format (already sorted by order from repository)
    const result = phones.map(phone => ({
      id: phone.phoneId,
      type: phone.type,
      number: phone.number,
      verified: false, // Phones don't have verification
    }))

    return NextResponse.json({
      success: true,
      phones: result,
    })
  } catch (error) {
    console.error('Get phones error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/phones - Replace all phones (batch update with ordering)
 * Body: { phones: Array<{ id: string, type: PhoneType, number: string }> }
 * Order is determined by array index (first = preferred)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { phones } = body as { phones: Array<{ id: string; type: PhoneType; number: string }> }

    if (!Array.isArray(phones)) {
      return NextResponse.json(
        { error: 'phones must be an array' },
        { status: 400 }
      )
    }

    // Validate each phone
    for (const phone of phones) {
      // Number must be exactly 10 digits (or empty to be filtered out)
      if (phone.number && !/^\d{10}$/.test(phone.number)) {
        return NextResponse.json(
          { error: `Invalid phone number. Must be exactly 10 digits.` },
          { status: 400 }
        )
      }
      if (!validPhoneTypes.includes(phone.type)) {
        return NextResponse.json(
          { error: `Invalid phone type: ${phone.type}` },
          { status: 400 }
        )
      }
    }

    // Filter out phones with empty/invalid numbers
    const validPhones = phones
      .filter(p => p.number && p.number.length === 10)
      .map((phone, index) => ({
        type: phone.type,
        number: phone.number,
        order: index,
      }))

    await personRepository.replaceAllPhones(personId, validPhones)

    return NextResponse.json({
      success: true,
      message: 'Phone numbers updated',
      count: validPhones.length,
    })
  } catch (error) {
    console.error('Update phones error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/phones - Add a new phone
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

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { type, number, isPrimary, isHousehold } = body

    // Validate required fields
    if (!type || !number) {
      return NextResponse.json(
        { error: 'Missing required fields: type, number' },
        { status: 400 }
      )
    }

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(number)) {
      return NextResponse.json(
        { error: 'Phone number must be exactly 10 digits' },
        { status: 400 }
      )
    }

    // Validate phone type
    if (!validPhoneTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid phone type. Must be one of: ${validPhoneTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get existing phones to determine order
    const existing = await personRepository.getPhones(personId)
    const order = existing.length

    // If this is set as primary, unset other primary phones
    if (isPrimary) {
      for (const phone of existing) {
        if (phone.isPrimary) {
          await personRepository.updatePhone(personId, phone.phoneId, { isPrimary: false })
        }
      }
    }

    const added = await personRepository.addPhone(personId, {
      type,
      number,
      isPrimary: isPrimary || order === 0, // First phone is primary by default
      isHousehold: isHousehold || false,
      order,
    })

    return NextResponse.json({
      success: true,
      phoneId: added.phoneId,
      message: 'Phone added successfully',
    })
  } catch (error) {
    console.error('Add phone error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/phones - Update a phone
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { phoneId, ...updates } = body

    if (!phoneId) {
      return NextResponse.json(
        { error: 'phoneId is required' },
        { status: 400 }
      )
    }

    // Verify the phone exists
    const existing = await personRepository.getPhone(personId, phoneId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }

    // If setting as primary, unset other primary phones
    if (updates.isPrimary) {
      const allPhones = await personRepository.getPhones(personId)
      for (const phone of allPhones) {
        if (phone.isPrimary && phone.phoneId !== phoneId) {
          await personRepository.updatePhone(personId, phone.phoneId, { isPrimary: false })
        }
      }
    }

    const updated = await personRepository.updatePhone(personId, phoneId, updates)

    return NextResponse.json({
      success: true,
      phone: updated,
      message: 'Phone updated successfully',
    })
  } catch (error) {
    console.error('Update phone error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/phones - Delete a phone
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const phoneId = searchParams.get('phoneId')

    if (!phoneId) {
      return NextResponse.json(
        { error: 'phoneId is required' },
        { status: 400 }
      )
    }

    // Verify the phone exists
    const existing = await personRepository.getPhone(personId, phoneId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }

    await personRepository.deletePhone(personId, phoneId)

    return NextResponse.json({
      success: true,
      message: 'Phone deleted successfully',
    })
  } catch (error) {
    console.error('Delete phone error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
