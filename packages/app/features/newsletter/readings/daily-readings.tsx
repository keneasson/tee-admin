import React from 'react'
import { Text, XStack, YStack } from '@my/ui'
import { DailyReadingsType } from '@my/app/types'

export const DailyReadings: React.FC<DailyReadingsType> = ({ readings }) => {
  return (
    <YStack
        borderColor="$borderColor"
        borderWidth={1}
        padding="$0"
        maxWidth={800}
        backgroundColor="$background"
        borderRadius="$4"
        overflow="hidden"
      >
        {readings.map((dailyReadings, index1) => {
          return Object.entries(dailyReadings).map(([date, reading], dateIndex) => {
            // Use overall index for consistent striping
            const rowIndex = index1 + dateIndex
            const isEvenRow = rowIndex % 2 === 0
            return (
              <XStack
                key={`${index1}-${dateIndex}`}
                flex={1}
                gap="$2"
                backgroundColor={isEvenRow ? '$background' : '$backgroundSecondary'}
                padding="$2"
                margin="$0"
              >
                <Column>{date}</Column>
                {reading.map((passage, index2) => (
                  <Column key={index2}>{passage}</Column>
                ))}
              </XStack>
            )
          })
        })}
      </YStack>
  )
}

type ColumnProps = {
  children: React.ReactNode
}
export const Column: React.FC<ColumnProps> = ({ children }) => {
  return (
    <YStack flex={1} width={'25%'}>
      <Text
        color="$textPrimary"
        padding="$2"
        fontFamily="$body"
        fontSize="$3"
      >
        {children}
      </Text>
    </YStack>
  )
}
