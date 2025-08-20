'use client'

import React, { useEffect, useState } from 'react'
import { YStack, XStack, Text, Button, Card, Spinner, ScrollView } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from '@tamagui/lucide-icons'

interface QueueStatus {
  status: 'no_jobs' | 'queued' | 'sending' | 'finished'
  currentJobId?: string
  queuedJobs: number
  lastProcessed?: string
  nextScheduled?: string
  processingStarted?: string
  processedToday: number
  failedToday: number
  totalProcessed: number
  totalFailed: number
  updatedAt: string
}

interface QueueLog {
  jobId: string
  type: string
  action: 'created' | 'started' | 'completed' | 'failed' | 'retried' | 'cancelled'
  message: string
  error?: string
  processingTime?: number
  attemptNumber?: number
  timestamp: string
}

interface QueueStats {
  date: string
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  retriedJobs: number
  jobsByType: Record<string, number>
  failuresByType: Record<string, number>
  averageProcessingTime: number
  maxProcessingTime: number
  minProcessingTime: number
  maxQueueSize: number
  processorCalls: number
  updatedAt: string
}

interface MonitoringData {
  status: QueueStatus
  recentLogs: QueueLog[]
  todayStats: QueueStats
}

export default function EmailQueuePage() {
  const [data, setData] = useState<MonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const isHydrated = useHydrated()

  const fetchData = async () => {
    try {
      const response = await fetch('/api/email/queue/status', {
        headers: {
          'Authorization': 'Bearer admin-token' // TODO: Use real auth token
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      if (result.success) {
        setData(result.data)
        setError(null)
      } else {
        setError(result.message || 'Failed to fetch queue data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const triggerProcessor = async () => {
    setTriggering(true)
    try {
      const response = await fetch('/api/email/queue-processor', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer admin-token' // TODO: Use real auth token
        }
      })
      
      const result = await response.json()
      if (result.success) {
        // Refresh data after triggering
        await fetchData()
      } else {
        setError(result.message || 'Failed to trigger processor')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTriggering(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
  }

  useEffect(() => {
    if (isHydrated) {
      fetchData()
      
      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [isHydrated])

  if (!isHydrated) {
    return <div>Loading...</div>
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'no_jobs': return <CheckCircle size="$1" color="$green10" />
      case 'queued': return <Clock size="$1" color="$orange10" />
      case 'sending': return <Spinner size="small" color="$blue10" />
      case 'finished': return <CheckCircle size="$1" color="$green10" />
      default: return <AlertCircle size="$1" color="$gray10" />
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'completed': return <CheckCircle size="$0.5" color="$green10" />
      case 'failed': return <XCircle size="$0.5" color="$red10" />
      case 'started': return <Clock size="$0.5" color="$blue10" />
      case 'retried': return <RefreshCw size="$0.5" color="$orange10" />
      default: return <AlertCircle size="$0.5" color="$gray10" />
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <Wrapper subHeader="Email Queue Monitor">
      <YStack gap="$4" padding="$4">
        {/* Header Controls */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$6" fontWeight="600">Email Queue Dashboard</Text>
          <XStack gap="$2">
            <Button
              size="$3"
              variant="outlined"
              onPress={handleRefresh}
              disabled={refreshing}
              icon={refreshing ? <Spinner size="small" /> : <RefreshCw size="$1" />}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              size="$3"
              onPress={triggerProcessor}
              disabled={triggering}
              icon={triggering ? <Spinner size="small" /> : undefined}
            >
              {triggering ? 'Triggering...' : 'Trigger Now'}
            </Button>
          </XStack>
        </XStack>

        {error && (
          <Card backgroundColor="$red2" borderColor="$red6" padding="$3">
            <Text color="$red11">{error}</Text>
          </Card>
        )}

        {loading ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" />
            <Text>Loading queue data...</Text>
          </YStack>
        ) : data ? (
          <YStack gap="$4">
            {/* Queue Status */}
            <Card padding="$4">
              <YStack gap="$3">
                <Text fontSize="$5" fontWeight="600">Queue Status</Text>
                <XStack alignItems="center" gap="$2">
                  {getStatusIcon(data.status.status)}
                  <Text fontSize="$4" textTransform="capitalize">
                    {data.status.status.replace('_', ' ')}
                  </Text>
                  {data.status.queuedJobs > 0 && (
                    <Text color="$orange10">({data.status.queuedJobs} jobs queued)</Text>
                  )}
                </XStack>
                
                <XStack flexWrap="wrap" gap="$4">
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Last Processed</Text>
                    <Text fontSize="$3">
                      {data.status.lastProcessed ? formatTime(data.status.lastProcessed) : 'Never'}
                    </Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Today's Success</Text>
                    <Text fontSize="$3" color="$green11">{data.status.processedToday}</Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Today's Failures</Text>
                    <Text fontSize="$3" color="$red11">{data.status.failedToday}</Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Total Processed</Text>
                    <Text fontSize="$3">{data.status.totalProcessed}</Text>
                  </YStack>
                </XStack>
              </YStack>
            </Card>

            {/* Today's Statistics */}
            <Card padding="$4">
              <YStack gap="$3">
                <Text fontSize="$5" fontWeight="600">Today's Statistics</Text>
                <XStack flexWrap="wrap" gap="$4">
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Total Jobs</Text>
                    <Text fontSize="$4">{data.todayStats.totalJobs}</Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Success Rate</Text>
                    <Text fontSize="$4" color="$green11">
                      {data.todayStats.totalJobs > 0 
                        ? `${Math.round((data.todayStats.successfulJobs / data.todayStats.totalJobs) * 100)}%`
                        : '0%'
                      }
                    </Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Avg Processing Time</Text>
                    <Text fontSize="$4">
                      {data.todayStats.averageProcessingTime > 0 
                        ? formatDuration(data.todayStats.averageProcessingTime)
                        : '0ms'
                      }
                    </Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Max Queue Size</Text>
                    <Text fontSize="$4">{data.todayStats.maxQueueSize}</Text>
                  </YStack>
                  <YStack>
                    <Text fontSize="$2" color="$gray11">Processor Calls</Text>
                    <Text fontSize="$4">{data.todayStats.processorCalls}</Text>
                  </YStack>
                </XStack>
              </YStack>
            </Card>

            {/* Recent Activity Log */}
            <Card padding="$4">
              <YStack gap="$3">
                <Text fontSize="$5" fontWeight="600">Recent Activity</Text>
                <ScrollView maxHeight={400}>
                  <YStack gap="$2">
                    {data.recentLogs.length > 0 ? (
                      data.recentLogs.map((log, index) => (
                        <XStack key={index} alignItems="center" gap="$2" padding="$2" backgroundColor="$gray2" borderRadius="$2">
                          {getActionIcon(log.action)}
                          <YStack flex={1} gap="$1">
                            <XStack alignItems="center" gap="$2">
                              <Text fontSize="$2" fontWeight="500">{log.type}</Text>
                              <Text fontSize="$1" color="$gray11">{formatTime(log.timestamp)}</Text>
                              {log.processingTime && (
                                <Text fontSize="$1" color="$blue11">
                                  {formatDuration(log.processingTime)}
                                </Text>
                              )}
                            </XStack>
                            <Text fontSize="$2">{log.message}</Text>
                            {log.error && (
                              <Text fontSize="$1" color="$red11" fontFamily="$mono">
                                {log.error}
                              </Text>
                            )}
                          </YStack>
                        </XStack>
                      ))
                    ) : (
                      <Text color="$gray11" textAlign="center" padding="$4">
                        No recent activity
                      </Text>
                    )}
                  </YStack>
                </ScrollView>
              </YStack>
            </Card>
          </YStack>
        ) : null}
      </YStack>
    </Wrapper>
  )
}