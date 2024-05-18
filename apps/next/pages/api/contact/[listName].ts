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
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  try {
    if (!req.query.listName) {
      return res.status(404).json({ failed: 'Json Data Not Found' })
    }
    const listName = req.query.listName as string

    if (req.method === 'POST') {
      const contact = req.body
      // const result = addContact({ listName, contact })
      console.log('API POST.addContact body', { listName, contact })
      /**
       * @todo - actually pass contacts to SES add Subscribers Service.
       */
      const numberAdded = initSubscriberList()
      return res.status(200).json(numberAdded)
    }
    if (req.method === 'GET') {
      const nextPageToken = checkNextPageToken(req.query)
      const contactResponse = await getContacts({ listName, nextPageToken })
      const nextToken = contactResponse.NextToken
        ? encodeURIComponent(contactResponse.NextToken)
        : undefined
      return res.status(200).json({ contacts: contactResponse.Contacts, nextToken })
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

/**
 * When we pass the NextToken Back from the Front-end it get's mashed so
 * we url encode it before packing it up. This function checks for it
 * then decodes it so it works.
 * @param query the NextApiRequest Query String
 */
function checkNextPageToken(query: NextApiRequest['query']): string | undefined {
  if (!query?.['NextToken']) {
    return undefined
  }
  return decodeURIComponent(query['NextToken'] as string)
}
