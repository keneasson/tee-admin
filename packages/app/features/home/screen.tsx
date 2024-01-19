import React from 'react'
import { Heading, Paragraph } from '@my/ui'
import { Wrapper } from 'app/provider/wrapper'
import { Section } from 'app/features/newsletter/Section'
import { IntLink } from '@my/ui/src'

export function HomeScreen() {
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

        <Paragraph fontWeight={600}>Events</Paragraph>
        <IntLink href="/events/study-weekend-2024">March 2024 Study Day Program</IntLink>

        <Paragraph>
          We also share our {new Date().getFullYear()} program for Worship, Bible Study and Sunday
          School.
        </Paragraph>
        <IntLink href="/schedule">View Schedules</IntLink>
      </Section>
    </Wrapper>
  )
}
