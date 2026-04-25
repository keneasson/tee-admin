import { NextRequest, NextResponse } from 'next/server'
import {
  analyticsRepository,
  categorizeReferrer,
  categorizeDevice,
  isBot,
} from '@my/app/provider/dynamodb/repositories/analytics-repository'

const INTERNAL_KEY = process.env.ANALYTICS_INTERNAL_KEY

export async function POST(request: NextRequest) {
  // Validate internal key
  const authKey = request.headers.get('x-analytics-key')
  if (!INTERNAL_KEY || authKey !== INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { page, ip, userAgent, referer, utmSource, utmMedium, utmCampaign } = body

    if (!page || !ip || !userAgent) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Skip bots
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true })
    }

    const referrerSource = categorizeReferrer(referer || null)
    const deviceType = categorizeDevice(userAgent)

    await analyticsRepository.recordPageView({
      page,
      ip,
      userAgent,
      referrerSource,
      deviceType,
      utmSource,
      utmMedium,
      utmCampaign,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Analytics collect error:', error)
    // Don't fail the request - analytics should never break the app
    return NextResponse.json({ ok: true })
  }
}
