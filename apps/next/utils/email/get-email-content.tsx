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
import MemorialService from 'email-builder/emails/Memorial'
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
    default:
      return [undefined]
  }
}
