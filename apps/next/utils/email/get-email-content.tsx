import { get_upcoming_program } from '../../pages/api/upcoming-program'
import { renderAsync } from '@react-email/render'
import { SundaySchool } from 'emails/emails/sundayschool'
import { SundaySchoolType } from 'app/types'

export const getEmailContent = async (reason: string): Promise<string[] | undefined[]> => {
  switch (reason) {
    case 'sunday-school':
      const events = await get_upcoming_program()
      const sundaySchool = events.filter((e) => e.Key === 'sundaySchool') as SundaySchoolType[]
      console.log('events', sundaySchool)
      const htmlContent = await renderAsync(<SundaySchool events={sundaySchool} />)
      const textContent = await renderAsync(<SundaySchool events={sundaySchool} />, {
        plainText: true,
      })
      return [htmlContent, textContent]
    default:
      return [undefined]
  }
}
