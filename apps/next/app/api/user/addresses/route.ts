import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { AddressType } from '@my/app/provider/dynamodb/types'

/**
 * Resolve the logged-in user's personId from their session email.
 * Returns null if no person record found.
 */
async function resolvePersonId(email: string): Promise<string | null> {
  const person = await personRepository.getByEmail(email)
  return person?.personId ?? null
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

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      )
    }

    const addresses = await personRepository.getAddresses(personId)

    return NextResponse.json({
      success: true,
      addresses,
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

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
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

    // If this is set as primary, unset other primary addresses
    if (isPrimary) {
      const existing = await personRepository.getAddresses(personId)
      for (const addr of existing) {
        if (addr.isPrimary) {
          await personRepository.updateAddress(personId, addr.addressId, { isPrimary: false })
        }
      }
    }

    const added = await personRepository.addAddress(personId, {
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
      addressId: added.addressId,
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

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
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
    const existing = await personRepository.getAddress(personId, addressId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    // If setting as primary, unset other primary addresses
    if (updates.isPrimary) {
      const allAddresses = await personRepository.getAddresses(personId)
      for (const addr of allAddresses) {
        if (addr.isPrimary && addr.addressId !== addressId) {
          await personRepository.updateAddress(personId, addr.addressId, { isPrimary: false })
        }
      }
    }

    const updated = await personRepository.updateAddress(personId, addressId, updates)

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

    const personId = await resolvePersonId(session.user.email)
    if (!personId) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
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
    const existing = await personRepository.getAddress(personId, addressId)
    if (!existing) {
      return NextResponse.json(
        { error: 'Address not found' },
        { status: 404 }
      )
    }

    await personRepository.deleteAddress(personId, addressId)

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
