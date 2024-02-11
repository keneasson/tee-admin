import React from 'react'
import { Heading, Text, XStack, YStack } from '@my/ui'
import { DailyReadingsType } from 'app/types'
import { color } from '@tamagui/themes'

export const DailyReadings: React.FC<DailyReadingsType> = ({ readings }) => {
  return (
    <>
      <Heading size={5}>Daily Bible Reading Planner</Heading>
      <YStack
        borderTopColor={'$grey1Dark'}
        borderWidth={1}
        borderTopWidth={2}
        padding={'1rem'}
        maxWidth={800}
        rowGap={2}
      >
        {readings.map((dailyReadings, index1) => {
          return Object.entries(dailyReadings).map(([date, reading]) => {
            const rowColor = index1 % 2 ? color.blue2Light : color.blue4Light
            return (
              <XStack key={index1} flex={1} gap={2} rowGap={2} backgroundColor={rowColor}>
                <Column>{date}</Column>
                {reading.map((passage) => (
                  <Column>{passage}</Column>
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
      <Text color={color.yellow12Light} padding={'$2'}>
        {children}
      </Text>
    </YStack>
  )
}
