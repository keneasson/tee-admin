import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import type { AddressType } from '@my/app/provider/dynamodb/types'

// Generate a simple unique ID
function generateAddressId(): string {
  return `addr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * GET /api/user/addresses - Get all addresses for current user
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

    const result = await userRepository.getAddresses(session.user.email)

    return NextResponse.json({
      success: true,
      addresses: result.items,
    })
  } catch (error) {
    console.error('Get addresses error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/addresses - Add a new address
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
    const { type, label, street1, street2, city, province, postalCode, country, isPrimary, isHousehold, householdId } = body

    // Validate required fields
    if (!type || !street1 || !city || !province || !postalCode || !country) {
      return NextResponse.json(
        { error: 'Missing required fields: type, street1, city, province, postalCode, country' },
        { status: 400 }
      )
    }

    // Validate address type
    const validTypes: AddressType[] = ['home', 'residence', 'work', 'mailing', 'other']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid address type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const addressId = generateAddressId()

    // If this is set as primary, unset other primary addresses
    if (isPrimary) {
      const existing = await userRepository.getAddresses(session.user.email)
      for (const addr of existing.items) {
        if (addr.isPrimary) {
          await userRepository.updateAddress(session.user.email, addr.addressId, { isPrimary: false })
        }
      }
    }

    await userRepository.addAddress(session.user.email, {
      addressId,
      type,
      label,
      street1,
      street2,
      city,
      province,
      postalCode,
      country,
      isPrimary: isPrimary || false,
      isHousehold: isHousehold || false,
      householdId,
    })

    return NextResponse.json({
      success: true,
      addressId,
      message: 'Address added successfully',
    })
  } catch (error) {
    console.error('Add address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/addresses - Update an address
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
    const { addressId, ...updates } = body

    if (!addressId) {
      return NextResponse.json(
        { error: 'addressId is required' },
        { status: 400 }
      )
    }

    // Verify the address exists
    const existing = await userRepository.getAddress(session.user.email, addressId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    // If setting as primary, unset other primary addresses
    if (updates.isPrimary) {
      const allAddresses = await userRepository.getAddresses(session.user.email)
      for (const addr of allAddresses.items) {
        if (addr.isPrimary && addr.addressId !== addressId) {
          await userRepository.updateAddress(session.user.email, addr.addressId, { isPrimary: false })
        }
      }
    }

    const updated = await userRepository.updateAddress(session.user.email, addressId, updates)

    return NextResponse.json({
      success: true,
      address: updated,
      message: 'Address updated successfully',
    })
  } catch (error) {
    console.error('Update address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/addresses - Delete an address
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
    const addressId = searchParams.get('addressId')

    if (!addressId) {
      return NextResponse.json(
        { error: 'addressId is required' },
        { status: 400 }
      )
    }

    // Verify the address exists
    const existing = await userRepository.getAddress(session.user.email, addressId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    await userRepository.deleteAddress(session.user.email, addressId)

    return NextResponse.json({
      success: true,
      message: 'Address deleted successfully',
    })
  } catch (error) {
    console.error('Delete address error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
