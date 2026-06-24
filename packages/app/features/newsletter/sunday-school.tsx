import { SundaySchoolType } from '@my/app/types'
import React from 'react'
import { Paragraph, YStack } from '@my/ui'
import { Section } from '@my/app/features/newsletter/Section'

export type NextSundaySchoolProps = {
  event: SundaySchoolType
}
export const NextSundaySchool: React.FC<NextSundaySchoolProps> = ({ event }) => {
  // Override precedence: 'cancelled' forces no-class (with optional message);
  // 'active' forces the class to show; otherwise infer from Refreshments.
  const isCancelled = event.overrideStatus === 'cancelled'
  const isForcedActive = event.overrideStatus === 'active'
  const noClass = isCancelled || (!isForcedActive && !event.Refreshments)

  if (noClass) {
    return (
      <YStack borderTopColor="$gray1Dark" borderWidth={1} borderTopWidth={2} padding="$size.1">
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.overrideMessage || 'No Sunday School this week'}</Paragraph>
        {event.overrideNote ? <Paragraph>{event.overrideNote}</Paragraph> : null}
      </YStack>
    )
  }
  return (
    <Section>
      <Paragraph size="$5" fontWeight={600}>
        {event.Date.toString()}
      </Paragraph>
      <Paragraph size={'$5'} fontWeight={600}>
        Sunday School at 9:30am
      </Paragraph>
      {event.overrideNote ? (
        <Paragraph fontWeight={600} color="$blue11">{event.overrideNote}</Paragraph>
      ) : null}
      <Paragraph>Refreshments provided by: {event.Refreshments}</Paragraph>
    </Section>
  )
}
