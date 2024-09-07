'use client'
import React from 'react'
import { Wrapper } from 'app/provider/wrapper'
import { Button, Heading, Paragraph } from '@my/ui'
import { useRouter } from 'solito/navigation'
import { StudyWeekend2024 } from 'app/features/events/study-weekend-2024'
import { XStack } from 'tamagui'
import { Section } from 'app/features/newsletter/Section'

type EventProps = {
  eventId?: string | string[]
}
export const Events: React.FC<EventProps> = ({ eventId }) => {
  if (!eventId) {
    return <EventListing />
  }
  switch (eventId) {
    case 'study-weekend-2024':
      return <StudyWeekend2024 />
    default:
      return <EventListing isNotFound={true} />
  }
}

type EventListingProps = {
  isNotFound?: boolean
}
export const EventListing: React.FC<EventListingProps> = ({ isNotFound }) => {
  const router = useRouter()

  return (
    <Wrapper subHheader={'Events hosted by Toronto East'}>
      {isNotFound && (
        <Section>
          <Paragraph color={'red'}>The event you were looking for was not found. </Paragraph>
        </Section>
      )}
      <Section>
        <Heading size={5}>Events hosted by the Toronto East Christadelphians</Heading>
        <XStack>
          <Button size="$2" onPress={() => router.push('/events/study-weekend-2024')} chromeless>
            Toronto East Study Weekend
          </Button>
        </XStack>
      </Section>
      {/*<Section>*/}
      {/*  <Heading size={5}>Other events of interest</Heading>*/}
      {/*  <XStack>*/}
      {/*    <Button*/}
      {/*      variant={'outlined'}*/}
      {/*      size="$2"*/}
      {/*      onPress={() => router.push('/events/lakefield-bible-school-2024')}*/}
      {/*      chromeless*/}
      {/*    >*/}
      {/*      Lakefield Christadelphian Bible School at Fleming*/}
      {/*    </Button>*/}
      {/*  </XStack>*/}
      {/*</Section>*/}
    </Wrapper>
  )
}

export const EventsFooter: React.FC = () => {
  const router = useRouter()
  return (
    <XStack>
      <Button onPress={() => router.push('/events')}>Back to Events</Button>
    </XStack>
  )
}
