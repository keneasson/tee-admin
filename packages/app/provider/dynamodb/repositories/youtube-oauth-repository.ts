import { BaseRepository } from './base-repository'

export interface YouTubeOAuthToken {
  pkey: string // USER#email
  skey: string // OAUTH#youtube
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp
  scope: string
  tokenType: string
  channelId?: string // Selected YouTube channel ID
  channelTitle?: string // Selected YouTube channel title
  createdAt: string
  updatedAt: string
}

export class YouTubeOAuthRepository extends BaseRepository<YouTubeOAuthToken> {
  constructor() {
    super('admin') // Uses tee-admin table
  }

  private buildPK(userEmail: string): string {
    return `USER#${userEmail}`
  }

  private buildSK(): string {
    return 'OAUTH#youtube'
  }

  /**
   * Store OAuth tokens for a user
   */
  async storeTokens(
    userEmail: string,
    tokens: {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
      token_type: string
    }
  ): Promise<YouTubeOAuthToken> {
    const now = new Date().toISOString()
    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in

    // Get existing token to preserve refresh_token if not provided
    let existingRefreshToken: string | undefined
    try {
      const existing = await this.getTokens(userEmail)
      if (existing && !tokens.refresh_token) {
        existingRefreshToken = existing.refreshToken
      }
    } catch (error) {
      // No existing token, that's fine
    }

    const record: YouTubeOAuthToken = {
      pkey: this.buildPK(userEmail),
      skey: this.buildSK(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || existingRefreshToken || '',
      expiresAt,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      createdAt: now,
      updatedAt: now,
    }

    await this.put(record)
    console.log(`✅ Stored YouTube OAuth tokens for ${userEmail}`)
    return record
  }

  /**
   * Get OAuth tokens for a user
   */
  async getTokens(userEmail: string): Promise<YouTubeOAuthToken | null> {
    return this.get(this.buildPK(userEmail), this.buildSK())
  }

  /**
   * Check if tokens exist and are valid
   */
  async hasValidTokens(userEmail: string): Promise<boolean> {
    const tokens = await this.getTokens(userEmail)
    if (!tokens) {
      return false
    }

    // Check if access token is expired (with 5 minute buffer)
    const now = Math.floor(Date.now() / 1000)
    const buffer = 300 // 5 minutes
    return tokens.expiresAt > (now + buffer)
  }

  /**
   * Check if tokens exist (even if expired, as long as we have refresh token)
   */
  async hasTokens(userEmail: string): Promise<boolean> {
    const tokens = await this.getTokens(userEmail)
    return !!(tokens && tokens.refreshToken)
  }

  /**
   * Delete OAuth tokens for a user
   */
  async deleteTokens(userEmail: string): Promise<void> {
    await this.delete(this.buildPK(userEmail), this.buildSK())
    console.log(`🗑️ Deleted YouTube OAuth tokens for ${userEmail}`)
  }

  /**
   * Update access token after refresh
   */
  async updateAccessToken(
    userEmail: string,
    accessToken: string,
    expiresIn: number
  ): Promise<void> {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn

    await this.update(this.buildPK(userEmail), this.buildSK(), {
      accessToken,
      expiresAt,
      updatedAt: new Date().toISOString(),
    })

    console.log(`🔄 Refreshed YouTube OAuth token for ${userEmail}`)
  }

  /**
   * Update selected channel for user
   */
  async updateSelectedChannel(
    userEmail: string,
    channelId: string,
    channelTitle: string
  ): Promise<void> {
    await this.update(this.buildPK(userEmail), this.buildSK(), {
      channelId,
      channelTitle,
      updatedAt: new Date().toISOString(),
    })

    console.log(`🎬 Updated selected YouTube channel for ${userEmail}: ${channelTitle}`)
  }

  /**
   * Not used for OAuth tokens (required by BaseRepository)
   */
  protected buildSheetPK(sheetId: string): string {
    throw new Error('buildSheetPK is not applicable for YouTube OAuth tokens')
  }
}
