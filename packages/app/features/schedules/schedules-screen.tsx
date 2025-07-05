'use client'

import React, { useState } from 'react'
import { Stack, Text, YStack, useThemeName } from 'tamagui'
import { ListNavigation, ListNavigationText, ScrollView } from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { Memorial } from '@my/app/features/schedules/memorial'
import { SundaySchool } from '@my/app/features/schedules/sunday-school'
import { BibleClass } from '@my/app/features/schedules/bible-class'
import { ErrorNotFound } from '@my/app/provider/error-not-found'
import { Wrapper } from '@my/app/provider/wrapper'
import type {
  BibleClassType,
  CycType,
  GoogleSheets,
  MemorialServiceType,
  ProgramTypeKeys,
  ProgramTypes,
  SundaySchoolType,
} from '@my/app/types'
import { Loading } from '@my/app/provider/loading'
import { Cyc } from '@my/app/features/schedules/cyc'
import { getGoogleSheet } from '@my/app/provider/get-google-sheet'
import { getData } from '@my/app/provider/get-data'
import { useHydrated } from '@my/app/hooks/use-hydrated'

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
  const isHydrated = useHydrated()
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const handleSchedules = async (scheduleKey: string) => {
    setCurrentSchedule(scheduleKey)
    const program =
      scheduleKey === 'cyc' ? await getData(scheduleKey) : await getGoogleSheet(scheduleKey)
    setSchedule(program)
  }

  const allSchedules = googleSheets

  // Don't render until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <Wrapper subHeader={'Ecclesial Programs'}>
        <Loading />
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader={'Ecclesial Programs'}>
      {allSchedules ? (
        <YStack>
          {Object.keys(allSchedules)
            .filter((serviceType) => allSchedules[serviceType].name !== 'Directory')
            .map((serviceType: string, index: number) => {
              return allSchedules[serviceType] && allSchedules[serviceType].key ? (
                <ListNavigation
                  key={index}
                  onPress={() => handleSchedules(serviceType)}
                  styles={
                    serviceType === currentSchedule
                      ? {
                          backgroundColor: colors.primary,
                        }
                      : {
                          backgroundColor: 'transparent',
                        }
                  }
                  hoverStyle={
                    serviceType === currentSchedule
                      ? {
                          backgroundColor: colors.primaryHover,
                        }
                      : {
                          backgroundColor: colors.backgroundSecondary,
                        }
                  }
                >
                  <Text 
                    color={serviceType === currentSchedule ? colors.primaryForeground : colors.textPrimary}
                    fontWeight={serviceType === currentSchedule ? '600' : '400'}
                    hoverStyle={{
                      color: serviceType === currentSchedule ? colors.primary : colors.textSecondary,
                    }}
                  >
                    {allSchedules[serviceType].name}
                  </Text>
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
