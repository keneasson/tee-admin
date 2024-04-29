import { NextApiRequest, NextApiResponse } from 'next'
import { renderAsync } from '@react-email/render'
import { SundaySchool } from 'emails/emails/sundayschool'
import { fetchUpcoming } from 'app/features/newsletter/fetch-upcoming'
import { SundaySchoolType } from 'app/types'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.event) {
    return res.status(404).json({ failed: 'Event Not Found' })
  }
  switch (req.query.event) {
    case 'SundaySchool':
      const events = (await fetchUpcoming()) as SundaySchoolType[]
      return await renderAsync(<SundaySchool events={events} />)
  }
}

export const getUpcomingSundaySchool = () => {}
