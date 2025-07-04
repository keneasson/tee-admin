import React from 'react'
import { View, XStack, YStack } from 'tamagui'
import { Paragraph, TableBody, TableHead, Text } from '@my/ui'
import { monthDay } from '@my/app/provider/date-utils'
import { MemorialServiceType } from '@my/app/types'

export const Memorial: React.FC<{
  schedule: MemorialServiceType[]
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
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Preside</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Exhort</Text>
          </View>
          <View flex={1} flexBasis={0}>
            <Text fontWeight={'bold'}>Organist</Text>
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
      {schedule.map((service: MemorialServiceType, index) => {
        const date = new Date(service.Date)
        const past = date < today
        const bgColour = past ? '$gray9Dark' : '$gray1Light'

        return (
          <YStack
            key={index}
            borderColor={'$gray3Light'}
            borderWidth={1}
            backgroundColor={bgColour}
          >
            <XStack padding={'$2'}>
              <TableBody past={past}>{monthDay(date)}</TableBody>
              <TableBody past={past}>{service.Preside || '-'}</TableBody>
              <TableBody past={past}>{service.Exhort || '-'}</TableBody>
              <TableBody past={past}>{service.Organist || '-'}</TableBody>
              <TableBody past={past}>{service.Steward || '-'}</TableBody>
              <TableBody past={past}>{service.Doorkeeper || '-'}</TableBody>
            </XStack>
            {(service.Lunch || service.Activities) && (
              <XStack padding={'$2'}>
                <YStack flex={6}>
                  {service.Lunch && (
                    <Paragraph fontStyle={'normal'} color={past ? '$gray12Dark' : '$gray2Dark'}>
                      Lunch will be held at the hall
                    </Paragraph>
                  )}
                  {service.Activities && (
                    <Paragraph fontStyle={'normal'} color={past ? '$gray12Dark' : '$gray2Dark'}>
                      {service.Activities || ''}
                    </Paragraph>
                  )}
                </YStack>
              </XStack>
            )}
          </YStack>
        )
      })}
    </YStack>
  )
}
