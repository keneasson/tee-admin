import React from 'react'
import { Heading, Text, XStack, YStack } from '@my/ui'
import { DailyReadingsType } from 'app/types'
import { color } from '@tamagui/themes'

export const DailyReadings: React.FC<DailyReadingsType> = ({ readings }) => {
  return (
    <>
      <Heading size={5}>Daily Bible Reading Planner</Heading>
      <YStack
        borderTopColor="$gray1Dark"
        borderWidth={1}
        borderTopWidth={2}
        padding="$1"
        maxWidth={800}
        rowGap={2}
      >
        {readings.map((dailyReadings, index1) => {
          return Object.entries(dailyReadings).map(([date, reading]) => {
            const rowColor = index1 % 2 ? color.blue1Light : color.blue3Light
            return (
              <XStack key={index1} flex={1} gap={2} rowGap={2} backgroundColor={rowColor}>
                <Column>{date}</Column>
                {reading.map((passage, index2) => (
                  <Column key={index2}>{passage}</Column>
                ))}
              </XStack>
            )
          })
        })}
      </YStack>
    </>
  )
}

type ColumnProps = {
  children: React.ReactNode
}
export const Column: React.FC<ColumnProps> = ({ children }) => {
  return (
    <YStack flex={1} width={'25%'}>
      <Text color={'$yellow12Light'} padding={'$2'}>
        {children}
      </Text>
    </YStack>
  )
}
