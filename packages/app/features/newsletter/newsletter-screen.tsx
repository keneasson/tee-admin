'use client'
import React, { useEffect, useState } from 'react'
import { Wrapper } from '@my/app/provider/wrapper'
import { H2, YStack, Card, Separator } from '@my/ui'
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
import { Event } from '@my/app/types/events'
import { EventSummaryCard } from '@my/ui/src/events/event-summary-card'
import { useRouter } from 'next/navigation'

type NewsletterScreenProps = {
  userRole?: string
  isMemberOrHigher?: boolean
  isAuthLoading?: boolean
}

export const NewsletterScreen: React.FC<NewsletterScreenProps> = ({ userRole, isMemberOrHigher = false, isAuthLoading = false }) => {
  const [program, setProgram] = useState<ProgramTypes[] | null>(null)
  const [readings, setReadings] = useState<[] | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const isHydrated = useHydrated()
  const router = useRouter()

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
          const publishedEvents = data.filter((event: Event) =>
            event.status === 'published' || event.status === 'ready'
          )
          setUpcomingEvents(publishedEvents)
        }
      } catch (error) {
        console.log('error fetching events', error)
      }
    }

    Promise.all([
      fetchUpcoming({}).then(setProgram),
      fetchReadings().then(setReadings),
      fetchEvents()
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
      <YStack gap="$4" padding="$4">
        {/* Regular Services Section */}
        <YStack gap="$3">
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
                {sundayEvents.length > 0 && (
                  <Card
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
                            {event.Key === 'sundaySchool' && (
                              <>
                                <NextSundaySchool event={event} />
                                {index < sundayEvents.length - 1 && <Separator marginVertical="$2" />}
                              </>
                            )}
                            {event.Key === 'memorial' && <NextMemorial event={event} isSameDay={checkSameDay} />}
                          </YStack>
                        )
                      })}
                    </YStack>
                  </Card>
                )}

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
                          onPress={() => router.push(`/events/${businessMeetingEvent.id}`)}
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

        {/* Events Section */}
        <YStack gap="$3">
          <H2 fontFamily="$body" fontWeight="600">Upcoming Events</H2>
          <NewsEvents />
        </YStack>

        {/* Daily Bible Reading Section */}
        {readings && (
          <YStack gap="$3">
            <H2 fontFamily="$body" fontWeight="600">Daily Bible Reading Planner</H2>
            <DailyReadings readings={readings} />
          </YStack>
        )}
      </YStack>
    </Wrapper>
  )
}
