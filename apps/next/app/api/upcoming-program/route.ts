import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { ProgramTypeKeys } from '@my/app/types'
import { CACHE_TAGS } from '../../../utils/cache'

// Cache for 1 hour in production (we can cache longer now with tag-based invalidation)
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 3600 : 0

const scheduleService = new ScheduleService()

// Create a cached version of the upcoming program fetcher
const getCachedUpcomingProgram = unstable_cache(
  async (orderOfKeys: ProgramTypeKeys[]) => {
    console.log('🔄 Cache miss - fetching fresh data from DynamoDB')
    return await scheduleService.getUpcomingProgram(orderOfKeys)
  },
  ['upcoming-program'], // cache key
  { 
    tags: [
      CACHE_TAGS.UPCOMING_PROGRAM,
      CACHE_TAGS.ALL_SCHEDULE_DATA,
      CACHE_TAGS.SCHEDULES_MEMORIAL,
      CACHE_TAGS.SCHEDULES_BIBLE_CLASS,
      CACHE_TAGS.SCHEDULES_SUNDAY_SCHOOL
    ],
    revalidate: CACHE_DURATION || 3600, // Default to 1 hour if no cache duration
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderParam = searchParams.get('order')
    
    // Parse order parameter or use default
    // Correct chronological order: Sunday School (early Sunday), Memorial (late Sunday), Bible Class (Wednesday)
    let orderOfKeys: ProgramTypeKeys[] = ['sundaySchool', 'memorial', 'bibleClass']
    if (orderParam) {
      try {
        const parsedOrder = orderParam.split(',') as ProgramTypeKeys[]
        const validKeys = ['sundaySchool', 'memorial', 'bibleClass']
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

    // Fetch from DynamoDB with caching
    const upcomingEvents = await getCachedUpcomingProgram(orderOfKeys)
    
    console.log(`✅ Served upcoming program from DynamoDB cache (${upcomingEvents.length} events)`)

    // Transform to match the original Google Sheets format that newsletter expects
    const responseData = upcomingEvents.map(event => {
      // The newsletter expects Date objects or parseable date strings
      // Based on the original get-upcoming-program.tsx, dates can be strings or Date objects
      // Keep it simple - the current format "Sunday, July 6, 2025" is actually working fine
      const dateValue = event.date instanceof Date ? event.date : new Date(event.date)
      
      // Extract Date from details to avoid override, then spread the rest
      const { Date: _, ...detailsWithoutDate } = event.details
      
      // Build the result object explicitly to ensure Date field is properly set
      const result: any = {
        ...detailsWithoutDate, // Flatten all the detail fields except Date
        Key: event.type, // Override with the correct Key field
        Date: dateValue, // Set the Date field explicitly
      }
      
      return result
    })

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': `public, max-age=${CACHE_DURATION}, stale-while-revalidate=300`,
        'X-Data-Source': 'dynamodb-cache',
        'X-Event-Count': upcomingEvents.length.toString(),
        'X-Cache-Tags': [CACHE_TAGS.UPCOMING_PROGRAM, CACHE_TAGS.ALL_SCHEDULE_DATA, CACHE_TAGS.ALL_API_RESPONSES].join(','),
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