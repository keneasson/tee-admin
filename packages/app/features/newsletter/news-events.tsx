'use client'
import React, { useEffect, useState } from 'react'
import { YStack, Heading, Text } from '@my/ui'
import { Event } from '@my/app/types/events'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { Loading } from '@my/app/provider/loading'
import { useRouter } from 'next/navigation'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'
import type { EventTypeRule } from '@my/app/types/newsletter-rules'

type EventTypeOrder = {
  [key: string]: number
}

const EVENT_TYPE_ORDER: EventTypeOrder = {
  'recurring': 1,
  'funeral': 2,
  'wedding': 3,
  'baptism': 4,
  'study-weekend': 5,
  'general': 6
}

const EVENT_TYPE_LABELS: { [key: string]: string } = {
  'recurring': 'Recurring Events',
  'funeral': 'Funerals',
  'wedding': 'Weddings',
  'baptism': 'Baptisms',
  'study-weekend': 'Study Weekends',
  'general': 'General Events'
}

// Event display duration rules
const EVENT_DURATION_RULES: Record<string, EventTypeRule> = {
  'study-weekend': {
    displayDuration: 'until_event_date',
    priority: 5,
    includeInSummary: true,
    requiresCTA: true,
  },
  'funeral': {
    displayDuration: '3_weeks_after_event',
    priority: 2,
    includeInSummary: true,
    requiresCTA: false,
  },
  'wedding': {
    displayDuration: '3_weeks_or_until_event_date',
    priority: 3,
    includeInSummary: true,
    requiresCTA: false,
  },
  'baptism': {
    displayDuration: '1_week_after_event',
    priority: 4,
    includeInSummary: true,
    requiresCTA: false,
  },
  'general': {
    displayDuration: 'until_event_date',
    priority: 6,
    includeInSummary: true,
    requiresCTA: false,
  },
  'recurring': {
    displayDuration: 'until_event_date',
    priority: 1,
    includeInSummary: true,
    requiresCTA: false,
  },
}

interface NewsletterEventsProps {
  // Optional prop to limit to specific date range for newsletter
  dateRange?: {
    start: Date
    end: Date
  }
}

export const NewsEvents: React.FC<NewsletterEventsProps> = ({ dateRange }) => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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

        // Only show published/ready events
        const publishedEvents = data.filter((event: Event) =>
          event.status === 'published' || event.status === 'ready'
        )

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

        // Filter by date range if provided (additional filtering on top of duration rules)
        let filteredEvents = filteredByDuration
        if (dateRange) {
          filteredEvents = filteredByDuration.filter((event: Event) => {
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

  const groupEventsByType = (events: Event[]) => {
    const grouped: { [key: string]: Event[] } = {}
    
    events.forEach(event => {
      const eventType = event.type || 'general'
      if (!grouped[eventType]) {
        grouped[eventType] = []
      }
      grouped[eventType].push(event)
    })
    
    // Sort groups by the defined order
    const sortedGroups: { [key: string]: Event[] } = {}
    Object.keys(grouped)
      .sort((a, b) => (EVENT_TYPE_ORDER[a] || 999) - (EVENT_TYPE_ORDER[b] || 999))
      .forEach(key => {
        sortedGroups[key] = grouped[key]
      })
    
    return sortedGroups
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

  const groupedEvents = groupEventsByType(events)

  return (
    <YStack gap="$4">
      {Object.entries(groupedEvents).map(([eventType, typeEvents]) => (
        <YStack key={eventType} gap="$3">
          <Heading size={3} fontFamily="$body" fontWeight="500" color="$textSecondary">
            {EVENT_TYPE_LABELS[eventType] || eventType}
          </Heading>
          <YStack gap="$3">
            {typeEvents.map((event) => (
              <EventSummaryCard
                key={event.id}
                event={event}
                variant="newsletter"
                onPress={() => router.push(`/events/${event.id}`)}
              />
            ))}
          </YStack>
        </YStack>
      ))}
    </YStack>
  )
}
