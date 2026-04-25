import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeService } from '@my/app/provider/youtube/youtube-service'

/**
 * GET /api/youtube/channels
 * List all YouTube channels the authenticated user has access to
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

    // Initialize YouTube service with OAuth
    const youtubeService = await YouTubeService.createWithOAuth(session.user.email)

    // List all channels
    const channels = await youtubeService.listUserChannels()

    return NextResponse.json({
      channels,
      count: channels.length,
    })
  } catch (error) {
    console.error('❌ Error in GET /api/youtube/channels:', error)
    return NextResponse.json(
      {
        error: 'Failed to list channels',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
