import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeSyncService } from '@my/app/provider/youtube/youtube-sync-service'

/**
 * POST /api/youtube/sync
 *
 * Sync YouTube livestream URLs with Memorial service schedules in DynamoDB
 *
 * Query Parameters:
 * - daysAhead: Number of days ahead to sync (default: 60)
 * - force: Force update even if YouTube URL already exists (default: false)
 *
 * Returns:
 * - Sync result summary with matched/updated/skipped counts
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Owner role required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const daysAhead = parseInt(searchParams.get('daysAhead') || '60', 10)
    const force = searchParams.get('force') === 'true'

    console.log(`🔄 Starting YouTube sync for ${session.user.email}`)
    console.log(`   Days ahead: ${daysAhead}`)
    console.log(`   Force update: ${force}`)

    // Create sync service with OAuth
    const syncService = await YouTubeSyncService.createWithOAuth(session.user.email)

    // Run the sync
    const result = await syncService.syncLivestreamsWithSchedules(daysAhead, force)

    console.log('✅ YouTube sync completed:', result)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('❌ YouTube sync error:', error)
    return NextResponse.json(
      {
        error: 'Failed to sync YouTube livestreams',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/youtube/sync/verify
 *
 * Verify YouTube URLs in schedules are still valid
 *
 * Query Parameters:
 * - daysAhead: Number of days ahead to verify (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin/owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Owner role required' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const daysAhead = parseInt(searchParams.get('daysAhead') || '30', 10)

    console.log(`🔍 Verifying YouTube URLs for ${session.user.email}`)
    console.log(`   Days ahead: ${daysAhead}`)

    // Create sync service with OAuth
    const syncService = await YouTubeSyncService.createWithOAuth(session.user.email)

    // Verify URLs
    const result = await syncService.verifyYouTubeUrls(daysAhead)

    console.log('✅ YouTube URL verification completed:', result)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('❌ YouTube verification error:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify YouTube URLs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
