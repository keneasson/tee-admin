import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getAllEcclesia } from '@/utils/dynamodb/locations'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ecclesias = await getAllEcclesia()

    // Sort by name
    ecclesias.sort((a, b) => a.name.localeCompare(b.name))

    // Transform to include id (using name as id for now)
    const transformedEcclesias = ecclesias.map((ecclesia) => ({
      id: ecclesia.name, // Using name as ID since it's unique
      name: ecclesia.name,
      city: ecclesia.city,
      province: ecclesia.province,
      country: ecclesia.country,
      address: ecclesia.address,
      postalCode: ecclesia.postalCode,
      hall: ecclesia.address ? {
        name: ecclesia.name,
        address: ecclesia.address,
        city: ecclesia.city,
        province: ecclesia.province,
        postalCode: ecclesia.postalCode,
        country: ecclesia.country,
      } : undefined,
    }))

    return NextResponse.json({
      success: true,
      ecclesias: transformedEcclesias,
    })
  } catch (error) {
    console.error('Error fetching ecclesias:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ecclesias',
      },
      { status: 500 }
    )
  }
}
