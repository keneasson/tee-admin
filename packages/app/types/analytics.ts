// Analytics types for web and email metrics

import type { EmailReasonType, EmailSubReason } from '../types'

// DynamoDB record for web page views
export interface WebAnalyticsRecord {
  pkey: string // ANALYTICS#WEB#{YYYY-MM-DD}
  skey: string // {timestamp}#{hash8}
  gsi1pk: string // ANALYTICS#WEB
  gsi1sk: string // {YYYY-MM-DD}T{HH:mm:ss}
  page: string
  visitorHash: string // SHA-256 of IP+UA+dailySalt (not reversible)
  referrerSource: ReferrerSource
  deviceType: DeviceType
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  ttl: number // Unix timestamp for 90-day auto-expiry
  lastUpdated: string
  version: number
}

export type ReferrerSource = 'email' | 'search' | 'direct' | 'social' | 'other'
export type DeviceType = 'mobile' | 'desktop' | 'tablet'

// API response types
export interface WebMetricsSummary {
  totalPageViews: number
  uniqueVisitors: number
  topPages: Array<{ page: string; views: number }>
  referrerBreakdown: Array<{ source: ReferrerSource; count: number }>
  deviceBreakdown: Array<{ device: DeviceType; count: number }>
  dailyTrends: Array<{ date: string; pageViews: number; uniqueVisitors: number }>
  utmCampaigns: Array<{ campaign: string; source: string; visits: number }>
}

/** Per-send tracking record stored in DynamoDB */
export interface EmailSendRecord {
  campaignId: string
  reason: EmailReasonType
  subReason: EmailSubReason
  subject: string
  description?: string
  recipientCount: number
  sentCount: number
  failedCount: number
  sentAt: string // ISO timestamp
  sentBy?: string // email of the sender
  // Metrics (updated via atomic increments from SES events)
  opens: number
  clicks: number
  bounces: number
  deliveries: number
  complaints: number
  // Computed rates (calculated at query time)
  openRate: number
  clickRate: number
}

export interface EmailMetricsSummary {
  totals: {
    sends: number
    deliveries: number
    opens: number
    clicks: number
    bounces: number
    complaints: number
  }
  rates: {
    deliveryRate: number
    openRate: number
    clickRate: number
    bounceRate: number
  }
  byType: Array<{
    emailType: string
    sends: number
    opens: number
    clicks: number
    bounces: number
  }>
  dailyTrends: Array<{
    date: string
    sends: number
    opens: number
    clicks: number
  }>
  recentSends?: EmailSendRecord[]
}

export interface MetricsQueryParams {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  emailType?: string // filter by email type for email metrics
}
