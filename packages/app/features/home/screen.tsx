'use client'

import { useEffect, useState } from 'react'
import { Heading, Paragraph, Separator, Card, XStack, YStack, Text } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { IntLink } from '@my/ui/src'
import { DailyReadings } from '@my/app/features/newsletter/readings/daily-readings'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'
import { Event, isEventActive } from '@my/app/types/events'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { Newspaper, Users } from '@tamagui/lucide-icons'
import { useRouter } from 'solito/navigation'

type HomeScreenProps = {
  /** Whether user is authenticated (has a session) */
  isAuthenticated?: boolean
  /** Whether auth is still loading */
  isAuthLoading?: boolean
  /** User role for event display */
  userRole?: string
  /** Whether user is member or higher */
  isMemberOrHigher?: boolean
}

export function HomeScreen({
  isAuthenticated = false,
  isAuthLoading = false,
  userRole,
  isMemberOrHigher = false,
}: HomeScreenProps) {
  const router = useRouter()
  const [readings, setReadings] = useState<[] | false>(false)
  const [nextEvent, setNextEvent] = useState<Event | null>(null)
  const [eventLoading, setEventLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchReadings()
        .then(setReadings)
        .catch((error) => {
          console.log('error fetching data', error)
          setReadings([])
        })
    }
  }, [])

  useEffect(() => {
    const fetchNextEvent = async () => {
      try {
        const response = await fetch('/api/events/public')
        if (!response.ok) return
        const data = await response.json()
        const now = new Date()
        const upcomingStudyEvents = (data as Event[])
          .filter((e) => isEventActive(e))
          .filter((e) => {
            const eventDate = e.dateRange?.start || e.startDate || e.ceremonyDate || e.serviceDate || e.baptismDate
            return eventDate ? new Date(eventDate) >= now : false
          })
          .sort((a, b) => {
            const dateA = new Date(a.dateRange?.start || a.startDate || a.ceremonyDate || a.serviceDate || a.baptismDate || 0)
            const dateB = new Date(b.dateRange?.start || b.startDate || b.ceremonyDate || b.serviceDate || b.baptismDate || 0)
            return dateA.getTime() - dateB.getTime()
          })
        if (upcomingStudyEvents.length > 0) {
          setNextEvent(upcomingStudyEvents[0]!)
        }
      } catch {
        // silently fail - event section just won't show
      } finally {
        setEventLoading(false)
      }
    }
    fetchNextEvent()
  }, [])

  if (isAuthLoading) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Paragraph>Loading...</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Section space={'$4'}>
        <Heading size={5}>Welcome to the Christadelphian Portal</Heading>
        <Paragraph>
          Your hub for ecclesial news, schedules, and the Christadelphian community directory.
        </Paragraph>

        {/* Two Major Features */}
        <XStack gap="$3" flexWrap="wrap" justifyContent="center" paddingVertical="$2">
          <FeatureCard
            onPress={() => router.push('/newsletter')}
            icon={<Newspaper size={28} color="$blue10" />}
            title="News & Schedule"
            description="Newsletters, upcoming events, and term schedules for your ecclesia."
          />
          <FeatureCard
            onPress={() => router.push('/directory/ecclesias')}
            icon={<Users size={28} color="$green10" />}
            title="Christadelphian Directory"
            description="Connect with ecclesias and brothers & sisters across the Christadelphian community."
          />
        </XStack>

        <Separator />

        {/* Next Upcoming Event */}
        {!eventLoading && nextEvent ? (
          <YStack gap="$2">
            <Text fontSize="$5" fontWeight="700">Upcoming Event</Text>
            <EventSummaryCard
              event={nextEvent}
              onPress={() => router.push(`/events/${nextEvent.id}`)}
              variant="newsletter"
              userRole={userRole}
              isMemberOrHigher={isMemberOrHigher}
            />
          </YStack>
        ) : null}

        {/* Daily Readings */}
        {readings ? <DailyReadings readings={readings} /> : null}

        <Separator />

        {/* Quick Links */}
        <YStack gap="$2">
          <Text fontSize="$4" fontWeight="600">Quick Links</Text>
          <XStack gap="$3" flexWrap="wrap">
            <IntLink href="/newsletter">Latest Newsletter</IntLink>
            <IntLink href="/schedule">Term Schedules</IntLink>
            <IntLink href="/events">All Events</IntLink>
            {isAuthenticated ? <IntLink href="/directory/ecclesias">Ecclesial Directory</IntLink> : null}
            {isAuthenticated ? <IntLink href="/directory/people">Contact List</IntLink> : null}
          </XStack>
        </YStack>
      </Section>
    </Wrapper>
  )
}

function FeatureCard({
  onPress,
  icon,
  title,
  description,
}: {
  onPress: () => void
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Card
      elevate
      bordered
      padding="$4"
      borderRadius="$4"
      flex={1}
      minWidth={260}
      maxWidth={400}
      cursor="pointer"
      hoverStyle={{ scale: 1.02, borderColor: '$blue8' }}
      pressStyle={{ scale: 0.98 }}
      animation="quick"
      onPress={onPress}
    >
      <YStack gap="$2" alignItems="center" justifyContent="center">
        {icon}
        <Text fontSize="$5" fontWeight="700" textAlign="center">{title}</Text>
        <Text fontSize="$3" color="$gray11" textAlign="center">{description}</Text>
      </YStack>
    </Card>
  )
}
