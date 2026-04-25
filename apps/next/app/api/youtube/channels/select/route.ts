import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeOAuthRepository } from '@my/app/provider/dynamodb/repositories/youtube-oauth-repository'

/**
 * POST /api/youtube/channels/select
 * Select a YouTube channel to use for livestream management
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
    const body = await request.json()
    const { channelId, channelTitle } = body

    if (!channelId || !channelTitle) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'channelId and channelTitle are required',
        },
        { status: 400 }
      )
    }

    // Update selected channel
    const tokenRepo = new YouTubeOAuthRepository()
    await tokenRepo.updateSelectedChannel(session.user.email, channelId, channelTitle)

    console.log(`✅ Selected YouTube channel for ${session.user.email}: ${channelTitle} (${channelId})`)

    return NextResponse.json({
      success: true,
      channelId,
      channelTitle,
      message: `Selected channel: ${channelTitle}`,
    })
  } catch (error) {
    console.error('❌ Error in POST /api/youtube/channels/select:', error)
    return NextResponse.json(
      {
        error: 'Failed to select channel',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
