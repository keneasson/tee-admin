import { get_upcoming_program } from 'next-app/utils/get-upcoming-program'
import { render } from '@react-email/render'
import SundaySchool from 'email-builder/emails/SundaySchool'
import { MemorialServiceType, ProgramTypes, SundayEvents, SundaySchoolType } from '@my/app/types'
import MemorialService from 'email-builder/emails/Memorial'
import { emailReasons } from './email-send'

function mergeSundayEvents(events: ProgramTypes[]): SundayEvents[] {
  const memorial = events.find((e) => e.Key === 'memorial') as MemorialServiceType
  const sundaySchool = events.find((e) => e.Key === 'sundaySchool') as SundaySchoolType
  if (memorial?.Date === sundaySchool?.Date) {
    return [
      {
        ...memorial,
        Refreshments: sundaySchool.Refreshments,
        'Holidays and Special Events': sundaySchool['Holidays and Special Events'],
      },
    ]
  }
  return [
    { ...memorial, Refreshments: '', 'Holidays and Special Events': 'Sunday School is in Recess' },
  ]
}

export const getEmailContent = async (reason: emailReasons): Promise<string[] | undefined[]> => {
  switch (reason) {
    case 'sunday-school':
      const events = await get_upcoming_program(['sundaySchool'])
      const htmlContent = await render(<SundaySchool events={events as SundaySchoolType[]} />)
      const textContent = await render(<SundaySchool events={events as SundaySchoolType[]} />, {
        plainText: true,
      })
      return [htmlContent, textContent]
    case 'recap':
      const memorialEvents = await get_upcoming_program(['memorial', 'sundaySchool'])
      const mergeEvents = mergeSundayEvents(memorialEvents)
      const MemorialHtmlContent = await render(<MemorialService events={mergeEvents} />)
      const MemorialTextContent = await render(<MemorialService events={mergeEvents} />, {
        plainText: true,
      })
      return [MemorialHtmlContent, MemorialTextContent]
    default:
      return [undefined]
  }
}
