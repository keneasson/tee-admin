import { NextApiRequest, NextApiResponse } from 'next'
import {
  createContactListTopic,
  getContactLists,
  updateContactListTopic,
} from '../../../../utils/email/contact-lists'
import { CreateUpdateListType } from '@my/app/types'

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
      console.log('getContactLists', contactResponse)
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
      const { oldListName, listName, displayName, defaultOptIn } = JSON.parse(
        req.body
      ) as CreateUpdateListType
      console.log('API POST.addContactListTopic body', { listName, displayName, defaultOptIn })
      const response = oldListName
        ? await updateContactListTopic({ oldListName, listName, displayName, defaultOptIn })
        : await createContactListTopic({ listName, displayName, defaultOptIn })
      console.log()
      return res.status(200).json(response)
    } catch (e) {
      const failed = {
        message: 'Failed in outside catch',
        error: e,
      }
      console.error('unable to Create List Topic', failed)
      return res.status(500).json({ failed: failed })
    }
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
