import { GoogleSheetTypes } from '@my/app/types'
import { NextApiRequest, NextApiResponse } from 'next'
import { get_google_sheet } from 'utils/get-google-sheets'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.sheet) {
    return res.status(404).json({ failed: 'Schedule Not Found' })
  }

  return get_google_sheet(req.query.sheet as GoogleSheetTypes)
    .then((result) => {
      res.status(200).json(result)
    })
    .catch((error) => {
      console.log('error', error)
      res.status(500).json({ failed: error })
    })
}
