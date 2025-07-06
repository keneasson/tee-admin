import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { 
  invalidateScheduleCache, 
  invalidateDirectoryCache, 
  invalidateAllCache,
  CACHE_TAGS,
  getAllSheetMappings 
} from '../../../../utils/cache'

export async function POST(request: NextRequest) {
  try {
    // Authenticate user - only admins/owners can invalidate cache
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has permission to invalidate cache
    const userRole = session.user.role
    if (!userRole || ![ROLES.OWNER, ROLES.ADMIN].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, sheetType } = body

    console.log(`🗄️ Cache invalidation request from ${session.user.email}:`, { type, sheetType })

    let invalidatedTags: string[] = []

    switch (type) {
      case 'schedule':
        if (!sheetType) {
          return NextResponse.json(
            { error: 'sheetType required for schedule invalidation' },
            { status: 400 }
          )
        }
        await invalidateScheduleCache(sheetType)
        invalidatedTags = Object.values(CACHE_TAGS).filter(tag => 
          tag.includes('schedule') || tag.includes('upcoming') || tag.includes('api')
        )
        break

      case 'directory':
        await invalidateDirectoryCache()
        invalidatedTags = [CACHE_TAGS.DIRECTORY, CACHE_TAGS.ALL_API_RESPONSES]
        break

      case 'all':
        await invalidateAllCache()
        invalidatedTags = Object.values(CACHE_TAGS)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: schedule, directory, or all' },
          { status: 400 }
        )
    }

    const response = {
      success: true,
      message: `Cache invalidation completed for type: ${type}`,
      invalidatedTags,
      requestedBy: session.user.email,
      timestamp: new Date().toISOString(),
    }

    console.log('✅ Cache invalidation completed:', response)

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Cache invalidation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get cache status/info
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userRole = session.user.role
    if (!userRole || ![ROLES.OWNER, ROLES.ADMIN].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      status: 'Cache management available',
      availableTags: Object.entries(CACHE_TAGS).map(([key, value]) => ({
        key,
        tag: value
      })),
      configuredSheets: getAllSheetMappings(),
      endpoints: {
        invalidate: 'POST /api/cache/invalidate',
        status: 'GET /api/cache/invalidate',
      },
      usage: {
        'Invalidate schedule cache': 'POST { "type": "schedule", "sheetType": "memorial|bibleClass|sundaySchool" }',
        'Invalidate directory cache': 'POST { "type": "directory" }',
        'Invalidate all cache': 'POST { "type": "all" }',
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('❌ Cache status error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}