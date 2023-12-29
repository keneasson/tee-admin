import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { TableBody, Text } from '@my/ui'
import { SundaySchoolType } from 'app/features/schedules/schedules-screen'
import { monthDay } from 'app/provider/date-utils'

export const SundaySchool: React.FC<{
  schedule: SundaySchoolType[]
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
            <Text fontWeight={'bold'}>Refreshments</Text>
          </View>
        </XStack>
        <XStack padding={'$2'}>
          <YStack flex={6}>
            <Text fontWeight={'bold'}>Holidays and Special Events</Text>
          </YStack>
        </XStack>
      </YStack>
      {schedule.map((service: SundaySchoolType, index) => {
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
              <TableBody past={past}>{service.Refreshments}</TableBody>
            </XStack>
            {service['Holidays and Special Events'] && (
              <XStack padding={'$2'}>
                <YStack flex={6}>
                  <Text>{service['Holidays and Special Events']}</Text>
                </YStack>
              </XStack>
            )}
          </YStack>
        )
      })}
    </YStack>
  )
}
