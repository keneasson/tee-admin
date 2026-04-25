import { createHash } from 'crypto'
import { BaseRepository } from './base-repository'
import type { WebAnalyticsRecord, ReferrerSource, DeviceType } from '../../../types/analytics'

class AnalyticsRepository extends BaseRepository<WebAnalyticsRecord> {
  constructor() {
    super('admin', false) // tee-admin table, pkey/skey naming
  }

  protected buildSheetPK(): string {
    return 'ANALYTICS#WEB'
  }

  /**
   * Record an anonymized page view
   */
  async recordPageView(data: {
    page: string
    ip: string
    userAgent: string
    referrerSource: ReferrerSource
    deviceType: DeviceType
    utmSource?: string
    utmMedium?: string
    utmCampaign?: string
  }): Promise<void> {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]! // YYYY-MM-DD
    const timestamp = now.toISOString()
    const hash8 = createHash('sha256')
      .update(`${timestamp}${Math.random()}`)
      .digest('hex')
      .substring(0, 8)

    // 90-day TTL
    const ttl = Math.floor(now.getTime() / 1000) + 90 * 24 * 60 * 60

    const visitorHash = AnalyticsRepository.generateVisitorHash(data.ip, data.userAgent)

    const record: WebAnalyticsRecord = {
      pkey: `ANALYTICS#WEB#${dateStr}`,
      skey: `${timestamp}#${hash8}`,
      gsi1pk: 'ANALYTICS#WEB',
      gsi1sk: timestamp,
      page: data.page,
      visitorHash,
      referrerSource: data.referrerSource,
      deviceType: data.deviceType,
      ttl,
      lastUpdated: timestamp,
      version: 0,
      ...(data.utmSource && { utmSource: data.utmSource }),
      ...(data.utmMedium && { utmMedium: data.utmMedium }),
      ...(data.utmCampaign && { utmCampaign: data.utmCampaign }),
    }

    await this.put(record)
  }

  /**
   * Get page views within a date range using GSI1
   */
  async getPageViews(startDate: string, endDate: string): Promise<WebAnalyticsRecord[]> {
    const allItems: WebAnalyticsRecord[] = []
    let lastEvaluatedKey: Record<string, any> | undefined

    do {
      const result = await this.query(
        'gsi1pk = :pk AND gsi1sk BETWEEN :start AND :end',
        {
          ':pk': 'ANALYTICS#WEB',
          ':start': `${startDate}T00:00:00`,
          ':end': `${endDate}T23:59:59`,
        },
        {
          indexName: 'gsi1',
          lastEvaluatedKey,
        }
      )
      allItems.push(...result.items)
      lastEvaluatedKey = result.lastEvaluatedKey
    } while (lastEvaluatedKey)

    return allItems
  }

  /**
   * Generate a non-reversible visitor hash using daily-rotating salt
   * Same visitor gets a different hash each day for privacy
   */
  static generateVisitorHash(ip: string, userAgent: string): string {
    const today = new Date().toISOString().split('T')[0]
    const salt = process.env.ANALYTICS_SALT || 'tee-analytics'
    return createHash('sha256')
      .update(`${ip}|${userAgent}|${today}|${salt}`)
      .digest('hex')
  }

  /**
   * Categorize referrer into broad categories
   */
  static categorizeReferrer(referer: string | null): ReferrerSource {
    if (!referer) return 'direct'

    const lower = referer.toLowerCase()

    // Email clients and webmail
    if (
      lower.includes('mail.google.com') ||
      lower.includes('outlook') ||
      lower.includes('yahoo.com/mail') ||
      lower.includes('mail.')
    ) {
      return 'email'
    }

    // Search engines
    if (
      lower.includes('google.') ||
      lower.includes('bing.com') ||
      lower.includes('duckduckgo.com') ||
      lower.includes('yahoo.com')
    ) {
      return 'search'
    }

    // Social media
    if (
      lower.includes('facebook.com') ||
      lower.includes('twitter.com') ||
      lower.includes('instagram.com') ||
      lower.includes('linkedin.com') ||
      lower.includes('x.com')
    ) {
      return 'social'
    }

    // Self-referral (same domain)
    if (lower.includes('tee-admin.com')) {
      return 'direct'
    }

    return 'other'
  }

  /**
   * Categorize device from User-Agent string
   */
  static categorizeDevice(userAgent: string): DeviceType {
    const lower = userAgent.toLowerCase()

    if (
      lower.includes('mobile') ||
      lower.includes('android') ||
      lower.includes('iphone')
    ) {
      return 'mobile'
    }

    if (lower.includes('ipad') || lower.includes('tablet')) {
      return 'tablet'
    }

    return 'desktop'
  }

  /**
   * Check if the User-Agent is a known bot
   */
  static isBot(userAgent: string): boolean {
    const lower = userAgent.toLowerCase()
    return (
      lower.includes('bot') ||
      lower.includes('crawler') ||
      lower.includes('spider') ||
      lower.includes('lighthouse') ||
      lower.includes('pingdom') ||
      lower.includes('uptimerobot') ||
      lower.includes('headless')
    )
  }
}

// Singleton
export const analyticsRepository = new AnalyticsRepository()

// Re-export static methods as standalone functions for use outside the class
export const categorizeReferrer = AnalyticsRepository.categorizeReferrer
export const categorizeDevice = AnalyticsRepository.categorizeDevice
export const isBot = AnalyticsRepository.isBot
