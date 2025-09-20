'use client'
import React, { useEffect, useState } from 'react'
import { YStack, Heading, Text } from '@my/ui'
import { Event } from '@my/app/types/events'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { Loading } from '@my/app/provider/loading'
import { useRouter } from 'next/navigation'

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
      try {
        const response = await fetch('/api/events/public')
        if (!response.ok) {
          throw new Error('Failed to fetch events')
        }
        const data = await response.json()
        
        // Only show published/ready events
        const publishedEvents = data.filter((event: Event) => 
          event.status === 'published' || event.status === 'ready'
        )
        
        // Filter by date range if provided
        let filteredEvents = publishedEvents
        if (dateRange) {
          filteredEvents = publishedEvents.filter((event: Event) => {
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
