import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { Text } from '@my/ui'
import { MemorialService } from 'app/features/schedules/schedules-screen'
import { monthDay } from 'app/provider/date-utils'

export const Memorial: React.FC<{
  schedule: MemorialService[]
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
            <Text fontWeight={'bold'}>Preside</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Exhort</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Steward</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Doorkeeper</Text>
          </View>
        </XStack>
        <XStack padding={'$2'}>
          <YStack flex={6}>
            <Text fontWeight={'bold'}>Fellowship Lunches / Activities</Text>
          </YStack>
        </XStack>
      </YStack>
      {schedule.map((service: MemorialService, index) => {
        const date = new Date(service.Date)
        const bgColour = date < today ? '#ccc6c6' : 'white'

        return (
          <YStack key={index} borderColor={'lightGrey'} borderWidth={1} backgroundColor={bgColour}>
            <XStack padding={'$2'}>
              <View flex={1} flexBasis={0}>
                <Text>{monthDay(date)}</Text>
              </View>
              <View flex={1} flexBasis={0}>
                <Text>{service.Preside}</Text>
              </View>
              <View flex={1} flexBasis={0}>
                <Text>{service.Exhort}</Text>
              </View>
              <View flex={1} flexBasis={0}>
                <Text>{service.Steward}</Text>
              </View>
              <View flex={1} flexBasis={0}>
                <Text>{service.Doorkeeper}</Text>
              </View>
            </XStack>
            {service['Fellowship Lunches / Activities'] && (
              <XStack padding={'$2'}>
                <YStack flex={6}>
                  <Text>{service['Fellowship Lunches / Activities']}</Text>
                </YStack>
              </XStack>
            )}
          </YStack>
        )
      })}
    </YStack>
  )
}
