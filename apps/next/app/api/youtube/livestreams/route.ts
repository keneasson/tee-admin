import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeService } from '@my/app/provider/youtube/youtube-service'
import { YouTubeSheetsSync } from '@my/app/provider/youtube/youtube-sheets-sync'
import type { CreateLivestreamRequest } from '@my/app/types/youtube'

/**
 * GET /api/youtube/livestreams
 * List all YouTube livestreams for the channel
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const broadcastStatus = searchParams.get('status') as 'all' | 'active' | 'completed' | 'upcoming' || 'all'
    const maxResults = parseInt(searchParams.get('maxResults') || '50', 10)
    const pageToken = searchParams.get('pageToken') || undefined

    // Initialize YouTube service with OAuth
    const youtubeService = await YouTubeService.createWithOAuth(session.user.email)

    // Fetch livestreams
    console.log(`🔍 Requesting livestreams with status: ${broadcastStatus}, maxResults: ${maxResults}`)
    const response = await youtubeService.listLivestreams({
      broadcastStatus,
      maxResults,
      pageToken,
    })

    console.log(`📊 API returned ${response.items?.length || 0} livestreams`)

    // Log first few items for debugging
    if (response.items && response.items.length > 0) {
      console.log(`📺 Sample livestream:`, {
        title: response.items[0].snippet?.title,
        channelId: response.items[0].snippet?.channelId,
        status: response.items[0].status?.lifeCycleStatus,
        scheduled: response.items[0].snippet?.scheduledStartTime,
      })
    }

    // Simplify the response for easier frontend consumption
    const simplifiedStreams = response.items.map((stream) =>
      youtubeService.simplifyLivestream(stream)
    )

    console.log(`✅ Returning ${simplifiedStreams.length} simplified livestreams to frontend`)

    return NextResponse.json({
      streams: simplifiedStreams,
      pageInfo: response.pageInfo,
      nextPageToken: response.nextPageToken,
      prevPageToken: response.prevPageToken,
    })
  } catch (error) {
    console.error('❌ Error in GET /api/youtube/livestreams:', error)

    // Check if this is an auth/token error that requires re-authorization
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isAuthError = errorMessage.includes('refresh') ||
                        errorMessage.includes('token') ||
                        errorMessage.includes('authorize') ||
                        errorMessage.includes('OAuth')

    return NextResponse.json(
      {
        error: 'Failed to fetch livestreams',
        message: errorMessage,
        requiresReauth: isAuthError,
      },
      { status: isAuthError ? 401 : 500 }
    )
  }
}

/**
 * POST /api/youtube/livestreams
 * Create a new YouTube livestream
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    // Parse request body
    const body: CreateLivestreamRequest = await request.json()

    // Validate required fields
    if (!body.title || !body.scheduledStartTime) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'title and scheduledStartTime are required',
        },
        { status: 400 }
      )
    }

    // Validate date format
    const scheduledDate = new Date(body.scheduledStartTime)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid date format',
          message: 'scheduledStartTime must be a valid ISO 8601 date string',
        },
        { status: 400 }
      )
    }

    // Initialize YouTube service with OAuth
    const youtubeService = await YouTubeService.createWithOAuth(session.user.email)

    // Create the livestream
    console.log(`📺 Creating livestream: ${body.title} for ${body.scheduledStartTime}`)
    const result = await youtubeService.createLivestream(body)

    // Simplify the broadcast data
    const simplifiedBroadcast = youtubeService.simplifyLivestream(result.broadcast)

    console.log(`✅ Livestream created successfully: ${result.watchUrl}`)

    // Sync the YouTube URL to Google Sheets (for Memorial schedule)
    let sheetsSyncSuccess = false
    let sheetsSyncError = null

    try {
      const sheetsSync = new YouTubeSheetsSync()
      sheetsSyncSuccess = await sheetsSync.updateYouTubeUrl(scheduledDate, result.watchUrl)

      if (sheetsSyncSuccess) {
        console.log('✅ Successfully synced YouTube URL to Google Sheets')
        console.log('📊 Existing webhook will trigger DynamoDB sync automatically')
      }
    } catch (error) {
      console.error('⚠️ Warning: Failed to sync YouTube URL to Google Sheets:', error)
      sheetsSyncError = error instanceof Error ? error.message : 'Unknown error'
      // Don't fail the entire request if sheets sync fails
    }

    return NextResponse.json(
      {
        success: true,
        broadcast: simplifiedBroadcast,
        stream: {
          id: result.stream.id,
          streamUrl: result.streamUrl,
          streamKey: result.streamKey,
        },
        watchUrl: result.watchUrl,
        message: 'Livestream created successfully',
        sheetsSync: {
          success: sheetsSyncSuccess,
          error: sheetsSyncError,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('❌ Error in POST /api/youtube/livestreams:', error)

    // Check if this is an auth/token error that requires re-authorization
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isAuthError = errorMessage.includes('refresh') ||
                        errorMessage.includes('token') ||
                        errorMessage.includes('authorize') ||
                        errorMessage.includes('OAuth')

    return NextResponse.json(
      {
        error: 'Failed to create livestream',
        message: errorMessage,
        requiresReauth: isAuthError,
      },
      { status: isAuthError ? 401 : 500 }
    )
  }
}
