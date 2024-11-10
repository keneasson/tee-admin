import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { TableBody, Text } from '@my/ui'
import { monthDay } from '@my/app/provider/date-utils'
import { CycType } from '@my/app/types'

export const Cyc: React.FC<{
  schedule: CycType[]
}> = ({ schedule }) => {
  const NOW = new Date()

  return (
    <YStack>
      <YStack
        key={'header'}
        borderColor={'lightGrey'}
        borderWidth={1}
        backgroundColor={'cornflowerblue'}
      >
        <XStack padding={'$2'}>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Date</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Speaker</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Topic</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Location</Text>
          </View>
        </XStack>
      </YStack>
      {schedule.map((service: CycType, index) => {
        const eventDate = new Date(service.Date)
        const past = eventDate < NOW
        const bgColour = past ? '$gray9Dark' : '$gray0Light'
        if (service.type === 'special') {
          return (
            <XStack
              padding={'$2'}
              key={index}
              borderColor={'$grey3light'}
              borderWidth={1}
              backgroundColor={bgColour}
            >
              <TableBody past={past}>{monthDay(eventDate)}</TableBody>
              <TableBody past={past}>{service.event}</TableBody>
            </XStack>
          )
        }

        return (
          <XStack
            padding={'$2'}
            key={index}
            borderColor={'$grey3light'}
            borderWidth={1}
            backgroundColor={bgColour}
          >
            <TableBody past={past}>
              {monthDay(eventDate)}
              {', '}
              {`${eventDate.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`}
            </TableBody>
            <TableBody past={past}>{service.speaker}</TableBody>
            <TableBody past={past}>{service.topic}</TableBody>
            <TableBody past={past}>{service.location}</TableBody>
          </XStack>
        )
      })}
    </YStack>
  )
}
