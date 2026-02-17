#!/usr/bin/env npx tsx
/**
 * One-time script to sync YouTube livestream URLs to DynamoDB
 *
 * Usage: npx tsx scripts/sync-youtube-urls.ts <admin-email>
 *
 * Example: npx tsx scripts/sync-youtube-urls.ts admin@example.com
 *
 * Prerequisites:
 * - The admin email must have valid YouTube OAuth tokens stored in DynamoDB
 *   (i.e., they must have authenticated via the YouTube admin page at least once)
 * - AWS credentials must be configured (for DynamoDB access)
 */

import { YouTubeSyncService } from '../packages/app/provider/youtube/youtube-sync-service'

async function main() {
  const adminEmail = process.argv[2]

  if (!adminEmail) {
    console.error('Usage: npx tsx scripts/sync-youtube-urls.ts <admin-email>')
    console.error('Example: npx tsx scripts/sync-youtube-urls.ts admin@example.com')
    process.exit(1)
  }

  console.log('🔄 YouTube to DynamoDB Sync Script')
  console.log('===================================')
  console.log(`Admin email: ${adminEmail}`)
  console.log(`Days ahead: 60`)
  console.log('')

  try {
    console.log('📺 Creating sync service with OAuth...')
    const syncService = await YouTubeSyncService.createWithOAuth(adminEmail)

    console.log('🔄 Starting sync (this may take a moment)...')
    console.log('')

    const result = await syncService.syncLivestreamsWithSchedules(60, false)

    console.log('')
    console.log('📊 Sync Results')
    console.log('===============')
    console.log(`Total livestreams found: ${result.total}`)
    console.log(`Matched & updated: ${result.updated}`)
    console.log(`Skipped (already set): ${result.skipped}`)
    console.log(`Errors: ${result.errors.length}`)
    console.log('')

    if (result.details.length > 0) {
      console.log('📋 Details:')
      result.details.forEach((detail) => {
        const statusIcon =
          detail.status === 'matched' ? '✅' :
          detail.status === 'already-set' ? '⏭️' :
          detail.status === 'no-schedule' ? '⚠️' : '❌'

        console.log(`  ${statusIcon} ${detail.date}: ${detail.message || detail.status}`)
        if (detail.youtubeUrl) {
          console.log(`     URL: ${detail.youtubeUrl}`)
        }
      })
    }

    if (result.errors.length > 0) {
      console.log('')
      console.log('❌ Errors:')
      result.errors.forEach((error) => {
        console.log(`  - ${error}`)
      })
    }

    console.log('')
    console.log('✅ Sync complete!')

  } catch (error) {
    console.error('')
    console.error('❌ Sync failed:', error instanceof Error ? error.message : error)
    console.error('')
    console.error('Troubleshooting:')
    console.error('1. Make sure the admin email has authenticated with YouTube via the admin UI')
    console.error('2. Make sure AWS credentials are configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)')
    console.error('3. Check that the DynamoDB tables exist (tee-admin, tee-schedules)')
    process.exit(1)
  }
}

main()
