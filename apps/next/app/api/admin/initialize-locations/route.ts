import { NextRequest, NextResponse } from 'next/server'
import { initializeCanadianProvinces } from '../../../../utils/dynamodb/locations'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting location data initialization...')
    
    await initializeCanadianProvinces()
    
    console.log('✅ Location data initialized successfully!')
    
    return NextResponse.json({
      success: true,
      message: 'Canadian provinces initialized successfully',
    })
  } catch (error) {
    console.error('❌ Error initializing location data:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to initialize location data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// For convenience, also allow GET request
export async function GET(request: NextRequest) {
  return POST(request)
}