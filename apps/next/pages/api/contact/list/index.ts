import { NextApiRequest, NextApiResponse } from 'next'
import { getContactLists } from '../../../../utils/email/contact-lists'

/**
 * Main API Endpoint for sending an Email for a Specific Reason
 * reasons include: Newsletter, Memorial, Sunday School and Bible Class
 *
 * takes a query param ?reason=
 * @param req NextApiRequest
 * @param res NextApiResponse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await getContactLists()
    console.log('result from tee-admin contacts API', response)
    return res.status(200).json(response)
  } catch (e) {
    console.log('getContactLists error', e)
    const failed = {
      message: 'Failed in outside catch',
      error: e,
    }
    return res.status(500).json({ failed })
  }
}
