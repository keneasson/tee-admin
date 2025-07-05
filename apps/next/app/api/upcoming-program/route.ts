import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { ProgramTypeKeys } from '@my/app/types'

// Cache for 10 minutes in production
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 600 : 0

const scheduleService = new ScheduleService()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderParam = searchParams.get('order')
    
    // Parse order parameter or use default
    let orderOfKeys: ProgramTypeKeys[] = ['memorial', 'bibleClass', 'sundaySchool']
    if (orderParam) {
      try {
        const parsedOrder = orderParam.split(',') as ProgramTypeKeys[]
        const validKeys = ['memorial', 'bibleClass', 'sundaySchool']
        orderOfKeys = parsedOrder.filter(key => validKeys.includes(key))
      } catch (error) {
        console.warn('⚠️ Invalid order parameter, using default order')
      }
    }

    console.log('📅 API request for upcoming program events')

    // Check data freshness for all schedule types
    const dataFreshnessChecks = await Promise.all(
      orderOfKeys.map(async (type) => ({
        type,
        fresh: await scheduleService.isDataFresh(type, 60) // 1 hour freshness
      }))
    )

    const staleTypes = dataFreshnessChecks.filter(check => !check.fresh).map(check => check.type)
    
    if (staleTypes.length > 0) {
      console.warn(`⚠️ Stale data detected for: ${staleTypes.join(', ')}, falling back to Google Sheets`)
      
      // Fallback to original Google Sheets API
      try {
        const { get_upcoming_program } = await import('../../../utils/get-upcoming-program')
        const upcomingProgram = await get_upcoming_program(orderOfKeys)
        
        return NextResponse.json(upcomingProgram, {
          headers: {
            'Cache-Control': `public, max-age=300, stale-while-revalidate=60`, // 5 min cache for fallback
            'X-Data-Source': 'google-sheets-fallback',
            'X-Stale-Types': staleTypes.join(','),
          },
        })
      } catch (fallbackError) {
        console.error('❌ Fallback to Google Sheets failed for upcoming program:', fallbackError)
        return NextResponse.json(
          { error: 'Upcoming program data temporarily unavailable' },
          { status: 503 }
        )
      }
    }

    // Fetch from DynamoDB
    const upcomingEvents = await scheduleService.getUpcomingProgram(orderOfKeys)
    
    console.log(`✅ Served upcoming program from DynamoDB cache (${upcomingEvents.length} events)`)

    // Transform to match the expected API format
    const responseData = upcomingEvents.map(event => ({
      type: event.type,
      title: event.title,
      date: event.date.toISOString(),
      details: event.details,
    }))

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=120`,
        'X-Data-Source': 'dynamodb-cache',
        'X-Event-Count': upcomingEvents.length.toString(),
      },
    })

  } catch (error) {
    console.error('❌ Error serving upcoming program:', error)
    
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