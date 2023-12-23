import { Text, YStack } from '@my/ui'
import React from 'react'
import { TextLink } from 'solito/link'
import { Banner } from 'app/features/banner'

export function HomeScreen() {
  return (
    <YStack fullscreen paddingHorizontal={'$2'}>
      <Banner />
      <YStack space={'$4'}>
        <TextLink href="/newsletter">
          <Text>Create Newsletter</Text>
        </TextLink>
        <TextLink href="/schedule">
          <Text>View Schedule</Text>
        </TextLink>
      </YStack>
    </YStack>
  )
}
