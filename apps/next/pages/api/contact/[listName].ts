import { NextApiRequest, NextApiResponse } from 'next'
import { getContacts } from '../../../utils/email/contact'
import { initSubscriberList } from '../../../utils/email/init/iniSesInitialSubscriberList'

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
    if (!req.query.listName) {
      return res.status(404).json({ failed: 'Json Data Not Found' })
    }
    const listName = req.query.listName as string

    if (req.method === 'POST') {
      const contact = req.body
      // const result = addContact({ listName, contact })
      console.log('API list.listName body', { listName, contact })
      const numberAdded = initSubscriberList()
      return res.status(200).json(numberAdded)
    }
    if (req.method === 'GET') {
      const contactResponse = await getContacts({ listName })
      console.log('result from tee-admin contacts API', contactResponse)
      return res.status(200).json(contactResponse.Contacts)
    }
  } catch (e) {
    console.log('getContacts error', e)
    const failed = {
      message: 'Failed in outside catch',
      error: e,
    }
    return res.status(500).json({ failed })
  }
}
