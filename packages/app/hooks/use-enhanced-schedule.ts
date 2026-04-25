import { useState, useEffect, useCallback, useRef } from 'react'
import type { EnhancedScheduleEvent } from '@my/ui/src/data-table/enhanced-schedule-responsive'
import type { ScheduleTab } from '@my/ui/src/data-table/schedule-tabs'

interface EnhancedScheduleResponse {
  tabs: ScheduleTab[]
  data: Record<string, EnhancedScheduleEvent[]>
  currentUser: string | null
  lastUpdated: string
  dataSource: string
  totalEvents: number
  hasMore: boolean
  hasOlder?: boolean
  pagination: {
    fromDate: string
    toDate?: string
    limit: number
    offset: number
    sortOrder: string
    currentCount: number
  }
}

interface UseEnhancedScheduleOptions {
  /** Which tab is currently active — single source of truth from the URL */
  activeTab: string
  fromDate?: string
  toDate?: string
  infiniteScroll?: boolean
}

interface UseEnhancedScheduleReturn {
  data: Record<string, EnhancedScheduleEvent[]>
  tabs: ScheduleTab[]
  currentUser: string | null
  loading: boolean
  error: string | null
  lastUpdated: string | null
  totalEvents: number
  hasOlder: boolean
  loadOlder: () => void
  refetch: () => void
}

export function useEnhancedSchedule(
  options: UseEnhancedScheduleOptions
): UseEnhancedScheduleReturn {
  const {
    activeTab,
    fromDate = new Date().toISOString().split('T')[0],
    toDate,
    infiniteScroll = false,
  } = options

  const [data, setData] = useState<Record<string, EnhancedScheduleEvent[]>>({})
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [hasOlder, setHasOlder] = useState(false)

  // Track which tab we last fetched for, so we know when to reset
  const lastFetchedTab = useRef<string | null>(null)

  // Static tabs
  const tabs: ScheduleTab[] = [
    { id: 'memorial', name: 'Memorial Service', key: 'memorial' },
    { id: 'bibleClass', name: 'Bible Class', key: 'bibleClass' },
    { id: 'sundaySchool', name: 'Sunday School', key: 'sundaySchool' },
    { id: 'cyc', name: 'CYC', key: 'cyc' },
  ]

  // Core fetch — always uses the provided tab directly (no stale closures)
  const fetchTab = useCallback(async (tab: string, olderThanDate?: string) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('types', tab)

      if (olderThanDate) {
        params.set('toDate', olderThanDate)
        params.set('fromDate', '2020-01-01')
        params.set('limit', '10')
        params.set('sortOrder', 'desc')
      } else {
        params.set('fromDate', fromDate)
        if (toDate) params.set('toDate', toDate)
        params.set('limit', '1000')
        params.set('sortOrder', 'asc')
      }
      params.set('offset', '0')

      const response = await fetch(`/api/enhanced-schedule?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: EnhancedScheduleResponse = await response.json()
      if ('error' in result) {
        throw new Error((result as any).error || 'Unknown API error')
      }

      // Sort chronologically
      const sortedEvents = (result.data[tab] || []).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      if (olderThanDate && infiniteScroll) {
        // Prepend older events, deduplicate
        setData((prev) => {
          const existing = prev[tab] || []
          const combined = [...sortedEvents, ...existing]
          const unique = combined.filter(
            (event, i, arr) => arr.findIndex((e) => e.id === event.id) === i
          )
          unique.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          return { ...prev, [tab]: unique }
        })
      } else {
        setData({ [tab]: sortedEvents })
        setCurrentUser(result.currentUser)
        setLastUpdated(result.lastUpdated)
      }

      setTotalEvents(result.totalEvents)
      setHasOlder(result.hasOlder || false)
    } catch (err) {
      console.error('Enhanced Schedule fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch schedule data')
      if (!olderThanDate) {
        setData({})
        setCurrentUser(null)
        setTotalEvents(0)
      }
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, infiniteScroll])

  // Fetch when activeTab changes
  useEffect(() => {
    if (activeTab === lastFetchedTab.current) return
    lastFetchedTab.current = activeTab
    fetchTab(activeTab)
  }, [activeTab, fetchTab])

  // Initial fetch
  useEffect(() => {
    if (lastFetchedTab.current === null) {
      lastFetchedTab.current = activeTab
      fetchTab(activeTab)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadOlder = useCallback(() => {
    const events = data[activeTab] || []
    if (events.length === 0 || loading) return
    const earliestDate = events.reduce(
      (earliest, e) => (e.date < earliest ? e.date : earliest),
      events[0].date
    )
    fetchTab(activeTab, earliestDate)
  }, [activeTab, data, loading, fetchTab])

  const refetch = useCallback(() => {
    lastFetchedTab.current = activeTab
    fetchTab(activeTab)
  }, [activeTab, fetchTab])

  return {
    data,
    tabs,
    currentUser,
    loading,
    error,
    lastUpdated,
    totalEvents,
    hasOlder,
    loadOlder,
    refetch,
  }
}
