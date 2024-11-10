import React from 'react'
import { XStack, YStack } from 'tamagui'
import { TableBody, TableHead, Text } from '@my/ui'
import { monthDay } from '@my/app/provider/date-utils'
import { SundaySchoolType } from '@my/app/types'

export const SundaySchool: React.FC<{
  schedule: SundaySchoolType[]
}> = ({ schedule }) => {
  const today = new Date()
  return (
    <YStack>
      <YStack
        key={'header'}
        borderColor={'lightgrey'}
        borderWidth={1}
        backgroundColor={'cornflowerblue'}
      >
        <XStack padding={'$2'}>
          <TableHead>Date</TableHead>
          <TableHead>Refreshments</TableHead>
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
        const bgColour = past ? '$gray12Dark' : '$gray2Light'
        return (
          <YStack
            key={index}
            borderColor={'$gray3Dark'}
            borderWidth={1}
            backgroundColor={'$gray9Dark'}
          >
            <XStack padding={'$2'}>
              <TableBody past={past}>{monthDay(date)}</TableBody>
              <TableBody past={past}>{service.Refreshments}</TableBody>
            </XStack>
            {service['Holidays and Special Events'] && (
              <XStack padding={'$2'}>
                <YStack flex={6}>
                  <Text fontStyle={'normal'} color={bgColour}>
                    {service['Holidays and Special Events']}
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
