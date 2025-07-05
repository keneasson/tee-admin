import { NextRequest, NextResponse } from 'next/server'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { auth } from '../../../utils/auth'

// Cache for 15 minutes in production (directory data changes less frequently)
const CACHE_DURATION = process.env.NODE_ENV === 'production' ? 900 : 0

const scheduleService = new ScheduleService()

export async function GET(request: NextRequest) {
  try {
    // Check authentication - directory data requires auth
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('📋 API request for directory data')

    // Check data freshness
    const isDataFresh = await scheduleService.isDataFresh('directory', 120) // 2 hour freshness for directory
    
    if (!isDataFresh) {
      console.warn('⚠️ Directory data is stale, falling back to Google Sheets')
      
      // Fallback to original Google Sheets API
      try {
        const { get_google_sheet } = await import('../../../utils/get-google-sheets')
        const directoryData = await get_google_sheet('directory')
        
        return NextResponse.json(directoryData, {
          headers: {
            'Cache-Control': `private, max-age=300, stale-while-revalidate=60`, // Private cache for sensitive data
            'X-Data-Source': 'google-sheets-fallback',
          },
        })
      } catch (fallbackError) {
        console.error('❌ Fallback to Google Sheets failed for directory:', fallbackError)
        return NextResponse.json(
          { error: 'Directory data temporarily unavailable' },
          { status: 503 }
        )
      }
    }

    // Fetch from DynamoDB
    const directoryData = await scheduleService.getDirectoryData()
    
    if (!directoryData) {
      console.warn('⚠️ No directory data found in DynamoDB')
      return NextResponse.json(
        { error: 'Directory data not available' },
        { status: 404 }
      )
    }

    console.log('✅ Served directory data from DynamoDB cache')

    return NextResponse.json(directoryData, {
      headers: {
        'Cache-Control': `private, max-age=${CACHE_DURATION}, stale-while-revalidate=120`,
        'X-Data-Source': 'dynamodb-cache',
        'X-Last-Updated': directoryData.lastUpdated || '',
      },
    })

  } catch (error) {
    console.error('❌ Error serving directory data:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
      },
      { status: 500 }
    )
  }
}

// Handle POST for user lookup (used by authentication)
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    console.log(`👤 API request for user lookup: ${email}`)

    // Check data freshness
    const isDataFresh = await scheduleService.isDataFresh('directory', 60) // 1 hour for user lookup
    
    if (!isDataFresh) {
      console.warn(`⚠️ Directory data is stale for user lookup: ${email}, falling back to Google Sheets`)
      
      // Fallback to original user lookup
      try {
        const { userFromLegacy } = await import('../../../utils/user-from-legacy')
        const user = await userFromLegacy({ email })
        
        return NextResponse.json({ user }, {
          headers: {
            'Cache-Control': 'private, max-age=300', // 5 min cache for user lookup
            'X-Data-Source': 'google-sheets-fallback',
          },
        })
      } catch (fallbackError) {
        console.error(`❌ Fallback user lookup failed for ${email}:`, fallbackError)
        return NextResponse.json(
          { error: 'User lookup temporarily unavailable' },
          { status: 503 }
        )
      }
    }

    // Lookup user in DynamoDB
    const user = await scheduleService.getUserFromDirectory(email)
    
    if (!user) {
      console.log(`👤 User not found: ${email}`)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log(`✅ User lookup successful from DynamoDB: ${email}`)

    return NextResponse.json({ user }, {
      headers: {
        'Cache-Control': 'private, max-age=900', // 15 min cache for successful user lookup
        'X-Data-Source': 'dynamodb-cache',
      },
    })

  } catch (error) {
    console.error('❌ Error in user lookup:', error)
    
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}