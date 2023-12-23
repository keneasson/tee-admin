import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { Text } from '@my/ui'
import { BibleClassType } from 'app/features/schedules/schedules-screen'
import { monthDay } from 'app/provider/date-utils'

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
        const bgColour = date < today ? '#ccc6c6' : 'white'

        return (
          <YStack key={index} borderColor={'lightGrey'} borderWidth={1} backgroundColor={bgColour}>
            <XStack padding={'$2'}>
              <View flex={1} flexBasis={0}>
                <Text fontStyle={'normal'}>{monthDay(date)}</Text>
              </View>
              <View flex={1} flexBasis={0}>
                <Text>{service.Presider}</Text>
              </View>
              <View flex={1} flexBasis={0}>
                <Text>{service.Speaker}</Text>
              </View>
            </XStack>
            <XStack padding={'$2'}>
              <YStack flex={3}>
                <Text>{service.Topic}</Text>
              </YStack>
            </XStack>
          </YStack>
        )
      })}
    </YStack>
  )
}
