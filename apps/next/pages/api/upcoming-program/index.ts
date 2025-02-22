import { NextApiRequest, NextApiResponse } from 'next'
import { get_upcoming_program } from 'next-app/utils/get-upcoming-program'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return get_upcoming_program(['sundaySchool', 'memorial', 'bibleClass'])
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((error) => {
      console.log('error', error)
      res.status(500).json({ failed: error })
    })
}
