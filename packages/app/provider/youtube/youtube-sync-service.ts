import { YouTubeService } from './youtube-service'
import { ScheduleRepository } from '../dynamodb/repositories/schedule-repository'
import type { ScheduleRecord } from '../dynamodb/types'
import type { MemorialServiceType } from '@my/app/types'

export interface YouTubeSyncResult {
  total: number
  matched: number
  updated: number
  skipped: number
  errors: string[]
  details: Array<{
    date: string
    youtubeUrl?: string
    status: 'matched' | 'no-schedule' | 'already-set' | 'error'
    message?: string
  }>
}

export class YouTubeSyncService {
  private youtubeService: YouTubeService
  private scheduleRepo: ScheduleRepository

  constructor(youtubeService: YouTubeService) {
    this.youtubeService = youtubeService
    this.scheduleRepo = new ScheduleRepository()
  }

  /**
   * Create a YouTubeSyncService with OAuth credentials for a user
   */
  static async createWithOAuth(userEmail: string): Promise<YouTubeSyncService> {
    const youtubeService = await YouTubeService.createWithOAuth(userEmail)
    return new YouTubeSyncService(youtubeService)
  }

  /**
   * Sync YouTube livestream URLs with Memorial service schedules in DynamoDB
   *
   * @param daysAhead - Number of days ahead to sync (default: 60)
   * @param force - Force update even if YouTube URL already exists (default: false)
   * @returns Sync result summary
   */
  async syncLivestreamsWithSchedules(
    daysAhead: number = 60,
    force: boolean = false
  ): Promise<YouTubeSyncResult> {
    const result: YouTubeSyncResult = {
      total: 0,
      matched: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      details: [],
    }

    try {
      // 1. Fetch upcoming livestreams from YouTube
      console.log('📺 Fetching upcoming YouTube livestreams...')
      const livestreamsResponse = await this.youtubeService.listLivestreams({
        broadcastStatus: 'upcoming',
        maxResults: 50,
      })

      const livestreams = livestreamsResponse.items || []
      result.total = livestreams.length
      console.log(`✅ Found ${livestreams.length} upcoming livestreams`)

      // 2. Fetch upcoming Memorial services from DynamoDB
      const startDate = new Date().toISOString().split('T')[0]
      const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]

      console.log(`📅 Fetching Memorial schedules from ${startDate} to ${endDate}...`)

      // Query directly on PK with SK BETWEEN for precise date range
      // PK: SCHEDULE#MEMORIAL
      // SK format: DATE#2025-10-26T00:00:00.000Z#0
      // Use BETWEEN to get only the date range we need
      const startSK = `DATE#${startDate}`  // e.g., DATE#2025-10-23
      const endSK = `DATE#${endDate}#zzz`  // e.g., DATE#2025-12-22#zzz (includes all times/indexes)

      const schedulesResult = await this.scheduleRepo['query'](
        'PK = :pk AND SK BETWEEN :startSK AND :endSK',
        {
          ':pk': 'SCHEDULE#MEMORIAL',
          ':startSK': startSK,
          ':endSK': endSK,
        },
        {
          scanIndexForward: true,
        }
      )

      const schedules = schedulesResult.items
      console.log(`✅ Found ${schedules.length} Memorial services`)

      // Log the dates we have in DynamoDB for debugging
      if (schedules.length > 0) {
        console.log('📅 Memorial service dates in DynamoDB:')
        schedules.forEach(schedule => {
          const scheduleDate = new Date(schedule.date).toISOString().split('T')[0]
          console.log(`   - ${scheduleDate} (stored as: ${schedule.date})`)
        })
      }

      // 3. Match livestreams with schedules by date
      for (const livestream of livestreams) {
        const scheduledStartTime = livestream.snippet?.scheduledStartTime
        if (!scheduledStartTime) {
          result.details.push({
            date: 'unknown',
            status: 'error',
            message: `Livestream "${livestream.snippet?.title}" has no scheduled start time`,
          })
          result.errors.push(
            `Livestream "${livestream.snippet?.title}" has no scheduled start time`
          )
          continue
        }

        // Extract date from livestream (YYYY-MM-DD format)
        const livestreamDate = new Date(scheduledStartTime).toISOString().split('T')[0]
        const youtubeUrl = `https://www.youtube.com/watch?v=${livestream.id}`

        console.log(
          `🔍 Looking for Memorial service on ${livestreamDate} (YouTube scheduled: ${scheduledStartTime})`
        )

        // Find matching schedule by date
        const matchingSchedules = schedules.filter((schedule) => {
          const scheduleDate = new Date(schedule.date).toISOString().split('T')[0]
          const matches = scheduleDate === livestreamDate
          if (!matches) {
            console.log(`   ❌ ${scheduleDate} !== ${livestreamDate} (schedule.date: ${schedule.date})`)
          } else {
            console.log(`   ✅ Match found! ${scheduleDate} === ${livestreamDate}`)
          }
          return matches
        })

        if (matchingSchedules.length === 0) {
          result.details.push({
            date: livestreamDate,
            youtubeUrl,
            status: 'no-schedule',
            message: `No Memorial service found for ${livestreamDate}`,
          })
          result.skipped++
          console.log(`⏭️  No Memorial service found for ${livestreamDate}`)
          continue
        }

        // Take the first matching schedule (there should typically only be one Memorial per day)
        const schedule = matchingSchedules[0]
        const scheduleData = schedule.data as MemorialServiceType

        // Check if YouTube URL already exists
        if (scheduleData.YouTube && !force) {
          result.details.push({
            date: livestreamDate,
            youtubeUrl: scheduleData.YouTube,
            status: 'already-set',
            message: `YouTube URL already set: ${scheduleData.YouTube}`,
          })
          result.skipped++
          console.log(`⏭️  YouTube URL already set for ${livestreamDate}: ${scheduleData.YouTube}`)
          continue
        }

        // Update the schedule with YouTube URL
        try {
          const updatedData: MemorialServiceType = {
            ...scheduleData,
            YouTube: youtubeUrl,
          }

          // Update using the record's primary keys
          await this.scheduleRepo.update(
            schedule.PK,
            schedule.SK,
            { data: updatedData }
          )

          result.details.push({
            date: livestreamDate,
            youtubeUrl,
            status: 'matched',
            message: `Updated Memorial service for ${schedule.ecclesia}`,
          })
          result.matched++
          result.updated++
          console.log(`✅ Updated ${livestreamDate} with YouTube URL: ${youtubeUrl}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          result.details.push({
            date: livestreamDate,
            youtubeUrl,
            status: 'error',
            message: `Failed to update: ${errorMessage}`,
          })
          result.errors.push(`Failed to update ${livestreamDate}: ${errorMessage}`)
          console.error(`❌ Failed to update ${livestreamDate}:`, error)
        }
      }

      console.log('🎉 YouTube sync completed!')
      console.log(`   Total livestreams: ${result.total}`)
      console.log(`   Matched & updated: ${result.updated}`)
      console.log(`   Skipped: ${result.skipped}`)
      console.log(`   Errors: ${result.errors.length}`)

      return result
    } catch (error) {
      console.error('❌ YouTube sync failed:', error)
      result.errors.push(
        `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return result
    }
  }

  /**
   * Verify YouTube URLs in schedules by checking if they're still valid
   *
   * @param daysAhead - Number of days ahead to verify (default: 30)
   * @returns Verification result summary
   */
  async verifyYouTubeUrls(daysAhead: number = 30): Promise<{
    total: number
    valid: number
    invalid: number
    missing: number
    details: Array<{
      date: string
      youtubeUrl?: string
      status: 'valid' | 'invalid' | 'missing'
    }>
  }> {
    const result = {
      total: 0,
      valid: 0,
      invalid: 0,
      missing: 0,
      details: [] as Array<{
        date: string
        youtubeUrl?: string
        status: 'valid' | 'invalid' | 'missing'
      }>,
    }

    // Fetch upcoming Memorial services
    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const schedulesResult = await this.scheduleRepo.getSchedulesByTypeAndDateRange('memorial', {
      startDate,
      endDate,
    })

    result.total = schedulesResult.items.length

    for (const schedule of schedulesResult.items) {
      const scheduleDate = new Date(schedule.date).toISOString().split('T')[0]
      const scheduleData = schedule.data as MemorialServiceType

      if (!scheduleData.YouTube) {
        result.missing++
        result.details.push({
          date: scheduleDate,
          status: 'missing',
        })
        continue
      }

      // Extract video ID from URL
      const match = scheduleData.YouTube.match(/[?&]v=([^&]+)/)
      if (!match) {
        result.invalid++
        result.details.push({
          date: scheduleDate,
          youtubeUrl: scheduleData.YouTube,
          status: 'invalid',
        })
        continue
      }

      // For now, just mark as valid if it has a properly formatted URL
      // Could add actual API verification here
      result.valid++
      result.details.push({
        date: scheduleDate,
        youtubeUrl: scheduleData.YouTube,
        status: 'valid',
      })
    }

    return result
  }
}
