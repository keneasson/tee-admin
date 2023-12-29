import { Text, YStack } from '@my/ui'
import React from 'react'
import { TextLink } from 'solito/link'
import { Wrapper } from 'app/provider/wrapper'

export function HomeScreen() {
  return (
    <Wrapper>
      <YStack space={'$4'}>
        <TextLink href="/newsletter">
          <Text>Create Newsletter</Text>
        </TextLink>
        <TextLink href="/schedule">
          <Text>View Schedule</Text>
        </TextLink>
      </YStack>
    </Wrapper>
  )
}
