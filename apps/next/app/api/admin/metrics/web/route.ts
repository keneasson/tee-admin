import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { analyticsRepository } from '@my/app/provider/dynamodb/repositories/analytics-repository'
import type { WebMetricsSummary, ReferrerSource, DeviceType } from '@my/app/types/analytics'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userRole = (session.user as any).role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = request.nextUrl
    const now = new Date()
    const endDate = searchParams.get('endDate') || now.toISOString().split('T')[0]!
    const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const startDate = searchParams.get('startDate') || defaultStart.toISOString().split('T')[0]!

    const records = await analyticsRepository.getPageViews(startDate, endDate)

    // Aggregate in-memory
    const pageViewCounts = new Map<string, number>()
    const uniqueVisitorsByDay = new Map<string, Set<string>>()
    const referrerCounts = new Map<ReferrerSource, number>()
    const deviceCounts = new Map<DeviceType, number>()
    const dailyPageViews = new Map<string, number>()
    const allUniqueVisitors = new Set<string>()
    const utmCampaigns = new Map<string, { source: string; visits: number }>()

    for (const record of records) {
      // Page views
      pageViewCounts.set(record.page, (pageViewCounts.get(record.page) || 0) + 1)

      // Unique visitors
      allUniqueVisitors.add(record.visitorHash)

      // Daily breakdown
      const date = record.gsi1sk.split('T')[0]!
      dailyPageViews.set(date, (dailyPageViews.get(date) || 0) + 1)

      if (!uniqueVisitorsByDay.has(date)) {
        uniqueVisitorsByDay.set(date, new Set())
      }
      uniqueVisitorsByDay.get(date)!.add(record.visitorHash)

      // Referrer
      referrerCounts.set(record.referrerSource, (referrerCounts.get(record.referrerSource) || 0) + 1)

      // Device
      deviceCounts.set(record.deviceType, (deviceCounts.get(record.deviceType) || 0) + 1)

      // UTM campaigns
      if (record.utmCampaign) {
        const existing = utmCampaigns.get(record.utmCampaign)
        if (existing) {
          existing.visits++
        } else {
          utmCampaigns.set(record.utmCampaign, {
            source: record.utmSource || 'unknown',
            visits: 1,
          })
        }
      }
    }

    // Build response
    const topPages = Array.from(pageViewCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([page, views]) => ({ page, views }))

    const referrerBreakdown = Array.from(referrerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }))

    const deviceBreakdown = Array.from(deviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([device, count]) => ({ device, count }))

    const dailyTrends = Array.from(dailyPageViews.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pageViews]) => ({
        date,
        pageViews,
        uniqueVisitors: uniqueVisitorsByDay.get(date)?.size || 0,
      }))

    const utmCampaignsList = Array.from(utmCampaigns.entries())
      .sort((a, b) => b[1].visits - a[1].visits)
      .map(([campaign, data]) => ({
        campaign,
        source: data.source,
        visits: data.visits,
      }))

    const summary: WebMetricsSummary = {
      totalPageViews: records.length,
      uniqueVisitors: allUniqueVisitors.size,
      topPages,
      referrerBreakdown,
      deviceBreakdown,
      dailyTrends,
      utmCampaigns: utmCampaignsList,
    }

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error fetching web metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch web metrics' },
      { status: 500 }
    )
  }
}
