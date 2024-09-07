import { NextApiRequest, NextApiResponse } from 'next'
import { addContact, getContacts } from '../../../utils/email/contact'
import { CreateContactType } from 'app/types'

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
    /**
     * ***************************************
     * ADD a Contact to SES Subscriber list
     * unless specified, the list will have default Topics.
     * ***************************************
     */
    if (req.method === 'POST') {
      const contact = req.body as unknown as CreateContactType
      const result = addContact(contact)
      console.log('API POST.addContact body', { contact })
      return res.status(200).json(result)
    }
    /**
     * ***************************************
     * GET the next set of Contacts from SES Subscriber List
     * ***************************************
     */
    if (req.method === 'GET') {
      const nextPageToken = checkNextPageToken(req.query)
      const contactResponse = await getContacts({ nextPageToken })
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
 * then decodes it, so it works.
 * @param query the NextApiRequest Query String
 */
function checkNextPageToken(query: NextApiRequest['query']): string | undefined {
  if (!query?.['NextToken']) {
    return undefined
  }
  return decodeURIComponent(query['NextToken'] as string)
}
