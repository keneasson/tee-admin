import React from 'react'
import { Spinner, YStack } from '@my/ui'

export const Loading: React.FC = () => {
  return (
    <YStack fullscreen display={'flex'} alignItems={'center'} justifyContent={'center'}>
      <Spinner size="$2" color="$orange10" />
    </YStack>
  )
}
