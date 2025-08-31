import { useState, useEffect, useCallback } from 'react'
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
  types?: string[]
  activeTab?: string // New: fetch only data for active tab
  fromDate?: string
  toDate?: string
  limit?: number
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
  hasMore: boolean
  hasOlder: boolean
  loadOlder: () => Promise<void>
  refetch: () => Promise<void>
  switchToTab: (tabKey: string) => Promise<void>
}

export function useEnhancedSchedule(
  options: UseEnhancedScheduleOptions = {}
): UseEnhancedScheduleReturn {
  const {
    types = ['memorial', 'bibleClass', 'sundaySchool', 'cyc'],
    activeTab, // New: if provided, fetch only this tab's data
    fromDate = new Date().toISOString().split('T')[0], // Default to today
    toDate,
    limit = 50,
    infiniteScroll = false
  } = options

  const [data, setData] = useState<Record<string, EnhancedScheduleEvent[]>>({})
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [hasOlder, setHasOlder] = useState(false)
  const [offset, setOffset] = useState(0)
  const [currentActiveTab, setCurrentActiveTab] = useState<string | null>(activeTab || 'memorial') // Default to memorial
  
  // Static tabs - don't fetch them dynamically
  const tabs: ScheduleTab[] = [
    { id: 'memorial', name: 'Memorial Service', key: 'memorial' },
    { id: 'bibleClass', name: 'Bible Class', key: 'bibleClass' },
    { id: 'sundaySchool', name: 'Sunday School', key: 'sundaySchool' },
    { id: 'cyc', name: 'CYC', key: 'cyc' }
  ]

  const fetchScheduleData = useCallback(async (loadMore = false, loadOlder = false, currentDataState?: Record<string, EnhancedScheduleEvent[]>) => {
    try {
      console.log('fetchScheduleData called with:', { loadMore, loadOlder })
      setLoading(true)
      setError(null)

      // Build query parameters
      const params = new URLSearchParams()
      
      // Always fetch only the current active tab's data
      const typesToFetch = [currentActiveTab || 'memorial']
      params.set('types', typesToFetch.join(','))
      console.log('Fetching for single tab:', currentActiveTab || 'memorial')
      
      if (loadOlder) {
        console.log('Loading older events')
        
        // Use the passed currentDataState if provided, otherwise use the closure data
        const dataToUse = currentDataState || data
        console.log('Current data state:', dataToUse)
        console.log('Current data keys:', Object.keys(dataToUse))
        console.log('Current active tab:', currentActiveTab)
        console.log('Types to fetch:', typesToFetch)
        
        // Get the current earliest date from the ACTIVE TAB only (not all schedule types)
        const activeTab = currentActiveTab || 'memorial'
        const currentEvents = activeTab && dataToUse[activeTab] ? dataToUse[activeTab] : []
        
        console.log('Active tab determined as:', activeTab)
        console.log('Current events for active tab:', currentEvents.length)
        console.log('Sample dates from current events:', currentEvents.slice(0, 3).map(e => e.date))
        
        let earliestDate: string
        
        if (currentEvents.length === 0) {
          console.log('No current events for active tab, loading older events from today')
          // If no current events, load older events from today backwards
          earliestDate = fromDate
        } else {
          // Find the earliest date for the active tab
          earliestDate = currentEvents.reduce((earliest, event) => 
            event.date < earliest ? event.date : earliest, 
            currentEvents[0].date
          )
        }
        
        console.log('Earliest date found:', earliestDate)
        console.log('Current events count for active tab:', currentEvents.length)
        
        // Load events strictly before the earliest date (no overlap)
        params.set('toDate', earliestDate) // Up to but not including the earliest date
        params.set('fromDate', '2020-01-01') // Start from a reasonable historical date
        params.set('limit', '10') // Load 10 older events
        params.set('offset', '0') // Always start from 0 since we're using date filtering
        params.set('sortOrder', 'desc') // Most recent first, then we'll reverse
      } else {
        // For current/future events, load ALL events from today onwards
        params.set('fromDate', fromDate)
        if (toDate) {
          params.set('toDate', toDate)
        }
        params.set('limit', '1000') // Load all future events
        params.set('offset', '0')
        params.set('sortOrder', 'asc') // Chronological order for future events
      }

      // Fetch from enhanced schedule API
      const response = await fetch(`/api/enhanced-schedule?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: EnhancedScheduleResponse = await response.json()
      
      if (loadOlder) {
        console.log('API response for older events:', result)
        const totalOlderEvents = Object.values(result.data).reduce((sum, events) => sum + events.length, 0)
        console.log('Total older events received:', totalOlderEvents)
      }

      // Handle API error response
      if ('error' in result) {
        throw new Error(result.error || 'Unknown API error')
      }

      // Update state with successful response - single source of truth approach
      if (loadOlder && infiniteScroll) {
        // Merge older events with existing data for the active tab only
        const activeTab = currentActiveTab || 'memorial'
        // Use the current data state that was passed in, not the closure data
        const dataToUse = currentDataState || data
        
        setData(currentData => {
          const newData = { ...currentData }
          
          if (result.data[activeTab]) {
            if (newData[activeTab] && newData[activeTab].length > 0) {
              // Combine existing and new older events: [...fetched, ...existing]
              const combinedEvents = [...result.data[activeTab], ...newData[activeTab]]
              // Remove duplicates based on event ID
              const uniqueEvents = combinedEvents.filter((event, index, arr) => 
                arr.findIndex(e => e.id === event.id) === index
              )
              // Sort chronologically (oldest first) - this is our single source of truth
              newData[activeTab] = uniqueEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              console.log(`${activeTab}: Combined ${newData[activeTab].length} events, oldest: ${newData[activeTab][0]?.date}, newest: ${newData[activeTab][newData[activeTab].length - 1]?.date}`)
            } else {
              // If no existing data, just add the new older events (sorted chronologically)
              newData[activeTab] = result.data[activeTab].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              console.log(`${activeTab}: Added ${newData[activeTab].length} older events (no existing data)`)
            }
          }
          
          return newData
        })
      } else {
        // Replace data for initial load or tab switch - sort chronologically
        const sortedData = { ...result.data }
        Object.keys(sortedData).forEach(scheduleType => {
          sortedData[scheduleType] = sortedData[scheduleType].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        })
        setData(sortedData)
        setCurrentUser(result.currentUser)
        setLastUpdated(result.lastUpdated)
        setOffset(0)
      }
      
      setTotalEvents(result.totalEvents)
      // Remove hasMore since we load all future events at once
      setHasMore(false)
      setHasOlder(result.hasOlder || false)
      
    } catch (err) {
      console.error('Enhanced Schedule fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch schedule data')
      
      // Set empty fallback data on error
      if (!loadOlder) {
        setData({})
        // Don't clear tabs - they are static
        setCurrentUser(null)
        setTotalEvents(0)
        setHasMore(false)
      }
      
    } finally {
      setLoading(false)
    }
  }, [types, currentActiveTab, fromDate, toDate, limit, offset, infiniteScroll])

  // Load older function for historical data
  const loadOlder = useCallback(async () => {
    console.log('loadOlder called, hasOlder:', hasOlder, 'loading:', loading)
    if (!hasOlder || loading) return
    
    console.log('About to call fetchScheduleData(false, true)')
    // Get the current data state at the time of calling
    setData(currentData => {
      // Call fetchScheduleData with the current data state
      fetchScheduleData(false, true, currentData)
      return currentData // Don't change the data, just use it for the fetch
    })
  }, [hasOlder, loading, fetchScheduleData])

  // Switch to specific tab - fetch only that tab's data
  const switchToTab = useCallback(async (tabKey: string) => {
    console.log('switchToTab called with:', tabKey)
    setCurrentActiveTab(tabKey)
    // Clear existing data for clean switch
    setData({})
    setHasOlder(false)
    setOffset(0)
    // Manually trigger fetch for the new tab
    await fetchScheduleData(false, false, {})
  }, [fetchScheduleData])

  // Initial data fetch
  useEffect(() => {
    fetchScheduleData(false, false, {})
  }, [fetchScheduleData])

  // Auto-refresh removed to prevent infinite loops

  return {
    data,
    tabs,
    currentUser,
    loading,
    error,
    lastUpdated,
    totalEvents,
    hasMore,
    hasOlder,
    loadOlder,
    refetch: () => fetchScheduleData(false, false, {}),
    switchToTab
  }
}