import React from 'react'
import { Wrapper } from 'app/provider/wrapper'
import { Text, XStack } from '@my/ui'

export const NewsletterScreen: React.FC = () => {
  return (
    <Wrapper subHheader={'Upcoming Newsletter'}>
      <XStack>
        <Text>Next Weeks Schedule</Text>
      </XStack>
    </Wrapper>
  )
}
