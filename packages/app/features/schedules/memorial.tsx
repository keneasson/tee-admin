import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { TableBody, Text } from '@my/ui'
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
              <TableBody past={past}>{service.Preside}</TableBody>
              <TableBody past={past}>{service.Exhort}</TableBody>
              <TableBody past={past}>{service.Steward}</TableBody>
              <TableBody past={past}>{service.Doorkeeper}</TableBody>
            </XStack>
            {service['Fellowship Lunches / Activities'] && (
              <XStack padding={'$2'}>
                <YStack flex={6}>
                  <Text fontStyle={'normal'} color={past ? '$gray12Dark' : '$grey2Dark'}>
                    {service['Fellowship Lunches / Activities']}
                  </Text>
                </YStack>
              </XStack>
            )}
          </YStack>
        )
      })}
    </YStack>
  )
}
