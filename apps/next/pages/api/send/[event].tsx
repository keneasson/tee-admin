import { NextApiRequest, NextApiResponse } from 'next'
import { renderAsync } from '@react-email/render'
import SundaySchool from 'email-builder/emails/SundaySchool'
import { get_upcoming_program } from 'next-app/utils/get-upcoming-program'
import { SundaySchoolType } from '@my/app/types'

/**
 * If you are here, you're still lost - you probably want the email/[reason].tsx handler.
 * @param req
 * @param res
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!req.query.event) {
      return res.status(404).json({ failed: 'Event Not Found' })
    }
    switch (req.query.event) {
      case 'SundaySchool':
        const result = await get_upcoming_program(['sundaySchool'])
        const readyToSend = await renderAsync(
          <SundaySchool events={result as SundaySchoolType[]} />
        )

        console.log('readyToSend', readyToSend)
    }
  } catch (error) {
    console.log('error', error)
    res.status(500).json({ failed: error })
  }
}
