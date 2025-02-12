'use client'
import React, { useEffect, useState } from 'react'
import { Wrapper } from '@my/app/provider/wrapper'
import { Heading, YStack } from '@my/ui'
import { ProgramTypes } from '@my/app/types'
import { Loading } from '@my/app/provider/loading'
import { NextBibleClass } from '@my/app/features/newsletter/bible-class'
import { NextSundaySchool } from '@my/app/features/newsletter/sunday-school'
import { NextMemorial } from '@my/app/features/newsletter/memorial'
import { fetchUpcoming } from '@my/app/features/newsletter/fetch-upcoming'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'
import { DailyReadings } from '@my/app/features/newsletter/readings/daily-readings'

const days15 = 15

export const NewsletterScreen: React.FC = () => {
  const [program, setProgram] = useState<ProgramTypes[] | false>(false)
  const [readings, setReadings] = useState<[] | false>(false)

  useEffect(() => {
    console.log('in useEffect', { program, readings })
    Promise.all([fetchUpcoming({}).then(setProgram), fetchReadings().then(setReadings)]).catch(
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
