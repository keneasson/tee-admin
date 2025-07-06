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
              <TableBody past={past}>{date && !isNaN(date.getTime()) ? monthDay(date) : '-'}</TableBody>
              <TableBody past={past}>{(service.Preside && service.Preside.trim()) || '-'}</TableBody>
              <TableBody past={past}>{(service.Exhort && service.Exhort.trim()) || '-'}</TableBody>
              <TableBody past={past}>{(service.Organist && service.Organist.trim()) || '-'}</TableBody>
              <TableBody past={past}>{(service.Steward && service.Steward.trim()) || '-'}</TableBody>
              <TableBody past={past}>{(service.Doorkeeper && service.Doorkeeper.trim()) || '-'}</TableBody>
            </XStack>
            {((service.Lunch && service.Lunch.trim()) || (service.Activities && service.Activities.trim())) ? (
              <XStack padding={'$2'}>
                <YStack flex={6}>
                  {service.Lunch && service.Lunch.trim() ? (
                    <Paragraph fontStyle={'normal'} color={past ? '$gray12Dark' : '$gray2Dark'}>
                      Lunch will be held at the hall
                    </Paragraph>
                  ) : null}
                  {service.Activities && service.Activities.trim() ? (
                    <Paragraph fontStyle={'normal'} color={past ? '$gray12Dark' : '$gray2Dark'}>
                      {service.Activities.trim()}
                    </Paragraph>
                  ) : null}
                </YStack>
              </XStack>
            ) : null}
          </YStack>
        )
      })}
    </YStack>
  )
}
