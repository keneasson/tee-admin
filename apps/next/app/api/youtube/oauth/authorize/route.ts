import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeOAuthManager } from '@my/app/provider/youtube/youtube-oauth-manager'

/**
 * GET /api/youtube/oauth/authorize
 * Redirects user to Google OAuth consent screen
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

    console.log(`🔐 Starting YouTube OAuth flow for ${session.user.email}`)

    // Initialize OAuth manager
    const oauthManager = new YouTubeOAuthManager()

    // Generate authorization URL with user email in state
    const state = Buffer.from(
      JSON.stringify({
        email: session.user.email,
        timestamp: Date.now(),
      })
    ).toString('base64')

    const authUrl = oauthManager.getAuthorizationUrl(state)

    console.log(`📍 Redirecting to: ${authUrl}`)

    // Redirect to Google OAuth consent screen
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('❌ Error in OAuth authorize:', error)
    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
