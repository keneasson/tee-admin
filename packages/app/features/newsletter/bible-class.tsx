import React from 'react'
import { Paragraph, Text, YStack } from '@my/ui'

import { BibleClassType } from 'app/types'

type NextBibleClassProps = {
  event: BibleClassType
}
export const NextBibleClass: React.FC<NextBibleClassProps> = ({ event }) => {
  if (!event.Speaker) {
    return (
      <YStack
        borderTopColor={'$grey8Dark'}
        borderWidth={1}
        borderBottomColor={'$grey1Dark'}
        borderBottomWidth={2}
        marginBottom={'2rem'}
        padding={'1rem'}
      >
        <Paragraph size={'$5'} fontWeight={600}>
          {event.Date.toString()}
        </Paragraph>
        <Paragraph>{event.Topic}</Paragraph>
      </YStack>
    )
  }
  return (
    <YStack
      borderTopColor={'$grey8Dark'}
      borderWidth={1}
      borderBottomColor={'$grey1Dark'}
      borderBottomWidth={2}
      marginBottom={'2rem'}
      padding={'1rem'}
    >
      <Paragraph size={'$5'} fontWeight={600}>
        {event.Date.toString()}
      </Paragraph>
      <Paragraph size={'$5'} fontWeight={600}>
        Bible Class at 7:30pm
      </Paragraph>
      <Paragraph>
        <Text fontWeight={600}>Presiding:</Text> {event.Presider}
      </Paragraph>
      <Paragraph>
        <Text fontWeight={600}>Leader:</Text> {event.Speaker}
      </Paragraph>
      {/*<Paragraph><Text fontWeight={600}>Organist</Text> {event.Organist}</Paragraph>*/}
      {event.Topic && <Paragraph fontWeight={600}>{event.Topic}</Paragraph>}
    </YStack>
  )
}
