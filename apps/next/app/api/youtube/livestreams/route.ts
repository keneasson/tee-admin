import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeService } from '@my/app/provider/youtube/youtube-service'
import { YouTubeSheetsSync } from '@my/app/provider/youtube/youtube-sheets-sync'
import { YouTubeSyncService } from '@my/app/provider/youtube/youtube-sync-service'
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

    // PRIMARY: Sync YouTube URL directly to DynamoDB
    // This is the main data source for newsletter and emails
    let dynamoSyncSuccess = false
    let dynamoSyncError = null
    let dynamoSyncUpdated = 0

    try {
      console.log('🔄 Syncing YouTube URL to DynamoDB...')
      const syncService = await YouTubeSyncService.createWithOAuth(session.user.email)
      // Sync with a narrow window (14 days) to find the matching schedule
      const syncResult = await syncService.syncLivestreamsWithSchedules(14, true) // force=true to update even if exists

      dynamoSyncUpdated = syncResult.updated
      dynamoSyncSuccess = syncResult.updated > 0

      if (dynamoSyncSuccess) {
        console.log(`✅ Successfully synced YouTube URL to DynamoDB (${syncResult.updated} updated)`)
      } else if (syncResult.skipped > 0) {
        console.log(`ℹ️ YouTube URL already synced to DynamoDB (${syncResult.skipped} skipped)`)
        dynamoSyncSuccess = true // Already synced is still success
      } else {
        console.log(`⚠️ No matching Memorial schedule found for ${scheduledDate.toISOString()}`)
        dynamoSyncError = 'No matching Memorial schedule found in DynamoDB'
      }
    } catch (error) {
      console.error('❌ Failed to sync YouTube URL to DynamoDB:', error)
      dynamoSyncError = error instanceof Error ? error.message : 'Unknown error'
    }

    // OPTIONAL: Try to sync to Google Sheets (backup, may not work)
    let sheetsSyncSuccess = false
    try {
      const sheetsSync = new YouTubeSheetsSync()
      sheetsSyncSuccess = await sheetsSync.updateYouTubeUrl(scheduledDate, result.watchUrl)
      if (sheetsSyncSuccess) {
        console.log('✅ Also synced YouTube URL to Google Sheets')
      }
    } catch (error) {
      // Google Sheets sync is optional - don't log as error
      console.log('ℹ️ Google Sheets sync skipped (not configured or failed)')
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
        message: dynamoSyncSuccess
          ? 'Livestream created and synced to DynamoDB'
          : 'Livestream created (DynamoDB sync pending)',
        dynamoSync: {
          success: dynamoSyncSuccess,
          updated: dynamoSyncUpdated,
          error: dynamoSyncError,
        },
        sheetsSync: {
          success: sheetsSyncSuccess,
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
