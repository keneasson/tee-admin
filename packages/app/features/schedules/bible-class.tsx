import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { TableBody, Text } from '@my/ui'
import { monthDay } from '@my/app/provider/date-utils'
import { BibleClassType } from '@my/app/types'

export const BibleClass: React.FC<{
  schedule: BibleClassType[]
}> = ({ schedule }) => {
  const today = new Date()

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
            <Text fontWeight={'bold'}>Presider</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Speaker</Text>
          </View>
        </XStack>
        <XStack padding={'$2'}>
          <YStack flex={3}>
            <Text>Topic</Text>
          </YStack>
        </XStack>
      </YStack>
      {schedule.map((service: BibleClassType, index) => {
        const date = new Date(service.Date)
        const past = date < today
        const bgColour = past ? '$gray9Dark' : '$gray0Light'

        return (
          <YStack
            key={index}
            borderColor={'$grey3light'}
            borderWidth={1}
            backgroundColor={bgColour}
          >
            <XStack padding={'$2'}>
              <TableBody past={past}>{monthDay(date)}</TableBody>
              <TableBody past={past}>{service.Presider || '-'}</TableBody>
              <TableBody past={past}>{service.Speaker || '-'}</TableBody>
            </XStack>
            <XStack padding={'$2'}>
              <YStack flex={3}>
                <Text fontStyle={'normal'} color={past ? '$gray12Dark' : '$gray2Dark'}>
                  {service.Topic || '-'}
                </Text>
              </YStack>
            </XStack>
          </YStack>
        )
      })}
    </YStack>
  )
}
