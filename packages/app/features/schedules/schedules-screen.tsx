import React, { useState } from 'react'
import { Stack, YStack } from 'tamagui'
import { ListNavigation, ListNavigationText, ScrollView } from '@my/ui'
import { Memorial } from 'app/features/schedules/memorial'
import { SundaySchool } from 'app/features/schedules/sunday-school'
import { BibleClass } from 'app/features/schedules/bible-class'
import { ErrorNotFound } from 'app/provider/error-not-found'
import { Wrapper } from 'app/provider/wrapper'
import type {
  BibleClassType,
  GoogleSheets,
  MemorialServiceType,
  ProgramTypeKeys,
  ProgramTypes,
  SundaySchoolType,
} from 'app/types'
import { Loading } from 'app/provider/loading'

type Program = {
  title: string
  type: ProgramTypeKeys
  content: ProgramTypes[]
}

/**
 *
 * @param googleSheets the available schedules defined in the JSON data.
 * @constructor
 * @todo better height setting for the Scrollable view.
 */
export const SchedulesScreen: React.FC<{
  googleSheets: GoogleSheets
}> = ({ googleSheets }) => {
  const [schedule, setSchedule] = useState<Program>()
  const [currentSchedule, setCurrentSchedule] = useState<string>()

  const handleSchedules = async (scheduleKey) => {
    setCurrentSchedule(scheduleKey)
    const url = `${process.env.NEXT_PUBLIC_API_PATH}api/google-sheets?sheet=${scheduleKey}`
    const rawSchedule = await fetch(url, { next: { revalidate: 3600 } })
    const program = await rawSchedule.json()
    setSchedule(program)
  }

  return (
    <Wrapper subHheader={'Ecclesial Programs'}>
      {googleSheets ? (
        <YStack>
          {Object.keys(googleSheets).map((serviceType: string, index: number) => {
            return googleSheets[serviceType] && googleSheets[serviceType].key ? (
              <ListNavigation
                key={index}
                onPress={() => handleSchedules(serviceType)}
                styles={
                  serviceType === currentSchedule
                    ? {
                        backgroundColor: '$blue12Light',
                        color: '$blue1Light',
                      }
                    : {}
                }
              >
                <ListNavigationText>{googleSheets[serviceType].name}</ListNavigationText>
              </ListNavigation>
            ) : (
              <ErrorNotFound message={`Unable to find the Schedule for ${serviceType}`} />
            )
          })}
        </YStack>
      ) : (
        <ErrorNotFound message="No Schedules Found"></ErrorNotFound>
      )}
      {currentSchedule && !schedule ? (
        <Loading />
      ) : (
        <ScrollView>
          <Stack flex={1} paddingBottom={400}>
            {schedule?.content && schedule.type === 'memorial' && (
              <Memorial schedule={schedule.content as MemorialServiceType[]} />
            )}
            {schedule?.content && schedule.type === 'sundaySchool' && (
              <SundaySchool schedule={schedule.content as SundaySchoolType[]} />
            )}
            {schedule?.content && schedule.type === 'bibleClass' && (
              <BibleClass schedule={schedule.content as BibleClassType[]} />
            )}
          </Stack>
        </ScrollView>
      )}
    </Wrapper>
  )
}
