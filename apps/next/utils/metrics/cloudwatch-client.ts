import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataQuery,
} from '@aws-sdk/client-cloudwatch'
import { getAwsConfig } from '../email/sesClient'

let cloudWatchClient: CloudWatchClient | null = null

function getCloudWatchClient(): CloudWatchClient {
  if (!cloudWatchClient) {
    const config = getAwsConfig()
    cloudWatchClient = new CloudWatchClient({
      credentials: config.credentials,
      region: config.region || 'ca-central-1',
    })
  }
  return cloudWatchClient
}

const SES_NAMESPACE = 'AWS/SES'

// SES metric names available in CloudWatch
const METRIC_NAMES = ['Send', 'Delivery', 'Open', 'Click', 'Bounce', 'Complaint'] as const

type SESMetricName = (typeof METRIC_NAMES)[number]

interface EmailMetricsResult {
  totals: Record<SESMetricName, number>
  dailyData: Array<{
    date: string
    Send: number
    Delivery: number
    Open: number
    Click: number
    Bounce: number
    Complaint: number
  }>
}

/**
 * Fetch email metrics from CloudWatch for SES
 *
 * SES publishes metrics with these dimension patterns:
 * - No dimensions: aggregate totals across all emails
 * - Reason dimension: per email type (newsletter, bible-class, etc.)
 * - ses:configuration-set: only for Reputation.* metrics
 */
export async function getEmailMetrics(
  startDate: string,
  endDate: string,
  emailType?: string
): Promise<EmailMetricsResult> {
  const client = getCloudWatchClient()

  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T23:59:59Z`)

  const period = 86400 // Daily granularity

  // Build metric queries
  // When emailType is specified, filter by the "Reason" dimension
  // When no emailType, query without dimensions to get aggregate totals
  const queries: MetricDataQuery[] = METRIC_NAMES.map((metricName, index) => {
    const dimensions = emailType
      ? [{ Name: 'Reason', Value: emailType }]
      : []

    return {
      Id: `m${index}`,
      Label: metricName,
      MetricStat: {
        Metric: {
          Namespace: SES_NAMESPACE,
          MetricName: metricName,
          Dimensions: dimensions,
        },
        Period: period,
        Stat: 'Sum',
      },
    }
  })

  const command = new GetMetricDataCommand({
    MetricDataQueries: queries,
    StartTime: start,
    EndTime: end,
  })

  const response = await client.send(command)

  // Initialize totals
  const totals: Record<SESMetricName, number> = {
    Send: 0,
    Delivery: 0,
    Open: 0,
    Click: 0,
    Bounce: 0,
    Complaint: 0,
  }

  // Build daily data map
  const dailyMap = new Map<
    string,
    Record<SESMetricName, number>
  >()

  if (response.MetricDataResults) {
    for (const result of response.MetricDataResults) {
      const metricName = result.Label as SESMetricName
      if (!metricName || !METRIC_NAMES.includes(metricName)) continue

      const timestamps = result.Timestamps || []
      const values = result.Values || []

      for (let i = 0; i < timestamps.length; i++) {
        const date = timestamps[i]!.toISOString().split('T')[0]!
        const value = values[i] || 0

        totals[metricName] += value

        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            Send: 0,
            Delivery: 0,
            Open: 0,
            Click: 0,
            Bounce: 0,
            Complaint: 0,
          })
        }
        dailyMap.get(date)![metricName] += value
      }
    }
  }

  // Convert to sorted array
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => ({ date, ...metrics }))

  return { totals, dailyData }
}

/**
 * Get email metrics broken down by email type
 */
export async function getEmailMetricsByType(
  startDate: string,
  endDate: string
): Promise<Array<{ emailType: string; sends: number; opens: number; clicks: number; bounces: number }>> {
  const emailTypes = ['newsletter', 'bible-class', 'recap', 'inter-ecclesia', 'event-announcement', 'custom', 'sunday-school', 'business-meeting']

  const results = await Promise.all(
    emailTypes.map(async (type) => {
      try {
        const metrics = await getEmailMetrics(startDate, endDate, type)
        return {
          emailType: type,
          sends: metrics.totals.Send,
          opens: metrics.totals.Open,
          clicks: metrics.totals.Click,
          bounces: metrics.totals.Bounce,
        }
      } catch {
        // CloudWatch may not have data for all types
        return {
          emailType: type,
          sends: 0,
          opens: 0,
          clicks: 0,
          bounces: 0,
        }
      }
    })
  )

  // Only return types that have data
  return results.filter((r) => r.sends > 0)
}
