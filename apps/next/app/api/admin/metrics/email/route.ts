import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { getEmailMetrics, getEmailMetricsByType } from '@/utils/metrics/cloudwatch-client'
import { sendRecordRepository } from '@my/app/provider/dynamodb/repositories/send-record-repository'
import type { EmailMetricsSummary } from '@my/app/types/analytics'
import type { EmailReasonType } from '@my/app/types'

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
    const emailType = searchParams.get('emailType') || undefined
    const sendLimit = parseInt(searchParams.get('limit') || '20', 10)

    // Fetch overall metrics, per-type breakdown, and recent sends in parallel
    const [overallMetrics, byTypeMetrics, recentSends] = await Promise.all([
      getEmailMetrics(startDate, endDate, emailType),
      emailType ? Promise.resolve([]) : getEmailMetricsByType(startDate, endDate),
      sendRecordRepository.getRecentSends(sendLimit, emailType as EmailReasonType | undefined),
    ])

    const { Send, Delivery, Open, Click, Bounce, Complaint } = overallMetrics.totals

    const summary: EmailMetricsSummary = {
      totals: {
        sends: Send,
        deliveries: Delivery,
        opens: Open,
        clicks: Click,
        bounces: Bounce,
        complaints: Complaint,
      },
      rates: {
        deliveryRate: Send > 0 ? Math.round((Delivery / Send) * 1000) / 10 : 0,
        openRate: Delivery > 0 ? Math.round((Open / Delivery) * 1000) / 10 : 0,
        clickRate: Delivery > 0 ? Math.round((Click / Delivery) * 1000) / 10 : 0,
        bounceRate: Send > 0 ? Math.round((Bounce / Send) * 1000) / 10 : 0,
      },
      byType: byTypeMetrics,
      dailyTrends: overallMetrics.dailyData.map((d) => ({
        date: d.date,
        sends: d.Send,
        opens: d.Open,
        clicks: d.Click,
      })),
      recentSends,
    }

    return NextResponse.json({ success: true, data: summary })
  } catch (error) {
    console.error('Error fetching email metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email metrics' },
      { status: 500 }
    )
  }
}
