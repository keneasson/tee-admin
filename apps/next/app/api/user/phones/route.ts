import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import type { PhoneType } from '@my/app/provider/dynamodb/types'

// Generate a simple unique ID
function generatePhoneId(): string {
  return `phone-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Valid phone types
const validPhoneTypes: PhoneType[] = ['mobile', 'home', 'work', 'other']

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

    const result = await userRepository.getPhones(session.user.email)

    // Sort by order and transform to client format
    const phones = result.items
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(phone => ({
        id: phone.phoneId,
        type: phone.type,
        number: phone.number, // 10 digits
        verified: false, // Phones don't have verification
      }))

    return NextResponse.json({
      success: true,
      phones,
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
        phoneId: phone.id || generatePhoneId(),
        type: phone.type,
        number: phone.number,
        order: index,
      }))

    await userRepository.replaceAllPhones(session.user.email, validPhones)

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

    const phoneId = generatePhoneId()

    // Get existing phones to determine order
    const existing = await userRepository.getPhones(session.user.email)
    const order = existing.items.length

    // If this is set as primary, unset other primary phones
    if (isPrimary) {
      for (const phone of existing.items) {
        if (phone.isPrimary) {
          await userRepository.updatePhone(session.user.email, phone.phoneId, { isPrimary: false })
        }
      }
    }

    await userRepository.addPhone(session.user.email, {
      phoneId,
      type,
      number,
      isPrimary: isPrimary || order === 0, // First phone is primary by default
      isHousehold: isHousehold || false,
      order,
    })

    return NextResponse.json({
      success: true,
      phoneId,
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

    const body = await request.json()
    const { phoneId, ...updates } = body

    if (!phoneId) {
      return NextResponse.json(
        { error: 'phoneId is required' },
        { status: 400 }
      )
    }

    // Verify the phone exists
    const existing = await userRepository.getPhone(session.user.email, phoneId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }

    // If setting as primary, unset other primary phones
    if (updates.isPrimary) {
      const allPhones = await userRepository.getPhones(session.user.email)
      for (const phone of allPhones.items) {
        if (phone.isPrimary && phone.phoneId !== phoneId) {
          await userRepository.updatePhone(session.user.email, phone.phoneId, { isPrimary: false })
        }
      }
    }

    const updated = await userRepository.updatePhone(session.user.email, phoneId, updates)

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

    const { searchParams } = new URL(request.url)
    const phoneId = searchParams.get('phoneId')

    if (!phoneId) {
      return NextResponse.json(
        { error: 'phoneId is required' },
        { status: 400 }
      )
    }

    // Verify the phone exists
    const existing = await userRepository.getPhone(session.user.email, phoneId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Phone not found' },
        { status: 404 }
      )
    }

    await userRepository.deletePhone(session.user.email, phoneId)

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
