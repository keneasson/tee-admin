import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'

// Cache for 5 minutes in production, disabled in development
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 300 : 0

const scheduleService = new ScheduleService()

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { type } = params
    
    // Validate schedule type
    const validTypes = ['memorial', 'bibleClass', 'sundaySchool', 'cyc']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid schedule type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    console.log(`📊 API request for ${type} schedule data`)

    // Check if we have fresh data, otherwise fall back to Google Sheets
    const isDataFresh = await scheduleService.isDataFresh(type, 60) // 1 hour freshness
    
    if (!isDataFresh) {
      console.warn(`⚠️ ${type} data is stale, falling back to Google Sheets`)
      
      // Fallback to original Google Sheets API
      try {
        const { get_google_sheet } = await import('../../../../utils/get-google-sheets')
        const googleSheetData = await get_google_sheet(type as any)
        
        return NextResponse.json(googleSheetData, {
          headers: {
            'Cache-Control': `public, max-age=60, stale-while-revalidate=30`,
            'X-Data-Source': 'google-sheets-fallback',
          },
        })
      } catch (fallbackError) {
        console.error(`❌ Fallback to Google Sheets failed for ${type}:`, fallbackError)
        return NextResponse.json(
          { error: 'Schedule data temporarily unavailable' },
          { status: 503 }
        )
      }
    }

    // Fetch from DynamoDB
    const scheduleData = await scheduleService.getScheduleData(type as any)
    
    if (!scheduleData) {
      console.warn(`⚠️ No ${type} schedule data found in DynamoDB`)
      return NextResponse.json(
        { error: `No ${type} schedule data available` },
        { status: 404 }
      )
    }

    console.log(`✅ Served ${type} schedule from DynamoDB cache`)

    return NextResponse.json(scheduleData, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=60`,
        'X-Data-Source': 'dynamodb-cache',
        'X-Last-Updated': scheduleData.lastUpdated || '',
      },
    })

  } catch (error) {
    console.error(`❌ Error serving ${params.type} schedule:`, error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}