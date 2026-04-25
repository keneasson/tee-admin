import { google } from 'googleapis'
import { YouTubeOAuthManager } from './youtube-oauth-manager'
import type {
  YouTubeLivestream,
  YouTubeStream,
  CreateLivestreamRequest,
  CreateLivestreamResponse,
  YouTubeLivestreamsListResponse,
  YouTubeLivestreamSimplified,
  YouTubeChannel,
} from '@my/app/types/youtube'

export class YouTubeService {
  private youtube: any
  private channelId: string

  /**
   * Create YouTubeService instance with OAuth authentication
   * This is the recommended method for managing livestreams
   */
  static async createWithOAuth(userEmail: string, channelId?: string): Promise<YouTubeService> {
    const oauthManager = new YouTubeOAuthManager()
    const authClient = await oauthManager.getAuthorizedClient(userEmail)

    // Get selected channel ID from stored tokens if not provided
    if (!channelId) {
      const tokens = await oauthManager.getTokens(userEmail)
      if (tokens?.channelId) {
        channelId = tokens.channelId
        console.log(`📺 Using selected channel from tokens: ${tokens.channelTitle} (${channelId})`)
      }
    }

    return new YouTubeService(channelId, authClient)
  }

  constructor(channelId?: string, authClient?: any) {
    if (authClient) {
      // Use provided OAuth client
      this.youtube = google.youtube({ version: 'v3', auth: authClient })
      this.channelId = channelId || 'UCyJamaI5mQImCF8hWE7Yp-w'
      console.log('📺 YouTube service initialized with OAuth authentication')
      return
    }
    // Initialize Google APIs with service account
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE

    let auth: any
    if (keyFile && keyFile.startsWith('./')) {
      // Use key file path (for production)
      auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: [
          'https://www.googleapis.com/auth/youtube',
          'https://www.googleapis.com/auth/youtube.force-ssl',
        ],
      })
    } else {
      // Try to load credentials from the service account file directly
      let credentials: any = null

      try {
        // Try to read from the standard service account file location
        const fs = require('fs')
        const path = require('path')

        // Check for the service account file in multiple locations
        const possiblePaths = [
          './apps/next/tee-services-db47a9e534d3.json',
          '../apps/next/tee-services-db47a9e534d3.json',
          '../../apps/next/tee-services-db47a9e534d3.json',
          process.cwd() + '/apps/next/tee-services-db47a9e534d3.json',
        ]

        for (const filePath of possiblePaths) {
          try {
            if (fs.existsSync(filePath)) {
              credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'))
              console.log('📺 Loaded Google service account for YouTube from:', filePath)
              break
            }
          } catch (e) {
            // Continue to next path
          }
        }
      } catch (e) {
        // Fall back to environment variables
      }

      if (!credentials) {
        // Try GOOGLE_SERVICE_ACCOUNT_KEY first (full JSON as environment variable)
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
        if (serviceAccountKey) {
          try {
            credentials = JSON.parse(serviceAccountKey)
            console.log('📺 Loaded Google service account for YouTube from environment variable')
          } catch (e) {
            console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', e)
          }
        }

        // Fallback to individual environment variables
        if (!credentials) {
          const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
          const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

          if (serviceAccountEmail && privateKey) {
            credentials = {
              client_email: serviceAccountEmail,
              private_key: privateKey,
            }
          } else {
            throw new Error(
              'Google Service Account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE, GOOGLE_SERVICE_ACCOUNT_KEY, or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY, or ensure tee-services-db47a9e534d3.json exists'
            )
          }
        }
      }

      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/youtube',
          'https://www.googleapis.com/auth/youtube.force-ssl',
        ],
      })
    }

    this.youtube = google.youtube({ version: 'v3', auth })

    // Store the channel ID (Toronto East Christadelphians)
    // UCyJamaI5mQImCF8hWE7Yp-w
    this.channelId = channelId || 'UCyJamaI5mQImCF8hWE7Yp-w'
  }

  /**
   * List all channels the authenticated user has access to
   * This includes both personal channels and Brand Accounts
   */
  async listUserChannels(): Promise<YouTubeChannel[]> {
    try {
      console.log('📺 Fetching YouTube channels for authenticated user...')

      // First, get the user's own channels
      const myChannelsResponse = await this.youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        mine: true,
        maxResults: 50,
      })

      const channelsMap = new Map<string, YouTubeChannel>()

      // Add personal/default channels
      if (myChannelsResponse.data.items) {
        myChannelsResponse.data.items.forEach((channel: any) => {
          channelsMap.set(channel.id, {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            customUrl: channel.snippet.customUrl,
            thumbnailUrl: channel.snippet.thumbnails?.default?.url,
            subscriberCount: channel.statistics?.subscriberCount,
          })
        })
      }

      // Try to get the specific Toronto East channel by ID
      // This works for Brand Accounts that the user manages
      try {
        const brandChannelResponse = await this.youtube.channels.list({
          part: ['snippet', 'statistics', 'contentDetails'],
          id: ['UCyJamaI5mQImCF8hWE7Yp-w'],
        })

        if (brandChannelResponse.data.items && brandChannelResponse.data.items.length > 0) {
          const channel = brandChannelResponse.data.items[0]
          channelsMap.set(channel.id, {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            customUrl: channel.snippet.customUrl,
            thumbnailUrl: channel.snippet.thumbnails?.default?.url,
            subscriberCount: channel.statistics?.subscriberCount,
          })
          console.log('✅ Found Toronto East Christadelphians Brand Account')
        }
      } catch (error) {
        console.log('⚠️ Could not access Toronto East channel - may need additional permissions')
      }

      const channels = Array.from(channelsMap.values())
      console.log(`✅ Found ${channels.length} channel(s):`, channels.map(c => c.title))

      return channels
    } catch (error) {
      console.error('❌ Error listing user channels:', error)
      throw new Error(`Failed to list user channels: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Get channel information
   */
  async getChannelInfo(): Promise<YouTubeChannel | null> {
    try {
      console.log(`📺 Fetching YouTube channel info for: ${this.channelId}`)

      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: [this.channelId],
      })

      if (!response.data.items || response.data.items.length === 0) {
        console.error('❌ Channel not found')
        return null
      }

      const channel = response.data.items[0]
      return {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        customUrl: channel.snippet.customUrl,
        thumbnailUrl: channel.snippet.thumbnails?.default?.url,
        subscriberCount: channel.statistics?.subscriberCount,
      }
    } catch (error) {
      console.error('❌ Error fetching channel info:', error)
      throw new Error(`Failed to fetch channel info: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * List all livestreams for the channel
   * NOTE: YouTube API doesn't support filtering by channel ID, so we filter client-side
   */
  async listLivestreams(options?: {
    broadcastStatus?: 'all' | 'active' | 'completed' | 'upcoming'
    maxResults?: number
    pageToken?: string
  }): Promise<YouTubeLivestreamsListResponse> {
    try {
      const { broadcastStatus = 'all', maxResults = 50, pageToken } = options || {}

      console.log(`📺 Fetching YouTube livestreams for channel ${this.channelId} (status: ${broadcastStatus})`)

      const response = await this.youtube.liveBroadcasts.list({
        part: ['snippet', 'status', 'contentDetails'],
        broadcastStatus,
        maxResults,
        pageToken,
      })

      console.log(`📺 Retrieved ${response.data.items?.length || 0} total livestreams from API`)

      // Filter broadcasts by the selected channel ID
      // The API returns broadcasts from ALL channels the user has access to
      const filteredItems = (response.data.items || []).filter((broadcast: any) => {
        const broadcastChannelId = broadcast.snippet?.channelId
        const matches = broadcastChannelId === this.channelId
        if (!matches) {
          console.log(`   ⏭️  Skipping broadcast "${broadcast.snippet?.title}" from channel ${broadcastChannelId}`)
        }
        return matches
      })

      console.log(`✅ Filtered to ${filteredItems.length} livestreams for channel ${this.channelId}`)

      return {
        ...response.data,
        items: filteredItems,
        pageInfo: {
          ...response.data.pageInfo,
          totalResults: filteredItems.length,
          resultsPerPage: filteredItems.length,
        },
      } as YouTubeLivestreamsListResponse
    } catch (error) {
      console.error('❌ Error listing livestreams:', error)
      throw new Error(`Failed to list livestreams: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Get a specific livestream by ID
   */
  async getLivestream(broadcastId: string): Promise<YouTubeLivestream | null> {
    try {
      console.log(`📺 Fetching livestream: ${broadcastId}`)

      const response = await this.youtube.liveBroadcasts.list({
        part: ['snippet', 'status', 'contentDetails'],
        id: [broadcastId],
      })

      if (!response.data.items || response.data.items.length === 0) {
        console.error('❌ Livestream not found')
        return null
      }

      return response.data.items[0] as YouTubeLivestream
    } catch (error) {
      console.error('❌ Error fetching livestream:', error)
      throw new Error(`Failed to fetch livestream: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Find the "Default stream key" for the channel by looking for a stream
   * named "Default stream key" with RTMP/variable settings.
   * This is the reusable stream that doesn't require encoder reconfiguration.
   */
  async findDefaultStream(): Promise<YouTubeStream | null> {
    try {
      console.log(`📺 Looking for "Default stream key" on channel...`)

      // List all streams for the channel
      const streamsResponse = await this.youtube.liveStreams.list({
        part: ['snippet', 'cdn', 'status'],
        mine: true,
        maxResults: 50,
      })

      if (!streamsResponse.data.items || streamsResponse.data.items.length === 0) {
        console.log(`📺 No streams found on channel`)
        return null
      }

      const streams = streamsResponse.data.items as YouTubeStream[]
      console.log(`📺 Found ${streams.length} stream(s), searching for "Default stream key"...`)

      // Look for the "Default stream key" by title
      const defaultStream = streams.find((s: YouTubeStream) =>
        s.snippet.title.toLowerCase().includes('default stream key')
      )

      if (defaultStream) {
        console.log(`✅ Found "Default stream key": ${defaultStream.id}`)
        console.log(`   Stream name (key): ${defaultStream.cdn.ingestionInfo.streamName}`)
        return defaultStream
      }

      // Log available streams for debugging
      console.log(`⚠️ "Default stream key" not found. Available streams:`)
      streams.forEach((s: YouTubeStream) => {
        console.log(`   - "${s.snippet.title}" (ID: ${s.id})`)
      })

      return null
    } catch (error) {
      console.error('❌ Error finding default stream:', error)
      return null
    }
  }

  /**
   * Create a new livestream broadcast
   *
   * IMPORTANT CHANGES (Dec 2025):
   * 1. enableAutoStart defaults to FALSE - requires manual "Go Live" button
   * 2. Always uses the "Default stream key" instead of creating new streams
   *    This prevents encoder reconfiguration every week
   */
  async createLivestream(request: CreateLivestreamRequest): Promise<CreateLivestreamResponse> {
    try {
      console.log(`📺 Creating new livestream: ${request.title}`)

      // Step 1: Create the broadcast
      // Category 22 = "People & Blogs"
      // CRITICAL: enableAutoStart = FALSE to require manual "Go Live"
      const broadcastResponse = await this.youtube.liveBroadcasts.insert({
        part: ['snippet', 'status', 'contentDetails'],
        requestBody: {
          snippet: {
            title: request.title,
            description: request.description,
            scheduledStartTime: request.scheduledStartTime,
            categoryId: '22', // People & Blogs
          },
          status: {
            privacyStatus: request.privacyStatus || 'public',
            selfDeclaredMadeForKids: false,
          },
          contentDetails: {
            enableDvr: request.enableDvr !== false,
            // CRITICAL FIX: Default to FALSE - requires manual "Go Live" button
            // Previously was TRUE, causing auto-start when encoder connected (2 hours early!)
            enableAutoStart: request.enableAutoStart === true,
            enableAutoStop: request.enableAutoStop !== false,
            enableEmbed: true,
            recordFromStart: true,
            startWithSlate: false,
            enableClosedCaptions: false,
          },
        },
      })

      const broadcast = broadcastResponse.data as YouTubeLivestream
      console.log(`✅ Broadcast created: ${broadcast.id}`)
      console.log(`📺 Auto-start disabled: Will require manual "Go Live" button`)

      // Step 2: Find and use the "Default stream key" (reusable stream)
      // This ensures the encoder doesn't need to be reconfigured every week
      let stream: YouTubeStream | null = await this.findDefaultStream()

      if (!stream) {
        // Fallback: Try template broadcast's stream if provided
        if (request.templateBroadcastId) {
          console.log(`📺 No default stream found, trying template: ${request.templateBroadcastId}`)
          const templateBroadcast = await this.getLivestream(request.templateBroadcastId)

          if (templateBroadcast?.contentDetails?.boundStreamId) {
            const streamResponse = await this.youtube.liveStreams.list({
              part: ['snippet', 'cdn', 'status'],
              id: [templateBroadcast.contentDetails.boundStreamId],
            })

            if (streamResponse.data.items && streamResponse.data.items.length > 0) {
              stream = streamResponse.data.items[0] as YouTubeStream
              console.log(`✅ Using stream from template: ${stream.id}`)
            }
          }
        }
      }

      if (!stream) {
        // Last resort: Create new stream (should be avoided!)
        console.warn(`⚠️ WARNING: No "Default stream key" found - creating new stream!`)
        console.warn(`⚠️ This will require encoder reconfiguration. Consider creating a "Default stream key" in YouTube Studio.`)
        stream = await this.createStream(request.title)
      }

      console.log(`✅ Stream ready: ${stream.id}`)

      // Step 3: Bind the stream to the broadcast
      const bindResponse = await this.youtube.liveBroadcasts.bind({
        part: ['snippet', 'status', 'contentDetails'],
        id: broadcast.id,
        streamId: stream.id,
      })

      console.log(`✅ Stream bound to broadcast`)

      // Construct response with URLs
      const watchUrl = `https://www.youtube.com/watch?v=${broadcast.id}`
      const streamUrl = stream.cdn.ingestionInfo.ingestionAddress
      const streamKey = stream.cdn.ingestionInfo.streamName

      return {
        broadcast: bindResponse.data as YouTubeLivestream,
        stream,
        watchUrl,
        streamUrl,
        streamKey,
      }
    } catch (error) {
      console.error('❌ Error creating livestream:', error)
      throw new Error(`Failed to create livestream: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Create a new stream (encoder configuration)
   */
  private async createStream(title: string): Promise<YouTubeStream> {
    try {
      console.log(`📺 Creating new stream for: ${title}`)

      const streamResponse = await this.youtube.liveStreams.insert({
        part: ['snippet', 'cdn', 'status'],
        requestBody: {
          snippet: {
            title: `Stream for ${title}`,
          },
          cdn: {
            frameRate: 'variable',
            ingestionType: 'rtmp',
            resolution: 'variable',
          },
        },
      })

      return streamResponse.data as YouTubeStream
    } catch (error) {
      console.error('❌ Error creating stream:', error)
      throw new Error(`Failed to create stream: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Simplify livestream data for easier consumption
   */
  simplifyLivestream(livestream: YouTubeLivestream): YouTubeLivestreamSimplified {
    return {
      id: livestream.id,
      title: livestream.snippet.title,
      description: livestream.snippet.description,
      scheduledStartTime: livestream.snippet.scheduledStartTime,
      actualStartTime: livestream.snippet.actualStartTime,
      actualEndTime: livestream.snippet.actualEndTime,
      streamUrl: `https://studio.youtube.com/video/${livestream.id}/livestreaming`,
      watchUrl: `https://www.youtube.com/watch?v=${livestream.id}`,
      status: livestream.status.lifeCycleStatus,
      privacyStatus: livestream.status.privacyStatus,
      thumbnailUrl: livestream.snippet.thumbnails?.high?.url || livestream.snippet.thumbnails?.default?.url,
      boundStreamId: livestream.contentDetails?.boundStreamId,
    }
  }

  /**
   * Update an existing livestream
   */
  async updateLivestream(
    broadcastId: string,
    updates: {
      title?: string
      description?: string
      scheduledStartTime?: string
      privacyStatus?: 'public' | 'private' | 'unlisted'
    }
  ): Promise<YouTubeLivestream> {
    try {
      console.log(`📺 Updating livestream: ${broadcastId}`)

      // First get the current broadcast
      const currentBroadcast = await this.getLivestream(broadcastId)
      if (!currentBroadcast) {
        throw new Error('Broadcast not found')
      }

      // Update only the fields that were provided
      const response = await this.youtube.liveBroadcasts.update({
        part: ['snippet', 'status', 'contentDetails'],
        requestBody: {
          id: broadcastId,
          snippet: {
            title: updates.title || currentBroadcast.snippet.title,
            description: updates.description || currentBroadcast.snippet.description,
            scheduledStartTime: updates.scheduledStartTime || currentBroadcast.snippet.scheduledStartTime,
          },
          status: {
            privacyStatus: updates.privacyStatus || currentBroadcast.status.privacyStatus,
            selfDeclaredMadeForKids: currentBroadcast.status.selfDeclaredMadeForKids,
          },
          contentDetails: currentBroadcast.contentDetails,
        },
      })

      console.log(`✅ Livestream updated: ${broadcastId}`)
      return response.data as YouTubeLivestream
    } catch (error) {
      console.error('❌ Error updating livestream:', error)
      throw new Error(`Failed to update livestream: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Delete a livestream broadcast
   */
  async deleteLivestream(broadcastId: string): Promise<void> {
    try {
      console.log(`📺 Deleting livestream: ${broadcastId}`)

      await this.youtube.liveBroadcasts.delete({
        id: broadcastId,
      })

      console.log(`✅ Livestream deleted: ${broadcastId}`)
    } catch (error) {
      console.error('❌ Error deleting livestream:', error)
      throw new Error(`Failed to delete livestream: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Test connection to YouTube API
   */
  async testConnection(): Promise<boolean> {
    try {
      const channelInfo = await this.getChannelInfo()
      if (channelInfo) {
        console.log('✅ YouTube API connection successful')
        console.log(`📺 Channel: ${channelInfo.title}`)
        return true
      }
      return false
    } catch (error) {
      console.error('❌ YouTube API connection failed:', error)
      return false
    }
  }
}
