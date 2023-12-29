import React, { useState } from 'react'
import { Stack, YStack } from 'tamagui'
import { ListNavigation, ListNavigationText, ScrollView } from '@my/ui'
import { Memorial } from 'app/features/schedules/memorial'
import { SundaySchool } from 'app/features/schedules/sunday-school'
import { BibleClass } from 'app/features/schedules/bible-class'
import { ErrorNotFound } from 'app/provider/error-not-found'
import { Wrapper } from 'app/provider/wrapper'

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
    const url = `${process.env.NEXT_PUBLIC_API_PATH}api/google-sheets?sheet=${value}`
    const rawSchedule = await fetch(url, { cache: 'reload' })
    const program = await rawSchedule.json()
    setSchedule(program)
  }

  const updateHeight = (w, h) => {
    console.log('new width, height', { w, h })
    setScrollHeight(h)
  }

  return (
    <Wrapper subHheader={'Ecclesial Programs'}>
      {googleSheets ? (
        <YStack>
          {Object.keys(googleSheets).map((value: string, index: number) => {
            console.log('toggle', { value, currentSchedule })
            return googleSheets[value] && googleSheets[value].key ? (
              <ListNavigation
                key={index}
                onPress={() => handleSchedules(value)}
                styles={
                  value === currentSchedule
                    ? {
                        backgroundColor: '$blue12Light',
                        color: '$blue1Light',
                      }
                    : {}
                }
              >
                <ListNavigationText>{googleSheets[value].name}</ListNavigationText>
              </ListNavigation>
            ) : (
              <ErrorNotFound message={`Unable to find the Schedule for ${value}`} />
            )
          })}
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
