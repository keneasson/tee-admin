import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { ProgramTypeKeys } from '@my/app/types'
import { CACHE_TAGS } from '../../../utils/cache'

// Cache for 15 minutes in production (shorter for faster updates when debugging)
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 900 : 0

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

    // Fetch from DynamoDB with caching (no fallback)
    const upcomingEvents = await getCachedUpcomingProgram(orderOfKeys)
    
    console.log(`✅ Served upcoming program from DynamoDB cache (${upcomingEvents.length} events)`)

    // Transform to match the original Google Sheets format that newsletter expects
    const responseData = upcomingEvents.map(event => {
      // The newsletter expects human-readable formatted date strings like "Sunday, August 31, 2025"
      const dateValue = event.date instanceof Date ? event.date : new Date(event.date)
      
      // Format date to match production format: "Sunday, August 31, 2025"
      const formattedDate = dateValue.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric', 
        month: 'long',
        day: 'numeric'
      })
      
      // Extract Date from details to avoid override, then spread the rest
      const { Date: _, ...detailsWithoutDate } = event.details
      
      // Build the result object explicitly to ensure Date field is properly set
      const result: any = {
        ...detailsWithoutDate, // Flatten all the detail fields except Date
        Key: event.type, // Override with the correct Key field
        Date: formattedDate, // Set the Date field with human-readable format
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