'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { Wrapper } from '@my/app/provider/wrapper'
import { H2, YStack, Card, Separator, XStack, Button, Text } from '@my/ui'
import { ProgramTypes } from '@my/app/types'
import { Loading } from '@my/app/provider/loading'
import { NextBibleClass } from '@my/app/features/newsletter/bible-class'
import { NextSundaySchool } from '@my/app/features/newsletter/sunday-school'
import { NextMemorial } from '@my/app/features/newsletter/memorial'
import { NewsEvents } from '@my/app/features/newsletter/news-events'
import { fetchUpcoming } from '@my/app/features/newsletter/fetch-upcoming'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'
import { DailyReadings } from '@my/app/features/newsletter/readings/daily-readings'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Event, isEventActive } from '@my/app/types/events'
import type { NewsItem } from '@my/app/types/news'
import { isNewsActive } from '@my/app/types/news'
import { EventDurationCalculator } from '@my/app/utils/newsletter/event-duration'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { Paragraph } from '@my/ui'
import { Vote } from '@tamagui/lucide-icons'

// Helper function to check if an election-cycle event is currently active
const isElectionActive = (event: Event): boolean => {
  if (event.type !== 'election-cycle') return false
  const electionEvent = event as any
  if (!electionEvent.electionStartDate || !electionEvent.electionEndDate) return false
  const now = new Date()
  const start = new Date(electionEvent.electionStartDate)
  const end = new Date(electionEvent.electionEndDate)
  return now >= start && now <= end
}

type NewsletterScreenProps = {
  userRole?: string
  isMemberOrHigher?: boolean
  isAuthLoading?: boolean
  isAdminOrOwner?: boolean
  onClearCache?: () => Promise<void>
  /**
   * Optional navigation callback for platform-specific routing
   * If not provided, navigation is disabled
   */
  onNavigate?: (path: string) => void
}

export const NewsletterScreen: React.FC<NewsletterScreenProps> = ({
  userRole,
  isMemberOrHigher = false,
  isAuthLoading = false,
  isAdminOrOwner = false,
  onClearCache,
  onNavigate,
}) => {
  const [program, setProgram] = useState<ProgramTypes[] | null>(null)
  const [readings, setReadings] = useState<[] | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [clearingCache, setClearingCache] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const isHydrated = useHydrated()

  const refreshData = useCallback(async () => {
    setRefreshing(true)
    try {
      const cacheBuster = `?_t=${Date.now()}`
      const [newProgram, newReadings, eventsResponse, newsResponse] = await Promise.all([
        fetchUpcoming({ bypassCache: true }),
        fetchReadings(true),
        fetch(`/api/events/public${cacheBuster}`, { cache: 'no-store' }),
        fetch(`/api/news${cacheBuster}`, { cache: 'no-store' }),
      ])
      setProgram(newProgram)
      setReadings(newReadings)

      if (eventsResponse.ok) {
        const data = await eventsResponse.json()
        const publishedEvents = data.filter((event: Event) => isEventActive(event))
        setUpcomingEvents(publishedEvents)
      }

      if (newsResponse.ok) {
        const data = await newsResponse.json()
        setNewsItems((data as NewsItem[]).filter((item) => isNewsActive(item)))
      }
    } finally {
      setRefreshing(false)
    }
  }, [])

  const handleClearCache = useCallback(async () => {
    if (!onClearCache) return
    setClearingCache(true)
    try {
      await onClearCache()
      await refreshData()
    } finally {
      setClearingCache(false)
    }
  }, [onClearCache, refreshData])

  useEffect(() => {
    // Only fetch data after hydration to prevent hydration mismatches
    if (!isHydrated) return

    console.log('in useEffect', { program, readings })

    const fetchEvents = async () => {
      try {
        const cacheBuster = process.env.NODE_ENV === 'development' ? `?_t=${Date.now()}` : ''
        const response = await fetch(`/api/events/public${cacheBuster}`, {
          cache: 'no-store',
        })
        if (response.ok) {
          const data = await response.json()
          const publishedEvents = data.filter((event: Event) => isEventActive(event))
          setUpcomingEvents(publishedEvents)
        }
      } catch (error) {
        console.log('error fetching events', error)
      }
    }

    const fetchNews = async () => {
      try {
        const response = await fetch('/api/news', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setNewsItems((data as NewsItem[]).filter((item) => isNewsActive(item)))
        }
      } catch (error) {
        console.log('error fetching news', error)
      }
    }

    Promise.all([
      fetchUpcoming({}).then(setProgram),
      fetchReadings().then(setReadings),
      fetchEvents(),
      fetchNews(),
    ]).catch(
      (error) => console.log('error fetching data', error)
    )
  }, [isHydrated])

  // Don't render content until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return <Loading />
  }

  // Show loading while data is being fetched
  if (program === null) return <Loading />

  let lastEventDate = 0
  const checkForSameDayEvents = (date: Date): boolean => {
    const month = date.getDate()
    const day = date.getDay()
    const currentDate = parseInt(`${month}${day}`)
    if (currentDate === lastEventDate) {
      return true
    }
    lastEventDate = currentDate
    return false
  }

  // Group events by date string
  const groupedByDate: { [date: string]: ProgramTypes[] } = {}

  program.forEach(event => {
    const eventDateStr = String(event.Date) // Convert Date to string for indexing
    if (!groupedByDate[eventDateStr]) {
      groupedByDate[eventDateStr] = []
    }
    groupedByDate[eventDateStr].push(event)
  })

  return (
    <Wrapper subHeader={'Newsletter'}>
      <YStack gap="$4" padding="$4" testID="newsletter-container">
        {/* Admin Toolbar */}
        {isAdminOrOwner ? <XStack
            testID="newsletter-admin-toolbar"
            justifyContent="space-between"
            alignItems="center"
            paddingHorizontal="$4"
            paddingVertical="$2"
            backgroundColor="$backgroundSecondary"
            borderRadius="$4"
          >
            <Text fontSize="$2" color="$colorSecondary">
              Admin: {program?.length || 0} events loaded
            </Text>
            <XStack gap="$2">
              {onClearCache ? <Button
                  size="$2"
                  variant="outlined"
                  onPress={handleClearCache}
                  disabled={clearingCache || refreshing}
                >
                  {clearingCache ? 'Clearing...' : 'Clear Cache'}
                </Button> : null}
              <Button
                size="$2"
                variant="outlined"
                onPress={refreshData}
                disabled={clearingCache || refreshing}
              >
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </XStack>
          </XStack> : null}

        {/* Regular Services Section */}
        <YStack gap="$3" testID="newsletter-regular-services">
          <H2 fontFamily="$body" fontWeight="600">Regular Services</H2>

          {/* Render services grouped by date */}
          {Object.entries(groupedByDate).map(([date, events]) => {
            // Check if this date has Sunday services (both Sunday School and Memorial)
            const sundayEvents = events.filter(e =>
              e.Key === 'sundaySchool' || e.Key === 'memorial'
            )
            const bibleClassEvents = events.filter(e => e.Key === 'bibleClass')

            return (
              <YStack key={date} gap="$3">
                {/* If there are Sunday events for this date, group them in one Card */}
                {sundayEvents.length > 0 ? <Card
                    elevation="$2"
                    borderWidth={1}
                    borderColor="$borderColor"
                    padding="$4"
                    borderRadius="$4"
                    backgroundColor="$background"
                  >
                    <YStack gap="$2">
                      {sundayEvents.map((event, index) => {
                        const thisEventDate = new Date(event.Date)
                        const checkSameDay = checkForSameDayEvents(thisEventDate)
                        return (
                          <YStack key={`${date}-${index}`}>
                            {event.Key === 'sundaySchool' ? <>
                                <NextSundaySchool event={event} />
                                {index < sundayEvents.length - 1 ? <Separator marginVertical="$2" /> : null}
                              </> : null}
                            {event.Key === 'memorial' ? <NextMemorial event={event} isSameDay={checkSameDay} upcomingEvents={upcomingEvents} /> : null}
                          </YStack>
                        )
                      })}
                    </YStack>
                  </Card> : null}

                {/* Bible Class gets its own Card */}
                {/* EXCEPTION: If Toronto East Business Meeting is on the same night, show that instead */}
                {bibleClassEvents.map((event, index) => {
                  // Check if there's a Business Meeting event on the same date
                  const bibleClassDate = new Date(event.Date)
                  const businessMeetingEvent = upcomingEvents.find((upcomingEvent) => {
                    if (upcomingEvent.type !== 'general') return false
                    if (!upcomingEvent.title?.toLowerCase().includes('business meeting')) return false

                    // Compare dates
                    const eventDate = (upcomingEvent as any).startDate
                      ? new Date((upcomingEvent as any).startDate)
                      : null

                    if (!eventDate) return false

                    // Same day comparison
                    return (
                      bibleClassDate.getFullYear() === eventDate.getFullYear() &&
                      bibleClassDate.getMonth() === eventDate.getMonth() &&
                      bibleClassDate.getDate() === eventDate.getDate()
                    )
                  })

                  // If Business Meeting found, show that instead
                  if (businessMeetingEvent) {
                    return (
                      <Card
                        key={`${date}-bm-${index}`}
                        elevate
                        borderWidth={1}
                        borderColor="$borderColor"
                        padding="$4"
                        borderRadius="$4"
                        backgroundColor="$background"
                      >
                        <EventSummaryCard
                          event={businessMeetingEvent}
                          variant="newsletter"
                          onPress={() => onNavigate?.(`/events/${businessMeetingEvent.id}`)}
                          userRole={userRole}
                          isMemberOrHigher={isMemberOrHigher}
                        />
                      </Card>
                    )
                  }

                  // Otherwise, show normal Bible Class
                  return (
                    <Card
                      key={`${date}-bc-${index}`}
                      elevate
                      borderWidth={1}
                      borderColor="$borderColor"
                      padding="$4"
                      borderRadius="$4"
                      backgroundColor="$background"
                    >
                      <NextBibleClass event={event} />
                    </Card>
                  )
                })}
              </YStack>
            )
          })}
        </YStack>

        {/* Election Notice - Shows when there's an active election */}
        {(() => {
          const activeElection = upcomingEvents.find((event) => isElectionActive(event))
          if (!activeElection) return null

          const electionEvent = activeElection as any
          const endDate = new Date(electionEvent.electionEndDate)
          const formattedEndDate = endDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })

          return (
            <Card
              testID="newsletter-election-notice"
              elevation="$2"
              borderWidth={2}
              borderColor="$orange8"
              padding="$4"
              borderRadius="$4"
              backgroundColor="$orange2"
            >
              <YStack gap="$2">
                <XStack gap="$2" alignItems="center">
                  <Vote size="$1" color="$orange10" />
                  <Text fontSize="$5" fontWeight="600" color="$orange11">
                    Election Notice
                  </Text>
                </XStack>
                <Text fontSize="$4" color="$color">
                  Elections for Service brethren are underway. Members should have received a link to the online ballot already—if not, please ask the Arranging brethren. You have 3 ways to vote: (1) online ballot, (2) asking another member to submit your vote, or (3) requesting a printed ballot. The election concludes {formattedEndDate}.
                </Text>
              </YStack>
            </Card>
          )
        })()}

        {/* Special Announcements - Baptisms, Weddings, Engagements, Funerals */}
        {/* Smart sorting: fresh events (< 7 days from publish) first, then older */}
        {/* Within each freshness group, sorted by type: funeral, engagement, wedding, baptism */}
        {(() => {
          // Type order for special announcements (lower = shown first)
          const SPECIAL_TYPE_ORDER: { [key: string]: number } = {
            'funeral': 1,
            'engagement': 2,
            'wedding': 3,
            'baptism': 4,
          }

          // Get publish date for freshness calculation
          const getPublishDate = (event: Event): Date => {
            if (event.publishDate) return new Date(event.publishDate)
            if (event.createdAt) return new Date(event.createdAt)
            return new Date(0)
          }

          const FRESH_DAYS = 7
          const now = new Date()
          const freshThreshold = new Date(now.getTime() - FRESH_DAYS * 24 * 60 * 60 * 1000)

          // Duration rules for special announcement types
          const SPECIAL_DURATION_RULES: Record<string, { displayDuration: string; priority: number; includeInSummary: boolean; requiresCTA: boolean }> = {
            'funeral': { displayDuration: '2_weeks_then_thursday_before', priority: 2, includeInSummary: true, requiresCTA: false },
            'engagement': { displayDuration: '3_weeks_from_publish', priority: 3, includeInSummary: true, requiresCTA: false },
            'wedding': { displayDuration: '3_weeks_or_until_event_date', priority: 4, includeInSummary: true, requiresCTA: false },
            'baptism': { displayDuration: '1_week_after_event', priority: 5, includeInSummary: true, requiresCTA: false },
          }

          const specialEvents = upcomingEvents
            .filter(
              (event) => event.type === 'baptism' || event.type === 'wedding' || event.type === 'engagement' || event.type === 'funeral'
            )
            .filter((event) => {
              const rule = SPECIAL_DURATION_RULES[event.type]
              if (!rule) return true
              const result = EventDurationCalculator.shouldIncludeEvent({
                event,
                rule: rule as any,
                currentDate: now,
                firstIncludedDate: (event as any).newsletter?.firstIncludedDate
                  ? new Date((event as any).newsletter.firstIncludedDate)
                  : undefined,
              })
              return result.shouldInclude
            })

          // Smart sort: fresh events first, then by type order, then by publish date
          const smartSort = (a: Event, b: Event) => {
            const aPublishDate = getPublishDate(a)
            const bPublishDate = getPublishDate(b)
            const aIsFresh = aPublishDate >= freshThreshold
            const bIsFresh = bPublishDate >= freshThreshold

            // Fresh events come before older events
            if (aIsFresh && !bIsFresh) return -1
            if (!aIsFresh && bIsFresh) return 1

            // Within same freshness group, sort by type order
            const aType = a.type || 'baptism'
            const bType = b.type || 'baptism'
            const typeOrderDiff = (SPECIAL_TYPE_ORDER[aType] || 999) - (SPECIAL_TYPE_ORDER[bType] || 999)
            if (typeOrderDiff !== 0) return typeOrderDiff

            // Same type: sort by publish date (newest first)
            return bPublishDate.getTime() - aPublishDate.getTime()
          }

          // Sort all events with smart sorting
          const sortedEvents = [...specialEvents].sort(smartSort)

          if (sortedEvents.length === 0 && newsItems.length === 0) return null

          return (
            <YStack gap="$3" testID="newsletter-special-announcements">
              <H2 fontFamily="$body" fontWeight="600">Announcements</H2>
              {sortedEvents.map((event) => (
                <EventSummaryCard
                  key={event.id}
                  event={event}
                  variant="newsletter"
                  onPress={() => onNavigate?.(`/events/${event.id}`)}
                  userRole={userRole}
                  isMemberOrHigher={isMemberOrHigher}
                />
              ))}
              {newsItems.map((item) => (
                <Card
                  key={item.id}
                  elevation="$2"
                  borderWidth={1}
                  borderColor="$borderColor"
                  padding="$4"
                  borderRadius="$4"
                  backgroundColor="$background"
                >
                  <YStack gap="$2">
                    <Text fontSize="$6" fontWeight="600">
                      {item.title}
                    </Text>
                    <Paragraph whiteSpace="pre-wrap">{item.body}</Paragraph>
                  </YStack>
                </Card>
              ))}
            </YStack>
          )
        })()}

        {/* Events Section - excludes baptisms, weddings, engagements, funerals, election-cycle (shown above/as message) */}
        <YStack gap="$3" testID="newsletter-upcoming-events">
          <H2 fontFamily="$body" fontWeight="600">Upcoming Events</H2>
          <NewsEvents
            excludeTypes={['baptism', 'wedding', 'engagement', 'funeral', 'election-cycle']}
            onEventPress={(eventId) => onNavigate?.(`/events/${eventId}`)}
          />
        </YStack>

        {/* Daily Bible Reading Section */}
        {readings ? <YStack gap="$3" testID="newsletter-daily-readings">
            <H2 fontFamily="$body" fontWeight="600">Daily Bible Reading Planner</H2>
            <DailyReadings readings={readings} />
          </YStack> : null}
      </YStack>
    </Wrapper>
  )
}
