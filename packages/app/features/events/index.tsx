'use client'
import React, { useState, useEffect } from 'react'
import { Wrapper } from '@my/app/provider/wrapper'
import { Button, Heading, Paragraph } from '@my/ui'
import { useRouter } from 'solito/navigation'
import { StudyWeekend2024 } from '@my/app/features/events/study-weekend-2024'
import { XStack, YStack, Card, Text } from 'tamagui'
import { Section } from '@my/app/features/newsletter/Section'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { EventDetailView } from '@my/ui/src/events/event-detail-view'
import { Event, isEventActive } from '@my/app/types/events'
import { shouldDisplayEvent } from '@my/app/utils/newsletter/event-display-rules'

export type BackLink = {
  href: string
  label: string
}

type EventProps = {
  eventId?: string | string[]
  userRole?: string
  isMemberOrHigher?: boolean
  isAuthLoading?: boolean
  backLink?: BackLink
}
export const Events: React.FC<EventProps> = ({ eventId, userRole, isMemberOrHigher = false, isAuthLoading = false, backLink }) => {
  if (!eventId) {
    return <EventListing userRole={userRole} isMemberOrHigher={isMemberOrHigher} isAuthLoading={isAuthLoading} />
  }

  // Handle legacy study weekend
  if (eventId === 'study-weekend-2024') {
    return <StudyWeekend2024 />
  }

  // Handle dynamic events
  if (typeof eventId === 'string') {
    return <DynamicEventDetail eventId={eventId} userRole={userRole} isMemberOrHigher={isMemberOrHigher} isAuthLoading={isAuthLoading} backLink={backLink} />
  }

  return <EventListing isNotFound={true} userRole={userRole} isMemberOrHigher={isMemberOrHigher} isAuthLoading={isAuthLoading} />
}

type EventListingProps = {
  isNotFound?: boolean
  userRole?: string
  isMemberOrHigher?: boolean
  isAuthLoading?: boolean
}
export const EventListing: React.FC<EventListingProps> = ({ isNotFound, userRole, isMemberOrHigher = false, isAuthLoading = false }) => {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events/public')
        if (!response.ok) {
          throw new Error('Failed to fetch events')
        }
        const data = await response.json()
        // Only show active events that are still within their display window.
        // Applying the newsletter duration rules here keeps the Events list in
        // sync with the newsletter (e.g. an engagement expires 3 weeks after
        // publish instead of lingering indefinitely).
        const now = new Date()
        const publishedEvents = data.filter(
          (event: Event) => isEventActive(event) && shouldDisplayEvent(event, now)
        )
        setEvents(publishedEvents)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const handleEventPress = (eventId: string) => {
    router.push(`/events/${eventId}`)
  }

  return (
    <Wrapper subHeader={'Events hosted by Toronto East'}>
      {isNotFound ? (
        <Section>
          <Paragraph color={'red'}>The event you were looking for was not found. </Paragraph>
        </Section>
      ) : null}
      
      {/* Toronto East Study Weekend 2024 - Keep as legacy */}
      <Section>
        <Heading size={5}>Events hosted by the Toronto East Christadelphians</Heading>
        <Card elevate bordered padding="$4" borderRadius="$4" backgroundColor="$background">
          <Button size="$2" onPress={() => router.push('/events/study-weekend-2024')} chromeless>
            Toronto East Study Weekend 2024
          </Button>
        </Card>
      </Section>

      {/* Dynamic Events */}
      {loading ? (
        <Section>
          <Paragraph>Loading events...</Paragraph>
        </Section>
      ) : error ? (
        <Section>
          <Paragraph color={'red'}>Error loading events: {error}</Paragraph>
        </Section>
      ) : events.length > 0 ? (
        <Section>
          <YStack gap="$4">
            {events.map((event) => (
              <EventSummaryCard
                key={event.id}
                event={event}
                onPress={() => handleEventPress(event.id)}
                variant="newsletter"
                userRole={userRole}
                isMemberOrHigher={isMemberOrHigher}
              />
            ))}
          </YStack>
        </Section>
      ) : (
        <Section>
          <Paragraph>No events found.</Paragraph>
        </Section>
      )}
    </Wrapper>
  )
}

type DynamicEventDetailProps = {
  eventId: string
  userRole?: string
  isMemberOrHigher?: boolean
  isAuthLoading?: boolean
  backLink?: BackLink
}

export const DynamicEventDetail: React.FC<DynamicEventDetailProps> = ({ eventId, userRole, isMemberOrHigher = false, isAuthLoading = false, backLink }) => {
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/public?id=${eventId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Event not found')
          } else {
            throw new Error('Failed to fetch event')
          }
          return
        }
        const data = await response.json()
        setEvent(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load event')
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [eventId])

  if (loading) {
    return (
      <Wrapper subHeader={'Event Details'}>
        <Section>
          <Paragraph>Loading event...</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  if (error || !event) {
    return (
      <Wrapper subHeader={'Event Not Found'}>
        <Section>
          <Paragraph color={'red'}>{error || 'Event not found'}</Paragraph>
          <EventsFooter backLink={backLink} />
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader={event.title || 'Event Details'}>
      <Section>
        <EventDetailView
          event={event}
          userRole={userRole}
          isMemberOrHigher={isMemberOrHigher}
          isAuthLoading={isAuthLoading}
        />
        <EventsFooter backLink={backLink} />
      </Section>
    </Wrapper>
  )
}

export const EventsFooter: React.FC<{ backLink?: BackLink }> = ({ backLink }) => {
  const router = useRouter()
  return (
    <XStack paddingTop="$6">
      <Text
        onPress={() => backLink ? router.push(backLink.href) : router.back()}
        color="$blue10"
        fontWeight="600"
        fontSize="$3"
        cursor="pointer"
        textDecorationLine="none"
        hoverStyle={{ textDecorationLine: "underline" }}
      >
        {backLink ? `${backLink.label} →` : '← Back'}
      </Text>
    </XStack>
  )
}
