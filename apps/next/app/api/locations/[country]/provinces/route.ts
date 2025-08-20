import { NextRequest, NextResponse } from 'next/server'
import { getProvinces } from '../../../../../utils/dynamodb/locations'

interface RouteParams {
  params: { country: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { country } = params
    
    if (!country) {
      return NextResponse.json(
        {
          success: false,
          error: 'Country parameter is required',
        },
        { status: 400 }
      )
    }

    const provinces = await getProvinces(country.toUpperCase())
    
    return NextResponse.json({
      success: true,
      data: provinces,
    })
  } catch (error) {
    console.error('Error fetching provinces:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch provinces',
      },
      { status: 500 }
    )
  }
}