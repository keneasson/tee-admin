import React, { useEffect, useState } from 'react'
import { Heading, Paragraph, Separator } from '@my/ui'
import { Wrapper } from 'app/provider/wrapper'
import { Section } from 'app/features/newsletter/Section'
import { IntLink } from '@my/ui/src'
import { DailyReadings } from 'app/features/newsletter/readings/daily-readings'
import { fetchReadings } from 'app/features/newsletter/readings/fetch-readings'
import { useSession } from 'next-auth/react'

export function HomeScreen() {
  const [readings, setReadings] = useState<[] | false>(false)
  const { data: session } = useSession()

  useEffect(() => {
    Promise.all([fetchReadings().then(setReadings)]).catch((error) =>
      console.log('error fetching data', error)
    )
  }, [])

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

        <Paragraph fontWeight={600}>Events</Paragraph>
        <IntLink href="/events/study-weekend-2024">March 2024 Study Day Program</IntLink>

        <IntLink href="/events/toronto-fraternal-2024">Toronto Fraternal Gathering</IntLink>

        <IntLink href="/events/lakefield-bible-school-2024">
          Lakefield Bible School - at Fleming
        </IntLink>

        <Separator />
        {readings && <DailyReadings readings={readings} />}
      </Section>
    </Wrapper>
  )
}
