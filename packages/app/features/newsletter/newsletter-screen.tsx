import React, { useEffect, useState } from 'react'
import { Wrapper } from 'app/provider/wrapper'
import { Heading, YStack } from '@my/ui'
import { ProgramTypes } from 'app/types'
import { Loading } from 'app/provider/loading'
import { NextBibleClass } from 'app/features/newsletter/bible-class'
import { NextSundaySchool } from 'app/features/newsletter/sunday-school'
import { NextMemorial } from 'app/features/newsletter/memorial'
import { fetchUpcoming } from 'app/features/newsletter/fetch-upcoming'
import { fetchReadings } from 'app/features/newsletter/readings/fetch-readings'
import { DailyReadings } from 'app/features/newsletter/readings/daily-readings'

const days15 = 15

export const NewsletterScreen: React.FC = () => {
  const [program, setProgram] = useState<ProgramTypes[] | false>(false)
  const [readings, setReadings] = useState<[] | false>(false)

  useEffect(() => {
    Promise.all([fetchUpcoming().then(setProgram), fetchReadings().then(setReadings)]).catch(
      (error) => console.log('error fetching data', error)
    )
  }, [])

  const resumeAfter = new Date()
  resumeAfter.setDate(resumeAfter.getDate() + days15)

  if (!program) return <Loading />

  let lastEventDate = 0
  const checkForSameDayEvents = (date: Date): boolean => {
    const month = date.getDate()
    const day = date.getDay()
    const currentDate = parseInt(`${month}${day}`)
    if (currentDate === lastEventDate) {
      return true
    }
    lastEventDate = currentDate
    return false
  }

  return (
    <Wrapper subHheader={'Newsletter'}>
      <YStack>
        <Heading size={5}>Regular Services</Heading>
        {program.map((event: ProgramTypes, index) => {
          const thisEventDate = new Date(event.Date)
          const checkSameDay = checkForSameDayEvents(thisEventDate)
          return (
            <YStack key={index}>
              {event.Key === 'sundaySchool' && <NextSundaySchool event={event} />}
              {event.Key === 'memorial' && <NextMemorial event={event} isSameDay={checkSameDay} />}
              {event.Key === 'bibleClass' && <NextBibleClass event={event} />}
            </YStack>
          )
        })}
        {readings && <DailyReadings readings={readings} />}
      </YStack>
    </Wrapper>
  )
}
