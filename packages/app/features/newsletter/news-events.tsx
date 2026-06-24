'use client'
import React, { useEffect, useState } from 'react'
import { YStack, Heading, Text } from '@my/ui'
import { Event, isEventActive } from '@my/app/types/events'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { Loading } from '@my/app/provider/loading'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'
import { EVENT_DURATION_RULES } from '@my/app/utils/newsletter/event-display-rules'

type EventTypeOrder = {
  [key: string]: number
}

const EVENT_TYPE_ORDER: EventTypeOrder = {
  'recurring': 1,
  'funeral': 2,
  'engagement': 3,  // Grouped with wedding, but engagements first
  'wedding': 4,
  'baptism': 5,
  'study-weekend': 6,
  'general': 7,
  'election-cycle': 8
}

const EVENT_TYPE_LABELS: { [key: string]: string } = {
  'recurring': 'Recurring Events',
  'funeral': 'Funerals',
  'engagement': 'Engagements',
  'wedding': 'Weddings',
  'baptism': 'Baptisms',
  'study-weekend': 'Study Weekends',
  'general': 'General Events',
  'election-cycle': 'Election Cycles'
}

// Event display duration rules live in event-display-rules.ts (shared with the
// public Events listing so the two surfaces stay in sync).

// Fresh event threshold - events created within this time are sorted by creation date
const FRESH_EVENT_DAYS = 7

interface NewsletterEventsProps {
  // Optional prop to limit to specific date range for newsletter
  dateRange?: {
    start: Date
    end: Date
  }
  // Optional prop to exclude certain event types (e.g., baptism, wedding, funeral shown elsewhere)
  excludeTypes?: string[]
  /**
   * Optional callback when an event is pressed
   * Platform-specific navigation should be handled by the caller
   * If not provided, events are not clickable
   */
  onEventPress?: (eventId: string) => void
}

export const NewsEvents: React.FC<NewsletterEventsProps> = ({ dateRange, excludeTypes = [], onEventPress }) => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      console.log('🚀 NewsEvents: Starting to fetch events...')
      try {
        // Force cache bypass with timestamp in development
        const cacheBuster = process.env.NODE_ENV === 'development' ? `?_t=${Date.now()}` : ''
        console.log(`📡 Fetching from: /api/events/public${cacheBuster}`)
        const response = await fetch(`/api/events/public${cacheBuster}`, {
          cache: 'no-store', // Let server handle caching
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        if (!response.ok) {
          throw new Error('Failed to fetch events')
        }
        const data = await response.json()
        console.log(`📦 Received ${data.length} events from API:`, data.map((e: Event) => e.title))

        // Only show active events (uses new active field with legacy fallback)
        const publishedEvents = data.filter((event: Event) => isEventActive(event))

        // Filter by event duration rules
        const currentDate = new Date()
        console.log('📅 Current date for filtering:', currentDate.toISOString())

        const filteredByDuration = publishedEvents.filter((event: Event) => {
          const rule = EVENT_DURATION_RULES[event.type]
          if (!rule) {
            console.warn(`No duration rule found for event type: ${event.type}`)
            return true // Include if no rule defined
          }

          // Use EventDurationCalculator to determine if event should be included
          const context = {
            event,
            rule,
            currentDate,
            firstIncludedDate: (event as any).newsletter?.firstIncludedDate
              ? new Date((event as any).newsletter.firstIncludedDate)
              : undefined
          }

          const result = EventDurationCalculator.shouldIncludeEvent(context)

          // Always log filtering decisions in development
          console.log(`Event "${event.title}" (${event.type}):`, {
            shouldInclude: result.shouldInclude,
            reason: result.reason,
            displayUntilDate: result.displayUntilDate?.toISOString(),
          })

          return result.shouldInclude
        })

        console.log(`✅ Filtered ${publishedEvents.length} events down to ${filteredByDuration.length} based on duration rules`)

        // Filter out excluded event types
        let filteredEvents = filteredByDuration
        if (excludeTypes.length > 0) {
          filteredEvents = filteredEvents.filter((event: Event) => !excludeTypes.includes(event.type))
          console.log(`📋 Excluded types ${excludeTypes.join(', ')}: ${filteredByDuration.length} → ${filteredEvents.length} events`)
        }

        // Filter by date range if provided (additional filtering on top of duration rules)
        if (dateRange) {
          filteredEvents = filteredEvents.filter((event: Event) => {
            // Check various date fields depending on event type
            let eventDate: Date | null = null

            if (event.type === 'study-weekend' && event.dateRange) {
              eventDate = new Date(event.dateRange.start)
            } else if (event.type === 'wedding' && event.ceremonyDate) {
              eventDate = new Date(event.ceremonyDate)
            } else if (event.type === 'baptism' && event.baptismDate) {
              eventDate = new Date(event.baptismDate)
            } else if (event.type === 'funeral' && event.serviceDate) {
              eventDate = new Date(event.serviceDate)
            } else if (event.startDate) {
              eventDate = new Date(event.startDate)
            }

            if (!eventDate) return false

            return eventDate >= dateRange.start && eventDate <= dateRange.end
          })
        }

        setEvents(filteredEvents)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [dateRange])

  // Get the publish/announcement date for an event (publishDate if set, otherwise createdAt)
  const getPublishDate = (event: Event): Date => {
    if (event.publishDate) return new Date(event.publishDate)
    if (event.createdAt) return new Date(event.createdAt)
    return new Date(0)
  }

  // Sort events by type order, then by publish date within same type
  const sortByTypeOrder = (a: Event, b: Event) => {
    const aType = a.type || 'general'
    const bType = b.type || 'general'
    const typeOrderDiff = (EVENT_TYPE_ORDER[aType] || 999) - (EVENT_TYPE_ORDER[bType] || 999)
    if (typeOrderDiff !== 0) return typeOrderDiff

    // Same type: sort by publish date (newest first)
    const aPublishDate = getPublishDate(a)
    const bPublishDate = getPublishDate(b)
    return bPublishDate.getTime() - aPublishDate.getTime()
  }

  const groupEventsByFreshness = (events: Event[]): { fresh: Event[], older: Event[] } => {
    const now = new Date()
    const freshThreshold = new Date(now.getTime() - FRESH_EVENT_DAYS * 24 * 60 * 60 * 1000)

    const fresh: Event[] = []
    const older: Event[] = []

    events.forEach(event => {
      const publishDate = getPublishDate(event)
      if (publishDate >= freshThreshold) {
        fresh.push(event)
      } else {
        older.push(event)
      }
    })

    // Sort each group by type order
    fresh.sort(sortByTypeOrder)
    older.sort(sortByTypeOrder)

    return { fresh, older }
  }

  if (loading) {
    return <Loading />
  }

  if (error) {
    return (
      <YStack gap="$2">
        <Text color="red">Error loading events: {error}</Text>
      </YStack>
    )
  }

  if (events.length === 0) {
    return (
      <YStack gap="$2">
        <Text>No upcoming events.</Text>
      </YStack>
    )
  }

  const { fresh, older } = groupEventsByFreshness(events)

  // Combine fresh and older events into a single sorted list
  const allSorted = [...fresh, ...older]

  return (
    <YStack gap="$3">
      {allSorted.map((event) => (
        <EventSummaryCard
          key={event.id}
          event={event}
          variant="newsletter"
          onPress={onEventPress ? () => onEventPress(event.id) : undefined}
        />
      ))}
    </YStack>
  )
}
