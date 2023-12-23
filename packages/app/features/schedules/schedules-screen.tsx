import React, { ReactNode, useState } from 'react'
import { SafeAreaView } from 'react-native'
import { Stack, YStack } from 'tamagui'
import { ListNavigation, ScrollView, Text } from '@my/ui'
import { Memorial } from 'app/features/schedules/memorial'
import { SundaySchool } from 'app/features/schedules/sunday-school'
import { Banner } from '../banner'
import { BibleClass } from 'app/features/schedules/bible-class'

type GoogleSheets = Record<
  'memorial' | 'sundaySchool' | 'bibleClass',
  {
    name: string
    key: string
  }
>

export type MemorialService = {
  Date: string
  Preside: string
  Exhort: string
  Steward: string
  Doorkeeper: string
  'Fellowship Lunches / Activities'?: string
}

export type SundaySchoolType = {
  Date: string
  'Holidays and Special Events': string
  Refreshments: string
}

export type BibleClassType = {
  Date: string
  Presider: string
  Speaker: string
  Topic: string
}

type ProgramTypes = MemorialService | SundaySchoolType | BibleClassType

type Program = {
  title: string
  type: 'memorial' | 'sundaySchool' | 'bibleClass'
  content: ProgramTypes[]
}

export const SchedulesScreen: React.FC<{
  googleSheets: GoogleSheets
}> = ({ googleSheets }) => {
  const [schedule, setSchedule] = useState<Program>()
  const [currentSchedule, setCurrentSchedule] = useState<string>()
  const [scrollHeight, setScrollHeight] = useState<number>(100)

  const handleSchedules = async (value) => {
    setCurrentSchedule(value)
    const url = 'http://192.168.2.249:3001/api/google-sheets?sheet=' + value
    const rawSchedule = await fetch(url, { cache: 'reload' })
    const program = await rawSchedule.json()
    setSchedule(program)
  }

  const updateHeight = (w, h) => {
    console.log('new width, height', { w, h })
    setScrollHeight(h)
  }

  return (
    <Wrapper>
      {googleSheets ? (
        <YStack>
          {Object.keys(googleSheets).map((value: string, index: number) =>
            googleSheets[value] && googleSheets[value].key ? (
              <ListNavigation
                key={index}
                onPress={() => handleSchedules(value)}
                styles={{
                  backgroundColor:
                    currentSchedule && currentSchedule === value ? 'blue' : 'transparent',
                }}
              >
                <Text color={currentSchedule && currentSchedule === value ? 'white' : 'black'}>
                  {googleSheets[value].name}
                </Text>
              </ListNavigation>
            ) : (
              <ErrorNotFound message={`Unable to find the Schedule for ${value}`} />
            )
          )}
        </YStack>
      ) : (
        <ErrorNotFound message="No Schedules Found"></ErrorNotFound>
      )}
      <ScrollView>
        <Stack flex={1} paddingBottom={400}>
          {schedule?.content && schedule.type === 'memorial' && (
            <Memorial schedule={schedule.content as MemorialService[]} />
          )}
          {schedule?.content && schedule.type === 'sundaySchool' && (
            <SundaySchool schedule={schedule.content as SundaySchoolType[]} />
          )}
          {schedule?.content && schedule.type === 'bibleClass' && (
            <BibleClass schedule={schedule.content as BibleClassType[]} />
          )}
        </Stack>
      </ScrollView>
    </Wrapper>
  )
}

const Wrapper: React.FC<{
  children: ReactNode
}> = ({ children }) => {
  return (
    <SafeAreaView style={{ height: '100%' }}>
      <YStack fullscreen paddingHorizontal={'$1'}>
        <YStack>
          <Banner pageTitle={'Manage Schedules'} />
          {children}
        </YStack>
      </YStack>
    </SafeAreaView>
  )
}

const ErrorNotFound: React.FC<{
  message: string
}> = ({ message }) => {
  return (
    <Stack borderStyle={'solid'} borderColor={'red'}>
      <Text>We've run into some trouble</Text>
      <Text>{message}</Text>
    </Stack>
  )
}
