import { Wrapper } from 'app/provider/wrapper'
import React from 'react'
import { Button, Paragraph, Separator, YStack } from '@my/ui'
import { useRouter } from 'solito/navigation'
import { StudyWeekend2024 } from 'app/features/events/study-weekend-2024'

type EventProps = {
  eventId?: string | string[]
}
export const Events: React.FC<EventProps> = ({ eventId }) => {
  switch (eventId) {
    case 'study-weekend-2024':
      return <StudyWeekend2024 />
    default:
      return <EventNotFound />
  }
}

export const EventNotFound = () => {
  const router = useRouter()

  return (
    <Wrapper subHheader={'Events hosted by Toronto East'}>
      <YStack>
        <Paragraph color={'red'}>The event you were looking for was not found. </Paragraph>
        <Separator />
        <Paragraph>Events hosted by the Toronto East Christadelphians</Paragraph>
        <Paragraph>
          <Button size="$2" onPress={() => router.push('/events/study-weekend-2024')} chromeless>
            Toronto East Study Weekend
          </Button>
        </Paragraph>
      </YStack>
    </Wrapper>
  )
}
