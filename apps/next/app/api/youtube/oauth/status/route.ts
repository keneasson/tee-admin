import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeOAuthManager } from '@my/app/provider/youtube/youtube-oauth-manager'

/**
 * GET /api/youtube/oauth/status
 * Check if user has authorized YouTube access
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauthManager = new YouTubeOAuthManager()
    const isAuthorized = await oauthManager.isAuthorized(session.user.email)

    // Get selected channel info if authorized
    let selectedChannel = null
    if (isAuthorized) {
      const tokens = await oauthManager.getTokens(session.user.email)
      if (tokens?.channelId) {
        selectedChannel = {
          id: tokens.channelId,
          title: tokens.channelTitle || 'Unknown Channel',
        }
      }
    }

    return NextResponse.json({
      authorized: isAuthorized,
      email: session.user.email,
      selectedChannel,
    })
  } catch (error) {
    console.error('❌ Error checking OAuth status:', error)
    return NextResponse.json(
      {
        error: 'Failed to check authorization status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/youtube/oauth/status
 * Revoke YouTube access and delete tokens
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oauthManager = new YouTubeOAuthManager()
    await oauthManager.revokeAccess(session.user.email)

    return NextResponse.json({
      success: true,
      message: 'YouTube access revoked successfully',
    })
  } catch (error) {
    console.error('❌ Error revoking OAuth access:', error)
    return NextResponse.json(
      {
        error: 'Failed to revoke access',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
