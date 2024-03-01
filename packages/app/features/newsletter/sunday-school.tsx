import { SundaySchoolType } from 'app/types'
import React from 'react'
import { Paragraph, YStack } from '@my/ui'
import { Section } from 'app/features/newsletter/Section'

export type NextSundaySchoolProps = {
  event: SundaySchoolType
}
export const NextSundaySchool: React.FC<NextSundaySchoolProps> = ({ event }) => {
  if (!event.Refreshments) {
    return (
      <YStack borderTopColor={'$grey1Dark'} borderWidth={1} borderTopWidth={2} padding={'1rem'}>
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>No Sunday School this week</Paragraph>
      </YStack>
    )
  }
  return (
    <Section>
      <Paragraph size={'$5'} fontWeight={600}>
        {event.Date.toString()}
      </Paragraph>
      <Paragraph size={'$5'} fontWeight={600}>
        Sunday School starts at 9:30am
      </Paragraph>
      <Paragraph>Refreshments provided by: {event.Refreshments}</Paragraph>
    </Section>
  )
}
