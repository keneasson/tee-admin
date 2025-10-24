// YouTube Livestream Management Types

export type YouTubeBroadcastStatus =
  | 'upcoming'    // Scheduled for future
  | 'live'        // Currently streaming
  | 'complete'    // Stream ended
  | 'cancelled'   // Stream cancelled

export type YouTubeLiveChatStatus =
  | 'liveChatEnabled'
  | 'liveChatDisabled'

export type YouTubePrivacyStatus =
  | 'public'
  | 'private'
  | 'unlisted'

export interface YouTubeLivestream {
  id: string
  kind: string
  etag: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
    thumbnails: {
      default?: { url: string; width: number; height: number }
      medium?: { url: string; width: number; height: number }
      high?: { url: string; width: number; height: number }
    }
    scheduledStartTime: string
    actualStartTime?: string
    actualEndTime?: string
    isDefaultBroadcast: boolean
    liveChatId?: string
  }
  status: {
    lifeCycleStatus: YouTubeBroadcastStatus
    privacyStatus: YouTubePrivacyStatus
    recordingStatus?: string
    madeForKids: boolean
    selfDeclaredMadeForKids: boolean
  }
  contentDetails: {
    boundStreamId?: string
    boundStreamLastUpdateTimeMs?: string
    monitorStream?: {
      enableMonitorStream: boolean
      broadcastStreamDelayMs?: number
    }
    enableEmbed: boolean
    enableDvr: boolean
    enableContentEncryption: boolean
    startWithSlate: boolean
    recordFromStart: boolean
    enableClosedCaptions: boolean
    closedCaptionsType?: string
    enableLowLatency: boolean
    latencyPreference?: string
    projection: string
    enableAutoStart?: boolean
    enableAutoStop?: boolean
  }
}

export interface YouTubeLivestreamSimplified {
  id: string
  title: string
  description: string
  scheduledStartTime: string
  actualStartTime?: string
  actualEndTime?: string
  streamUrl: string      // URL for OBS/encoder
  watchUrl: string       // URL for viewers
  status: YouTubeBroadcastStatus
  privacyStatus: YouTubePrivacyStatus
  thumbnailUrl?: string
  boundStreamId?: string
}

export interface YouTubeStream {
  id: string
  kind: string
  etag: string
  snippet: {
    publishedAt: string
    channelId: string
    title: string
    description: string
  }
  cdn: {
    ingestionType: string
    ingestionInfo: {
      streamName: string
      ingestionAddress: string
      backupIngestionAddress?: string
    }
    resolution?: string
    frameRate?: string
  }
  status: {
    streamStatus: string
  }
}

export interface CreateLivestreamRequest {
  title: string
  description: string
  scheduledStartTime: string  // ISO 8601 date string
  privacyStatus?: YouTubePrivacyStatus
  enableDvr?: boolean
  enableAutoStart?: boolean
  enableAutoStop?: boolean
  templateBroadcastId?: string  // ID of broadcast to copy settings from
}

export interface CreateLivestreamResponse {
  broadcast: YouTubeLivestream
  stream: YouTubeStream
  streamUrl: string
  watchUrl: string
  streamKey: string
}

export interface YouTubeApiError {
  error: {
    code: number
    message: string
    errors: Array<{
      domain: string
      reason: string
      message: string
    }>
  }
}

// YouTube Channel Info
export interface YouTubeChannel {
  id: string
  title: string
  description: string
  customUrl?: string
  thumbnailUrl?: string
  subscriberCount?: string
}

// List response from YouTube API
export interface YouTubeLivestreamsListResponse {
  kind: string
  etag: string
  pageInfo: {
    totalResults: number
    resultsPerPage: number
  }
  nextPageToken?: string
  prevPageToken?: string
  items: YouTubeLivestream[]
}
