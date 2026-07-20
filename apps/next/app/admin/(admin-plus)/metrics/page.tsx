'use client'

import { useAdminAccess } from '@/hooks/use-admin-access'
import {
  YStack,
  XStack,
  Text,
  Spinner,
  Heading,
  Tabs,
  Card,
  Button,
  Input,
  ScrollView,
  useThemeName,
  TableRow,
  TableCell,
} from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { RefreshCw, X } from '@tamagui/lucide-icons'
import type {
  WebMetricsSummary,
  EmailMetricsSummary,
  EmailSendRecord,
  CampaignRecipient,
} from '@my/app/types/analytics'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

type DateRange = 7 | 30 | 90

export default function MetricsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const [activeTab, setActiveTab] = useState('email')
  const [dateRange, setDateRange] = useState<DateRange>(30)
  const [emailMetrics, setEmailMetrics] = useState<EmailMetricsSummary | null>(null)
  const [webMetrics, setWebMetrics] = useState<WebMetricsSummary | null>(null)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingWeb, setLoadingWeb] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDateRange = useCallback(() => {
    const end = new Date()
    const start = new Date(end.getTime() - dateRange * 24 * 60 * 60 * 1000)
    return {
      startDate: start.toISOString().split('T')[0]!,
      endDate: end.toISOString().split('T')[0]!,
    }
  }, [dateRange])

  const fetchEmailMetrics = useCallback(async () => {
    setLoadingEmail(true)
    setError(null)
    try {
      const { startDate, endDate } = getDateRange()
      const res = await fetch(
        `/api/admin/metrics/email?startDate=${startDate}&endDate=${endDate}`
      )
      if (!res.ok) throw new Error('Failed to fetch email metrics')
      const data = await res.json()
      setEmailMetrics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch email metrics')
    } finally {
      setLoadingEmail(false)
    }
  }, [getDateRange])

  const fetchWebMetrics = useCallback(async () => {
    setLoadingWeb(true)
    setError(null)
    try {
      const { startDate, endDate } = getDateRange()
      const res = await fetch(
        `/api/admin/metrics/web?startDate=${startDate}&endDate=${endDate}`
      )
      if (!res.ok) throw new Error('Failed to fetch web metrics')
      const data = await res.json()
      setWebMetrics(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch web metrics')
    } finally {
      setLoadingWeb(false)
    }
  }, [getDateRange])

  useEffect(() => {
    if (!hasAccess) return
    if (activeTab === 'email') {
      fetchEmailMetrics()
    } else {
      fetchWebMetrics()
    }
  }, [hasAccess, activeTab, dateRange, fetchEmailMetrics, fetchWebMetrics])

  if (!isHydrated || isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!hasAccess) {
    return null
  }

  const CHART_COLORS = [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.success,
    colors.warning,
    colors.error,
  ]

  return (
    <ScrollView flex={1}>
      <YStack padding="$4" gap="$4" maxWidth={1200} marginHorizontal="auto" width="100%">
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <Heading size="$7">Metrics Dashboard</Heading>
          <XStack gap="$2" alignItems="center">
            {([7, 30, 90] as DateRange[]).map((days) => (
              <Button
                key={days}
                size="$3"
                backgroundColor={dateRange === days ? colors.primary : 'transparent'}
                onPress={() => setDateRange(days)}
                borderWidth={1}
                borderColor={colors.primary}
              >
                <Text
                  color={dateRange === days ? colors.primaryForeground : colors.primary}
                  fontSize="$2"
                >
                  {days}d
                </Text>
              </Button>
            ))}
            <Button
              size="$3"
              icon={RefreshCw}
              onPress={() => {
                if (activeTab === 'email') fetchEmailMetrics()
                else fetchWebMetrics()
              }}
              backgroundColor="transparent"
            />
          </XStack>
        </XStack>

        {error ? (
          <Card padding="$3" backgroundColor={colors.error}>
            <Text color={colors.errorForeground}>{error}</Text>
          </Card>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="horizontal"
          flexDirection="column"
        >
          <Tabs.List>
            <Tabs.Tab value="email" flex={1}>
              <Text>Email Metrics</Text>
            </Tabs.Tab>
            <Tabs.Tab value="web" flex={1}>
              <Text>Web Metrics</Text>
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Content value="email">
            <YStack gap="$4" paddingTop="$4">
              {loadingEmail ? (
                <YStack alignItems="center" padding="$6">
                  <Spinner size="large" />
                  <Text marginTop="$2" color={colors.textSecondary}>
                    Loading email metrics...
                  </Text>
                </YStack>
              ) : emailMetrics ? (
                <EmailMetricsView
                  metrics={emailMetrics}
                  colors={colors}
                  chartColors={CHART_COLORS}
                  mode={mode}
                />
              ) : null}
            </YStack>
          </Tabs.Content>

          <Tabs.Content value="web">
            <YStack gap="$4" paddingTop="$4">
              {loadingWeb ? (
                <YStack alignItems="center" padding="$6">
                  <Spinner size="large" />
                  <Text marginTop="$2" color={colors.textSecondary}>
                    Loading web metrics...
                  </Text>
                </YStack>
              ) : webMetrics ? (
                <WebMetricsView
                  metrics={webMetrics}
                  colors={colors}
                  chartColors={CHART_COLORS}
                  mode={mode}
                />
              ) : null}
            </YStack>
          </Tabs.Content>
        </Tabs>
      </YStack>
    </ScrollView>
  )
}

type BrandColorsType = (typeof brandColors)['light'] | (typeof brandColors)['dark']

// Summary card component
function MetricCard({
  label,
  value,
  subtitle,
  colors,
}: {
  label: string
  value: string | number
  subtitle?: string
  colors: BrandColorsType
}) {
  return (
    <Card padding="$3" flex={1} minWidth={140} backgroundColor={colors.backgroundTertiary}>
      <YStack gap="$1">
        <Text fontSize="$2" color={colors.textSecondary} textTransform="uppercase">
          {label}
        </Text>
        <Text fontSize="$7" fontWeight="700" color={colors.textPrimary}>
          {value}
        </Text>
        {subtitle ? (
          <Text fontSize="$2" color={colors.textSecondary}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
    </Card>
  )
}

// Email Metrics View
function EmailMetricsView({
  metrics,
  colors,
  chartColors,
  mode,
}: {
  metrics: EmailMetricsSummary
  colors: BrandColorsType
  chartColors: string[]
  mode: 'light' | 'dark'
}) {
  const textColor = mode === 'dark' ? '#e0e0e0' : '#333333'
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  return (
    <YStack gap="$4">
      {/* Summary Cards */}
      <XStack gap="$3" flexWrap="wrap">
        <MetricCard
          label="Total Sends"
          value={metrics.totals.sends.toLocaleString()}
          colors={colors}
        />
        <MetricCard
          label="Deliveries"
          value={metrics.totals.deliveries.toLocaleString()}
          colors={colors}
        />
        <MetricCard
          label="Open Rate"
          value={`${metrics.rates.openRate}%`}
          subtitle={`${metrics.totals.opens.toLocaleString()} opens`}
          colors={colors}
        />
        <MetricCard
          label="Click Rate"
          value={`${metrics.rates.clickRate}%`}
          subtitle={`${metrics.totals.clicks.toLocaleString()} clicks`}
          colors={colors}
        />
        <MetricCard
          label="Bounce Rate"
          value={`${metrics.rates.bounceRate}%`}
          subtitle={`${metrics.totals.bounces.toLocaleString()} bounces`}
          colors={colors}
        />
      </XStack>

      {/* Daily Trends Chart */}
      {metrics.dailyTrends.length > 0 ? (
        <Card padding="$4" backgroundColor={colors.backgroundTertiary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
            Email Activity Over Time
          </Text>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke={mode === 'dark' ? '#444' : '#eee'} />
              <XAxis
                dataKey="date"
                tick={{ fill: textColor, fontSize: 12 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: textColor, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: mode === 'dark' ? '#333' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  color: textColor,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sends"
                stroke={chartColors[0]}
                strokeWidth={2}
                dot={false}
                name="Sends"
              />
              <Line
                type="monotone"
                dataKey="opens"
                stroke={chartColors[1]}
                strokeWidth={2}
                dot={false}
                name="Opens"
              />
              <Line
                type="monotone"
                dataKey="clicks"
                stroke={chartColors[2]}
                strokeWidth={2}
                dot={false}
                name="Clicks"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : null}

      {/* By Type Breakdown */}
      {metrics.byType.length > 0 ? (
        <Card padding="$4" backgroundColor={colors.backgroundTertiary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
            Metrics by Email Type
          </Text>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.byType}>
              <CartesianGrid strokeDasharray="3 3" stroke={mode === 'dark' ? '#444' : '#eee'} />
              <XAxis
                dataKey="emailType"
                tick={{ fill: textColor, fontSize: 12 }}
              />
              <YAxis tick={{ fill: textColor, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: mode === 'dark' ? '#333' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  color: textColor,
                }}
              />
              <Legend />
              <Bar dataKey="sends" fill={chartColors[0]} name="Sends" />
              <Bar dataKey="opens" fill={chartColors[1]} name="Opens" />
              <Bar dataKey="clicks" fill={chartColors[2]} name="Clicks" />
              <Bar dataKey="bounces" fill={chartColors[5]} name="Bounces" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : null}

      {/* Recent Email Performance (per-send tracking). The per-recipient drill-down
          renders inline beneath the clicked row, inside this component. */}
      {metrics.recentSends && metrics.recentSends.length > 0 ? (
        <RecentSendsTable
          sends={metrics.recentSends}
          colors={colors}
          selectedCampaign={selectedCampaign}
          onSelect={(id) => setSelectedCampaign((cur) => (cur === id ? null : id))}
        />
      ) : null}
    </YStack>
  )
}

/** Color-code open rate: green >= 20%, orange 10-20%, red < 10% */
function rateColor(rate: number): string {
  if (rate >= 20) return '#22c55e'
  if (rate >= 10) return '#f59e0b'
  return '#ef4444'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function RecentSendsTable({
  sends,
  colors,
  onSelect,
  selectedCampaign,
}: {
  sends: EmailSendRecord[]
  colors: BrandColorsType
  onSelect: (campaignId: string) => void
  selectedCampaign: string | null
}) {
  return (
    <Card padding="$4" backgroundColor={colors.backgroundTertiary}>
      <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$1">
        Recent Email Performance
      </Text>
      <Text fontSize="$2" color={colors.textSecondary} marginBottom="$3">
        Click a send to see exactly who received it and who opened / clicked / bounced.
      </Text>
      <YStack gap="$1">
        {/* Header row */}
        <TableRow
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderBottomWidth={1}
          borderBottomColor={colors.border}
        >
          <TableCell flex={2}>
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Date</Text>
          </TableCell>
          <TableCell flex={1}>
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Type</Text>
          </TableCell>
          <TableCell flex={3}>
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Subject</Text>
          </TableCell>
          <TableCell flex={1} align="right">
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Sent</Text>
          </TableCell>
          <TableCell flex={1} align="right">
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Opens</Text>
          </TableCell>
          <TableCell flex={1} align="right">
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Clicks</Text>
          </TableCell>
          <TableCell flex={1} align="right">
            <Text fontWeight="600" color={colors.textSecondary} fontSize="$2">Bounces</Text>
          </TableCell>
        </TableRow>

        {/* Data rows — each row renders its per-recipient drill-down inline
            directly beneath it when selected (so the result appears at the cursor,
            not off-screen at the bottom of the page). */}
        {sends.map((send) => (
          <Fragment key={send.campaignId}>
          <TableRow
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderBottomWidth={1}
            borderBottomColor={colors.border}
            cursor="pointer"
            backgroundColor={
              selectedCampaign === send.campaignId ? colors.backgroundSecondary : 'transparent'
            }
            hoverStyle={{ backgroundColor: colors.backgroundSecondary }}
            onPress={() => onSelect(send.campaignId)}
          >
            <TableCell flex={2}>
              <Text color={colors.textPrimary} fontSize="$2" numberOfLines={1}>
                {formatDate(send.sentAt)}
              </Text>
            </TableCell>
            <TableCell flex={1}>
              <XStack gap="$1" flexWrap="wrap">
                <Text
                  fontSize="$1"
                  fontWeight="600"
                  color={colors.primary}
                  backgroundColor={colors.backgroundTertiary}
                  paddingHorizontal="$1"
                  borderRadius="$1"
                >
                  {send.reason}
                </Text>
                {send.subReason !== 'general' ? (
                  <Text
                    fontSize="$1"
                    color={colors.textSecondary}
                    backgroundColor={colors.backgroundTertiary}
                    paddingHorizontal="$1"
                    borderRadius="$1"
                  >
                    {send.subReason}
                  </Text>
                ) : null}
              </XStack>
            </TableCell>
            <TableCell flex={3}>
              <Text color={colors.textPrimary} fontSize="$2" numberOfLines={1}>
                {send.subject}
              </Text>
            </TableCell>
            <TableCell flex={1} align="right">
              <Text color={colors.textPrimary} fontSize="$2">
                {send.sentCount}
              </Text>
            </TableCell>
            <TableCell flex={1} align="right">
              <YStack alignItems="flex-end">
                <Text fontSize="$2" color={rateColor(send.openRate)} fontWeight="600">
                  {send.openRate}%
                </Text>
                <Text fontSize="$1" color={colors.textSecondary}>
                  {send.opens}
                </Text>
              </YStack>
            </TableCell>
            <TableCell flex={1} align="right">
              <YStack alignItems="flex-end">
                <Text fontSize="$2" color={rateColor(send.clickRate)} fontWeight="600">
                  {send.clickRate}%
                </Text>
                <Text fontSize="$1" color={colors.textSecondary}>
                  {send.clicks}
                </Text>
              </YStack>
            </TableCell>
            <TableCell flex={1} align="right">
              <Text color={colors.textPrimary} fontSize="$2">
                {send.bounces}
              </Text>
            </TableCell>
          </TableRow>
          {selectedCampaign === send.campaignId ? (
            <RecipientDrilldown
              campaignId={send.campaignId}
              colors={colors}
              onClose={() => onSelect(send.campaignId)}
            />
          ) : null}
          </Fragment>
        ))}
      </YStack>
    </Card>
  )
}

function fmtEventDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Per-recipient drill-down for one campaign (who received / opened / clicked / bounced)
function RecipientDrilldown({
  campaignId,
  colors,
  onClose,
}: {
  campaignId: string
  colors: BrandColorsType
  onClose: () => void
}) {
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [enrichedEcclesia, setEnrichedEcclesia] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/metrics/email/${campaignId}/recipients`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load recipients'))))
      .then((d) => {
        if (cancelled) return
        setRecipients(d.data.recipients ?? [])
        setEnrichedEcclesia(!!d.data.enrichedEcclesia)
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [campaignId])

  const q = filter.trim().toLowerCase()
  const rows = q
    ? recipients.filter(
        (r) => r.email.toLowerCase().includes(q) || (r.ecclesia ?? '').toLowerCase().includes(q)
      )
    : recipients

  const summary = {
    total: recipients.length,
    delivered: recipients.filter((r) => r.deliveredAt).length,
    opened: recipients.filter((r) => r.opens > 0).length,
    clicked: recipients.filter((r) => r.clicks > 0).length,
    bounced: recipients.filter((r) => r.bouncedAt).length,
  }

  return (
    <Card
      padding="$4"
      marginVertical="$2"
      backgroundColor={colors.background}
      borderColor={colors.border}
      borderWidth={1}
      borderLeftColor={colors.primary}
      borderLeftWidth={4}
    >
      <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
          Recipients — who received this send
        </Text>
        <Button size="$2" icon={X} onPress={onClose} backgroundColor="transparent" />
      </XStack>

      {loading ? (
        <YStack alignItems="center" padding="$4">
          <Spinner />
        </YStack>
      ) : error ? (
        <Text color={colors.error}>{error}</Text>
      ) : recipients.length === 0 ? (
        <Text color={colors.textSecondary} fontSize="$3">
          No per-recipient data for this send. (Only sends after per-recipient tracking was enabled
          are captured.)
        </Text>
      ) : (
        <YStack gap="$3">
          <Text fontSize="$2" color={colors.textSecondary}>
            {summary.total} recipients · {summary.delivered} delivered · {summary.opened} opened ·{' '}
            {summary.clicked} clicked · {summary.bounced} bounced
            {enrichedEcclesia ? '' : ' · (ecclesia not shown for large sends)'}
          </Text>

          <Input
            size="$3"
            placeholder="Filter by ecclesia or email…"
            value={filter}
            onChangeText={setFilter}
            backgroundColor={colors.background}
          />

          {/* Header */}
          <TableRow paddingHorizontal="$2" paddingVertical="$1" borderBottomWidth={1} borderBottomColor={colors.border}>
            <TableCell flex={2}><Text fontSize="$1" fontWeight="600" color={colors.textSecondary}>Ecclesia</Text></TableCell>
            <TableCell flex={3}><Text fontSize="$1" fontWeight="600" color={colors.textSecondary}>Email</Text></TableCell>
            <TableCell flex={2}><Text fontSize="$1" fontWeight="600" color={colors.textSecondary}>Delivered</Text></TableCell>
            <TableCell flex={1} align="right"><Text fontSize="$1" fontWeight="600" color={colors.textSecondary}>Opens</Text></TableCell>
            <TableCell flex={1} align="right"><Text fontSize="$1" fontWeight="600" color={colors.textSecondary}>Clicks</Text></TableCell>
            <TableCell flex={2} align="right"><Text fontSize="$1" fontWeight="600" color={colors.textSecondary}>Status</Text></TableCell>
          </TableRow>

          {rows.map((r) => {
            const bounced = !!r.bouncedAt
            const complained = !!r.complainedAt
            const failed = r.status === 'failed'
            const statusText = complained
              ? 'Complaint'
              : bounced
                ? `Bounced${r.bounceType ? ` (${r.bounceType})` : ''}`
                : failed
                  ? 'Send failed'
                  : r.deliveredAt
                    ? 'Delivered'
                    : 'Sent'
            const statusColor =
              complained || bounced || failed ? '#ef4444' : r.deliveredAt ? '#22c55e' : colors.textSecondary
            return (
              <TableRow key={r.email} paddingHorizontal="$2" paddingVertical="$1.5" borderBottomWidth={1} borderBottomColor={colors.border}>
                <TableCell flex={2}>
                  <Text fontSize="$2" color={colors.textPrimary} numberOfLines={1}>{r.ecclesia ?? '—'}</Text>
                </TableCell>
                <TableCell flex={3}>
                  <Text fontSize="$2" color={colors.textPrimary} numberOfLines={1}>{r.email}</Text>
                </TableCell>
                <TableCell flex={2}>
                  <Text fontSize="$2" color={colors.textSecondary} numberOfLines={1}>{fmtEventDate(r.deliveredAt)}</Text>
                </TableCell>
                <TableCell flex={1} align="right">
                  <Text fontSize="$2" color={colors.textPrimary}>{r.opens}</Text>
                </TableCell>
                <TableCell flex={1} align="right">
                  <Text fontSize="$2" color={colors.textPrimary}>{r.clicks}</Text>
                </TableCell>
                <TableCell flex={2} align="right">
                  <Text fontSize="$2" color={statusColor} numberOfLines={1}>{statusText}</Text>
                </TableCell>
              </TableRow>
            )
          })}
          {rows.length === 0 ? (
            <Text color={colors.textSecondary} fontSize="$2" padding="$2">
              No recipients match “{filter}”.
            </Text>
          ) : null}
        </YStack>
      )}
    </Card>
  )
}

// Web Metrics View
function WebMetricsView({
  metrics,
  colors,
  chartColors,
  mode,
}: {
  metrics: WebMetricsSummary
  colors: BrandColorsType
  chartColors: string[]
  mode: 'light' | 'dark'
}) {
  const textColor = mode === 'dark' ? '#e0e0e0' : '#333333'

  const topReferrer =
    metrics.referrerBreakdown.length > 0 ? metrics.referrerBreakdown[0]!.source : 'N/A'

  return (
    <YStack gap="$4">
      {/* Summary Cards */}
      <XStack gap="$3" flexWrap="wrap">
        <MetricCard
          label="Page Views"
          value={metrics.totalPageViews.toLocaleString()}
          colors={colors}
        />
        <MetricCard
          label="Unique Visitors"
          value={metrics.uniqueVisitors.toLocaleString()}
          colors={colors}
        />
        <MetricCard
          label="Top Referrer"
          value={topReferrer}
          colors={colors}
        />
      </XStack>

      {/* Daily Trends */}
      {metrics.dailyTrends.length > 0 ? (
        <Card padding="$4" backgroundColor={colors.backgroundTertiary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
            Web Traffic Over Time
          </Text>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke={mode === 'dark' ? '#444' : '#eee'} />
              <XAxis
                dataKey="date"
                tick={{ fill: textColor, fontSize: 12 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis tick={{ fill: textColor, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: mode === 'dark' ? '#333' : '#fff',
                  border: 'none',
                  borderRadius: 8,
                  color: textColor,
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="pageViews"
                stroke={chartColors[0]}
                strokeWidth={2}
                dot={false}
                name="Page Views"
              />
              <Line
                type="monotone"
                dataKey="uniqueVisitors"
                stroke={chartColors[2]}
                strokeWidth={2}
                dot={false}
                name="Unique Visitors"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      ) : null}

      {/* Referrer + Device in a row */}
      <XStack gap="$4" flexWrap="wrap">
        {/* Referrer Breakdown Pie */}
        {metrics.referrerBreakdown.length > 0 ? (
          <Card padding="$4" backgroundColor={colors.backgroundTertiary} flex={1} minWidth={300}>
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
              Traffic Sources
            </Text>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.referrerBreakdown}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(props: any) =>
                    `${props.source || props.name}: ${props.count || props.value}`
                  }
                >
                  {metrics.referrerBreakdown.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: mode === 'dark' ? '#333' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                    color: textColor,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        ) : null}

        {/* Device Breakdown */}
        {metrics.deviceBreakdown.length > 0 ? (
          <Card padding="$4" backgroundColor={colors.backgroundTertiary} flex={1} minWidth={300}>
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
              Devices
            </Text>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={metrics.deviceBreakdown}
                  dataKey="count"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(props: any) =>
                    `${props.device || props.name}: ${props.count || props.value}`
                  }
                >
                  {metrics.deviceBreakdown.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartColors[index % chartColors.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: mode === 'dark' ? '#333' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                    color: textColor,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        ) : null}
      </XStack>

      {/* Top Pages Table */}
      {metrics.topPages.length > 0 ? (
        <Card padding="$4" backgroundColor={colors.backgroundTertiary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
            Top Pages
          </Text>
          <YStack gap="$1">
            <XStack
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderBottomWidth={1}
              borderBottomColor={colors.border}
            >
              <Text flex={3} fontWeight="600" color={colors.textSecondary} fontSize="$2">
                Page
              </Text>
              <Text flex={1} fontWeight="600" color={colors.textSecondary} fontSize="$2" textAlign="right">
                Views
              </Text>
            </XStack>
            {metrics.topPages.map((page) => (
              <XStack
                key={page.page}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderBottomWidth={1}
                borderBottomColor={colors.border}
              >
                <Text flex={3} color={colors.textPrimary} fontSize="$3" numberOfLines={1}>
                  {page.page}
                </Text>
                <Text flex={1} color={colors.textPrimary} fontSize="$3" textAlign="right">
                  {page.views.toLocaleString()}
                </Text>
              </XStack>
            ))}
          </YStack>
        </Card>
      ) : null}

      {/* UTM Campaigns */}
      {metrics.utmCampaigns.length > 0 ? (
        <Card padding="$4" backgroundColor={colors.backgroundTertiary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$3">
            Email Campaign Performance
          </Text>
          <YStack gap="$1">
            <XStack
              paddingHorizontal="$3"
              paddingVertical="$2"
              borderBottomWidth={1}
              borderBottomColor={colors.border}
            >
              <Text flex={2} fontWeight="600" color={colors.textSecondary} fontSize="$2">
                Campaign
              </Text>
              <Text flex={1} fontWeight="600" color={colors.textSecondary} fontSize="$2">
                Source
              </Text>
              <Text flex={1} fontWeight="600" color={colors.textSecondary} fontSize="$2" textAlign="right">
                Visits
              </Text>
            </XStack>
            {metrics.utmCampaigns.map((campaign) => (
              <XStack
                key={campaign.campaign}
                paddingHorizontal="$3"
                paddingVertical="$2"
                borderBottomWidth={1}
                borderBottomColor={colors.border}
              >
                <Text flex={2} color={colors.textPrimary} fontSize="$3" numberOfLines={1}>
                  {campaign.campaign}
                </Text>
                <Text flex={1} color={colors.textPrimary} fontSize="$3">
                  {campaign.source}
                </Text>
                <Text flex={1} color={colors.textPrimary} fontSize="$3" textAlign="right">
                  {campaign.visits.toLocaleString()}
                </Text>
              </XStack>
            ))}
          </YStack>
        </Card>
      ) : null}
    </YStack>
  )
}
