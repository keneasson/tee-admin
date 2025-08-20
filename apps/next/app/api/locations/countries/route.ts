import { NextRequest, NextResponse } from 'next/server'
import { getCountries } from '../../../../utils/dynamodb/locations'

export async function GET(request: NextRequest) {
  try {
    const countries = await getCountries()
    
    return NextResponse.json({
      success: true,
      data: countries,
    })
  } catch (error) {
    console.error('Error fetching countries:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch countries',
      },
      { status: 500 }
    )
  }
}