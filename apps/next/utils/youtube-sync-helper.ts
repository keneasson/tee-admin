/**
 * YouTube Sync Helper
 *
 * Provides automatic YouTube URL sync functionality before email generation.
 * Uses stored OAuth tokens from a configured admin user to sync livestream URLs
 * with Memorial service schedules in DynamoDB.
 */

import { YouTubeSyncService } from '@my/app/provider/youtube/youtube-sync-service'
import { YouTubeOAuthRepository } from '@my/app/provider/dynamodb/repositories/youtube-oauth-repository'

/**
 * Attempt to sync YouTube livestream URLs with DynamoDB schedules.
 * This function is designed to be called before email generation.
 *
 * @param daysAhead - Number of days ahead to sync (default: 14)
 * @returns Sync result or null if sync couldn't be performed
 */
export async function syncYouTubeUrlsForEmail(daysAhead: number = 14): Promise<{
  success: boolean
  message: string
  updated?: number
  skipped?: number
} | null> {
  try {
    // Get the configured YouTube admin email, or fall back to any user with valid tokens
    const adminEmail = process.env.YOUTUBE_ADMIN_EMAIL

    if (!adminEmail) {
      console.log('⚠️ YOUTUBE_ADMIN_EMAIL not configured - attempting to find user with valid tokens')

      // Try to find any user with valid YouTube OAuth tokens
      const tokenRepo = new YouTubeOAuthRepository()
      const firstUserWithTokens = await findFirstUserWithValidTokens(tokenRepo)

      if (!firstUserWithTokens) {
        console.log('⚠️ No YouTube OAuth tokens found - skipping YouTube sync')
        return {
          success: false,
          message: 'No YouTube OAuth tokens available for sync',
        }
      }

      return await performSync(firstUserWithTokens, daysAhead)
    }

    return await performSync(adminEmail, daysAhead)
  } catch (error) {
    console.error('❌ YouTube sync helper error:', error)
    return {
      success: false,
      message: `YouTube sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Perform the actual YouTube sync for a given user email
 */
async function performSync(userEmail: string, daysAhead: number): Promise<{
  success: boolean
  message: string
  updated?: number
  skipped?: number
}> {
  try {
    console.log(`🔄 Starting automatic YouTube sync for ${userEmail}...`)

    const syncService = await YouTubeSyncService.createWithOAuth(userEmail)
    const result = await syncService.syncLivestreamsWithSchedules(daysAhead, false)

    console.log(`✅ YouTube sync completed: ${result.updated} updated, ${result.skipped} skipped`)

    return {
      success: true,
      message: `Synced ${result.updated} YouTube URLs`,
      updated: result.updated,
      skipped: result.skipped,
    }
  } catch (error) {
    console.error(`❌ YouTube sync failed for ${userEmail}:`, error)
    return {
      success: false,
      message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Find the first user with valid YouTube OAuth tokens
 * This is a fallback when YOUTUBE_ADMIN_EMAIL is not configured
 */
async function findFirstUserWithValidTokens(
  tokenRepo: YouTubeOAuthRepository
): Promise<string | null> {
  try {
    // Query for any stored tokens
    const allTokens = await tokenRepo.listAllTokens()

    if (!allTokens || allTokens.length === 0) {
      return null
    }

    // Return the first user's email with a refresh token
    const firstToken = allTokens.find((t) => t.hasRefreshToken)
    if (firstToken?.userEmail) {
      console.log(`📺 Using YouTube OAuth tokens for: ${firstToken.userEmail}`)
      return firstToken.userEmail
    }

    return null
  } catch (error) {
    console.error('Error finding user with valid tokens:', error)
    return null
  }
}
