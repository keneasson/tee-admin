import { get_upcoming_program } from 'next-app/utils/get-upcoming-program'
import { render } from '@react-email/render'
import SundaySchool from 'email-builder/emails/SundaySchool'
import {
  BibleClassType,
  MemorialServiceType,
  ProgramTypes,
  SundayEvents,
  SundaySchoolType,
} from '@my/app/types'
import { Event } from '@my/app/types/events'
import MemorialService from 'email-builder/emails/Memorial'
import Newsletter from 'email-builder/emails/Newsletter'
import { emailReasons } from './email-send'
import BibleClass from 'email-builder/emails/BibleClass'

function mergeSundayEvents(events: ProgramTypes[]): SundayEvents[] {
  const memorial = events.filter((e) => e.Key === 'memorial') as MemorialServiceType[]

  return memorial.reduce((acc, m) => {
    const date = m.Date
    const sundaySchool = events.find(
      (e) => e.Key === 'sundaySchool' && e.Date === date
    ) as SundaySchoolType
    return sundaySchool
      ? [
          ...acc,
          {
            ...m,
            Refreshments: sundaySchool.Refreshments,
            'Holidays and Special Events': sundaySchool['Holidays and Special Events'],
          },
        ]
      : [
          ...acc,
          {
            ...m,
            Refreshments: '',
            'Holidays and Special Events': 'Sunday School is in Recess',
          },
        ]
  }, [] as SundayEvents[])
}

// Data fetching functions for newsletter - call functions directly, not APIs
async function fetchEvents(): Promise<Event[]> {
  try {
    // Import the actual function that the /api/events/public route uses
    const { getPublishedEvents } = await import('@my/app/services/event-service')
    const events = await getPublishedEvents()
    return events
  } catch (error) {
    console.error('Failed to fetch events for newsletter:', error)
    return []
  }
}

async function fetchBibleReadings(): Promise<any[]> {
  try {
    // Import the actual function that the /api/json/range route uses
    const { default: dailyReadings } = await import('../../data/daily-readings.json')

    // Use the same logic as the API route
    const startRange = new Date()
    const endRange = new Date()
    const startMidnight = stripTime(startRange)
    endRange.setDate(endRange.getDate() + 7)
    const endMidnight = stripTime(endRange)

    const filteredReadings = dailyReadings.filter((row: any) => {
      const date = Object.keys(row)[0]
      const dateObj = new Date(`${date}, ${startMidnight.getUTCFullYear()}`)
      const dateOnly = stripTime(dateObj)
      return dateOnly >= startMidnight && dateOnly <= endMidnight
    })

    // Transform the data structure for the email template
    return filteredReadings.map((row: any) => {
      const dateKey = Object.keys(row)[0]
      const readings = row[dateKey]
      const dateObj = new Date(`${dateKey}, ${startMidnight.getUTCFullYear()}`)

      return {
        date: dateObj,
        reading1: readings[0] || '',
        reading2: readings[1] || '',
        reading3: readings[2] || ''
      }
    })
  } catch (error) {
    console.error('Failed to fetch readings for newsletter:', error)
    return []
  }
}

function stripTime(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

export const getEmailContent = async (reason: emailReasons): Promise<string[] | undefined[]> => {
  switch (reason) {
    case 'sunday-school':
      const events = await get_upcoming_program(['sundaySchool'])
      console.log('events', events)
      const htmlContent = await render(<SundaySchool events={events as SundaySchoolType[]} />)
      const textContent = await render(<SundaySchool events={events as SundaySchoolType[]} />, {
        plainText: true,
      })
      return [htmlContent, textContent]
    case 'recap':
      const memorialEvents = await get_upcoming_program(['memorial', 'sundaySchool'])
      console.log('memorialEvents', memorialEvents)
      const mergeEvents = mergeSundayEvents(memorialEvents)
      console.log('mergeEvents', mergeEvents)
      const MemorialHtmlContent = await render(<MemorialService events={mergeEvents} />)
      const MemorialTextContent = await render(<MemorialService events={mergeEvents} />, {
        plainText: true,
      })
      return [MemorialHtmlContent, MemorialTextContent]
    case 'bible-class':
      const bibleClassEvents = await get_upcoming_program(['bibleClass'])
      const bibleClassHtmlContent = await render(
        <BibleClass events={bibleClassEvents as BibleClassType[]} />
      )
      const bibleClassTextContent = await render(
        <BibleClass events={bibleClassEvents as BibleClassType[]} />,
        {
          plainText: true,
        }
      )
      return [bibleClassHtmlContent, bibleClassTextContent]
    case 'newsletter':
      // Fetch all required data for newsletter
      const [scheduleData, upcomingEvents, readingsData] = await Promise.all([
        get_upcoming_program(['memorial', 'sundaySchool', 'bibleClass']),
        fetchEvents(),
        fetchBibleReadings()
      ])

      console.log('Newsletter data fetched:', {
        scheduleData: scheduleData.length,
        upcomingEvents: upcomingEvents.length,
        readingsData: readingsData.length
      })

      const newsletterHtmlContent = await render(
        <Newsletter
          scheduleEvents={scheduleData as (MemorialServiceType | BibleClassType | SundaySchoolType)[]}
          upcomingEvents={upcomingEvents}
          readings={readingsData}
        />
      )
      const newsletterTextContent = await render(
        <Newsletter
          scheduleEvents={scheduleData as (MemorialServiceType | BibleClassType | SundaySchoolType)[]}
          upcomingEvents={upcomingEvents}
          readings={readingsData}
        />,
        { plainText: true }
      )
      return [newsletterHtmlContent, newsletterTextContent]
    default:
      return [undefined]
  }
}
