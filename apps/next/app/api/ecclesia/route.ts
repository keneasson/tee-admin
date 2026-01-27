import { NextRequest, NextResponse } from 'next/server'
import { createEcclesia, getAllEcclesia, updateEcclesia, deleteEcclesia } from '../../../utils/dynamodb/locations'

export async function GET(request: NextRequest) {
  try {
    const ecclesias = await getAllEcclesia()
    
    return NextResponse.json({
      success: true,
      data: ecclesias,
    })
  } catch (error) {
    console.error('Error fetching all ecclesia:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ecclesia',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, country, province, city, address, postalCode } = body

    // Validate required fields
    if (!name || !country || !province || !city) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name, country, province, and city are required',
        },
        { status: 400 }
      )
    }

    // Validate name length
    if (name.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ecclesia name must be at least 2 characters',
        },
        { status: 400 }
      )
    }

    const ecclesia = await createEcclesia({
      name: name.trim(),
      country: country.trim().toUpperCase(),
      province: province.trim().toUpperCase(),
      city: city.trim(),
      address: address?.trim(),
      postalCode: postalCode?.trim(),
    })
    
    return NextResponse.json({
      success: true,
      data: ecclesia,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating ecclesia:', error)
    
    // Check if it's a duplicate key error
    if (error instanceof Error && error.message.includes('ConditionalCheckFailedException')) {
      return NextResponse.json(
        {
          success: false,
          error: 'An ecclesia with this name already exists',
        },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create ecclesia',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { originalName, name, country, province, city, address, postalCode } = body

    // Validate required fields
    if (!originalName || !name || !country || !province || !city) {
      return NextResponse.json(
        {
          success: false,
          error: 'Original name, name, country, province, and city are required',
        },
        { status: 400 }
      )
    }

    // Validate name length
    if (name.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ecclesia name must be at least 2 characters',
        },
        { status: 400 }
      )
    }

    const ecclesia = await updateEcclesia(originalName, {
      name: name.trim(),
      country: country.trim().toUpperCase(),
      province: province.trim().toUpperCase(),
      city: city.trim(),
      address: address?.trim(),
      postalCode: postalCode?.trim(),
    })

    return NextResponse.json({
      success: true,
      data: ecclesia,
    })
  } catch (error) {
    console.error('Error updating ecclesia:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update ecclesia',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ecclesia name is required',
        },
        { status: 400 }
      )
    }

    await deleteEcclesia(name)

    return NextResponse.json({
      success: true,
      message: `Ecclesia "${name}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting ecclesia:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete ecclesia',
      },
      { status: 500 }
    )
  }
}