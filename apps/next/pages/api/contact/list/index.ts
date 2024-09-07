import { NextApiRequest, NextApiResponse } from 'next'
import { addContactListTopic, getContactLists } from '../../../../utils/email/contact-lists'

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
    /**
     * ***************************************
     * GET A Contact from SES Subscriber List
     * ***************************************
     */
    if (req.method === 'GET') {
      const contactResponse = await getContactLists()

      console.log('contactResponse', contactResponse)
      return res.status(200).json(contactResponse)
    }
  } catch (e) {
    console.log('getContacts error', e)
    const failed = {
      message: 'Failed in outside catch',
      error: e,
    }
    return res.status(500).json({ failed })
  }

  /**
   * ***************************************
   * CREATE a new Subscriber List Topic (new List Name)
   * ***************************************
   */
  if (req.method === 'POST') {
    try {
      const contact = req.body
      console.log('API POST.addContactListTopic body', { contact })
      const response = await addContactListTopic(contact.listName)
      return res.status(200).json(response)
    } catch (e) {
      const failed = {
        message: 'Failed in outside catch',
        error: e,
      }
    }
    return res.status(500).json({ failed: 'should never get here' })
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
