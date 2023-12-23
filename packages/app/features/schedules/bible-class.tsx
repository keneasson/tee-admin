import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { Text } from '@my/ui'
import { BibleClassType } from 'app/features/schedules/schedules-screen'

export const BibleClass: React.FC<{
  schedule: BibleClassType[]
}> = ({ schedule }) => {
  const today = new Date()

  return (
    <YStack>
      {schedule.map((service: BibleClassType, index) => {
        const date = new Date(service.Date)
        const bgColour = date < today ? '#ccc6c6' : 'white'

        return (
          <YStack key={index} borderColor={'lightGrey'} borderWidth={1} backgroundColor={bgColour}>
            <XStack padding={'$2'}>
              <View flex={1} flexBasis={0}>
                <Text fontStyle={'normal'}>{`${date.toLocaleString('default', {
                  month: 'short',
                })} ${date.getDate()}`}</Text>
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
