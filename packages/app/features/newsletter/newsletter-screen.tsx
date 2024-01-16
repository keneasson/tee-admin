import React, { useEffect, useState } from 'react'
import { Wrapper } from 'app/provider/wrapper'
import { Heading, YStack } from '@my/ui'
import { ProgramTypes } from 'app/types'
import { Loading } from 'app/provider/loading'
import { NextBibleClass } from 'app/features/newsletter/bible-class'
import { NextSundaySchool } from 'app/features/newsletter/sunday-school'
import { NextMemorial } from 'app/features/newsletter/memorial'
import Constants from 'expo-constants'

const days15 = 15

export const NewsletterScreen: React.FC = () => {
  const API_PATH =
    process.env.NEXT_PUBLIC_API_PATH || Constants?.expoConfig?.extra?.EXPO_PUBLIC_API_PATH
  console.log('env', API_PATH)

  const [program, setProgram] = useState<ProgramTypes[] | false>(false)
  const getUpcomingPrograms = async () => {
    const url = `${API_PATH}api/upcoming-program`
    const rawSchedule = await fetch(url, { next: { revalidate: 3600 } })
    const program = await rawSchedule.json()
    setProgram(program)
  }

  useEffect(() => {
    getUpcomingPrograms()
  }, [])

  const resumeAfter = new Date()
  resumeAfter.setDate(resumeAfter.getDate() + days15)

  if (!program) return <Loading />

  return (
    <Wrapper subHheader={'Upcoming Newsletter'}>
      <YStack>
        <YStack>
          <Heading size={'$8'}>Upcoming Events</Heading>
        </YStack>
        <YStack>
          {program.map((event: ProgramTypes, index) => {
            return (
              <YStack key={index}>
                {event.Key === 'sundaySchool' && <NextSundaySchool event={event} />}
                {event.Key === 'memorial' && <NextMemorial event={event} />}
                {event.Key === 'bibleClass' && <NextBibleClass event={event} />}
              </YStack>
            )
          })}
        </YStack>
      </YStack>
    </Wrapper>
  )
}
