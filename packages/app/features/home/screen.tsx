import React from 'react'
import { Paragraph, Text, YStack } from '@my/ui'
import { TextLink } from 'solito/link'
import { Wrapper } from 'app/provider/wrapper'

export function HomeScreen() {
  return (
    <Wrapper>
      <YStack space={'$4'}>
        <Paragraph>Welcome to Toronto East Assistant.</Paragraph>
        <Paragraph>
          Here, you can view the Newsletter which includes all events and news for the next two
          weeks.
        </Paragraph>
        <TextLink href="/newsletter" color={'blue'}>
          <Text color={'blue'} fontWeight={'bold'}>
            View Newsletter
          </Text>
        </TextLink>
        <Paragraph>You can also view full annual schedules.</Paragraph>
        <TextLink href="/schedule">
          <Text color={'blue'} fontWeight={'bold'}>
            View Schedule
          </Text>
        </TextLink>
      </YStack>
    </Wrapper>
  )
}
