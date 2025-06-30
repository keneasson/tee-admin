'use client'

import { useEffect, useState } from 'react'
import { Heading, Paragraph, Separator } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { IntLink } from '@my/ui/src'
import { DailyReadings } from '@my/app/features/newsletter/readings/daily-readings'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'
import { useSession } from 'next-auth/react'

export function HomeScreen() {
  const [readings, setReadings] = useState<[] | false>(false)
  const { data: session, status } = useSession()

  useEffect(() => {
    // Only fetch readings on client side
    if (typeof window !== 'undefined') {
      fetchReadings()
        .then(setReadings)
        .catch((error) => {
          console.log('error fetching data', error)
          setReadings([]) // Set empty array on error to prevent loading state
        })
    }
  }, [])

  // Show loading during SSR or initial client hydration
  if (status === "loading") {
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
        <Heading size={5}>Welcome to the Toronto East Christadelphian's online portal.</Heading>

        <Paragraph>
          Here we will share the upcoming News and Events taking place both at our Hall in East
          York, Toronto.
        </Paragraph>
        <Paragraph fontWeight={600}>News</Paragraph>
        <IntLink href="/newsletter">View Online Newsletter</IntLink>
        {session && session.user && <IntLink href="/welfare">Welfare</IntLink>}

        <Paragraph fontWeight={600}>Programs for each Term</Paragraph>
        <IntLink href="/schedule">View Schedules</IntLink>

        <Paragraph fontWeight={600}>Past Events</Paragraph>
        <IntLink href="/events/study-weekend-2024">Notes from March 2024 Study Day</IntLink>

        <Separator />
        {readings && <DailyReadings readings={readings} />}
      </Section>
    </Wrapper>
  )
}
