import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { YouTubeOAuthRepository } from '../dynamodb/repositories/youtube-oauth-repository'

export class YouTubeOAuthManager {
  private oauthClient: OAuth2Client
  private tokenRepo: YouTubeOAuthRepository

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_AUTH_URL
      ? `${process.env.NEXT_PUBLIC_AUTH_URL}/api/youtube/oauth/callback`
      : 'http://localhost:4000/api/youtube/oauth/callback'

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set')
    }

    this.oauthClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
    this.tokenRepo = new YouTubeOAuthRepository()
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl',
    ]

    return this.oauthClient.generateAuthUrl({
      access_type: 'offline', // Required for refresh token
      scope: scopes,
      state: state || '',
      prompt: 'consent', // Force consent screen to always get refresh token
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, userEmail: string): Promise<void> {
    try {
      console.log('🔄 Exchanging authorization code for tokens...')

      const { tokens } = await this.oauthClient.getToken(code)

      if (!tokens.access_token) {
        throw new Error('No access token received')
      }

      console.log('✅ Received tokens from Google')
      console.log('   - Access token:', tokens.access_token ? 'present' : 'missing')
      console.log('   - Refresh token:', tokens.refresh_token ? 'present' : 'missing')
      console.log('   - Expires in:', tokens.expiry_date ? `${Math.floor((tokens.expiry_date - Date.now()) / 1000)}s` : 'unknown')

      // Store tokens in DynamoDB
      await this.tokenRepo.storeTokens(userEmail, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
        scope: tokens.scope || '',
        token_type: tokens.token_type || 'Bearer',
      })

      console.log(`✅ Stored OAuth tokens for ${userEmail}`)
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error)
      throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Get valid access token for user (refresh if needed)
   */
  async getValidAccessToken(userEmail: string): Promise<string> {
    const tokens = await this.tokenRepo.getTokens(userEmail)

    if (!tokens) {
      throw new Error('No OAuth tokens found. Please authorize YouTube access first.')
    }

    // Check if token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000)
    const buffer = 300 // 5 minutes

    if (tokens.expiresAt > (now + buffer)) {
      // Token is still valid
      console.log(`✅ Using cached access token for ${userEmail}`)
      return tokens.accessToken
    }

    // Token expired, need to refresh
    if (!tokens.refreshToken) {
      throw new Error('No refresh token available. Please re-authorize YouTube access.')
    }

    console.log(`🔄 Access token expired, refreshing for ${userEmail}...`)

    try {
      this.oauthClient.setCredentials({
        refresh_token: tokens.refreshToken,
      })

      const { credentials } = await this.oauthClient.refreshAccessToken()

      if (!credentials.access_token) {
        throw new Error('No access token received from refresh')
      }

      // Update stored token
      await this.tokenRepo.updateAccessToken(
        userEmail,
        credentials.access_token,
        credentials.expiry_date ? Math.floor((credentials.expiry_date - Date.now()) / 1000) : 3600
      )

      console.log(`✅ Refreshed access token for ${userEmail}`)
      return credentials.access_token
    } catch (error) {
      console.error('❌ Error refreshing access token:', error)
      throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : error}. Please re-authorize YouTube access.`)
    }
  }

  /**
   * Check if user has authorized YouTube access
   */
  async isAuthorized(userEmail: string): Promise<boolean> {
    return this.tokenRepo.hasTokens(userEmail)
  }

  /**
   * Get stored tokens for user
   */
  async getTokens(userEmail: string) {
    return this.tokenRepo.getTokens(userEmail)
  }

  /**
   * Revoke access and delete tokens
   */
  async revokeAccess(userEmail: string): Promise<void> {
    const tokens = await this.tokenRepo.getTokens(userEmail)

    if (tokens) {
      try {
        // Revoke the token with Google
        await this.oauthClient.revokeToken(tokens.accessToken)
        console.log(`🔓 Revoked YouTube access for ${userEmail}`)
      } catch (error) {
        console.error('⚠️ Error revoking token (may already be invalid):', error)
      }
    }

    // Delete from database
    await this.tokenRepo.deleteTokens(userEmail)
  }

  /**
   * Get OAuth2Client with valid credentials for user
   */
  async getAuthorizedClient(userEmail: string): Promise<OAuth2Client> {
    const accessToken = await this.getValidAccessToken(userEmail)

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    client.setCredentials({
      access_token: accessToken,
    })

    return client
  }
}
