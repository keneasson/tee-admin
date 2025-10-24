import { NextRequest, NextResponse } from 'next/server'
import { YouTubeOAuthManager } from '@my/app/provider/youtube/youtube-oauth-manager'

/**
 * GET /api/youtube/oauth/callback
 * Handles OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Check for OAuth errors
    if (error) {
      console.error('❌ OAuth error:', error)
      const errorDescription = searchParams.get('error_description') || error
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/admin/youtube?error=${encodeURIComponent(errorDescription)}`
      )
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing code or state parameter')
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/admin/youtube?error=missing_parameters`
      )
    }

    // Decode state to get user email
    let userEmail: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
      userEmail = stateData.email

      if (!userEmail) {
        throw new Error('No email in state')
      }
    } catch (error) {
      console.error('❌ Invalid state parameter:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/admin/youtube?error=invalid_state`
      )
    }

    console.log(`✅ OAuth callback received for ${userEmail}`)
    console.log(`🔑 Authorization code: ${code.substring(0, 20)}...`)

    // Exchange code for tokens
    const oauthManager = new YouTubeOAuthManager()
    await oauthManager.exchangeCodeForTokens(code, userEmail)

    console.log(`✅ OAuth flow complete for ${userEmail}`)

    // Redirect back to YouTube admin page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/admin/youtube?success=authorized`
    )
  } catch (error) {
    console.error('❌ Error in OAuth callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/admin/youtube?error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`
    )
  }
}
