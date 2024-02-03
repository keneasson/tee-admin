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
  CycType,
  GoogleSheets,
  MemorialServiceType,
  ProgramTypeKeys,
  ProgramTypes,
  SundaySchoolType,
} from 'app/types'
import { Loading } from 'app/provider/loading'
import { Cyc } from 'app/features/schedules/cyc'
import { getGoogleSheet } from 'app/provider/get-google-sheet'
import { getData } from 'app/provider/get-data'

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
    const program =
      scheduleKey === 'cyc' ? await getData(scheduleKey) : await getGoogleSheet(scheduleKey)
    setSchedule(program)
  }

  const allSchedules = {
    ...googleSheets,
    cyc: {
      name: 'Toronto CYC',
      key: 'cyc',
    },
  }

  return (
    <Wrapper subHheader={'Ecclesial Programs'}>
      {allSchedules ? (
        <YStack>
          {Object.keys(allSchedules).map((serviceType: string, index: number) => {
            return allSchedules[serviceType] && allSchedules[serviceType].key ? (
              <ListNavigation
                key={index}
                onPress={() => handleSchedules(serviceType)}
                styles={
                  serviceType === currentSchedule
                    ? {
                        backgroundColor: '$blue12Light',
                        color: '$blue1Light',
                      }
                    : {
                        backgroundColor: '$blue1Light',
                        color: '$blue12Light',
                      }
                }
              >
                <ListNavigationText
                  style={
                    serviceType === currentSchedule
                      ? {
                          color: '$blue1Light',
                        }
                      : {
                          color: '$blue12Light',
                        }
                  }
                >
                  {allSchedules[serviceType].name}
                </ListNavigationText>
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
            {schedule?.content && schedule.type === 'cyc' && (
              <Cyc schedule={schedule.content as CycType[]} />
            )}
          </Stack>
        </ScrollView>
      )}
    </Wrapper>
  )
}
