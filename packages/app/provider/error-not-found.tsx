import React from 'react'
import { Stack } from 'tamagui'
import { Text } from '@my/ui'

type ErrorNotFoundType = {
  message: string
}

export const ErrorNotFound: React.FC<ErrorNotFoundType> = ({ message }) => {
  return (
    <Stack borderStyle={'solid'} borderColor={'red'}>
      <Text>We've run into some trouble</Text>
      <Text>{message}</Text>
    </Stack>
  )
}
