import { NextApiRequest, NextApiResponse } from 'next'
import { emailReasons, emailSend } from '../../../utils/email/email-send'
import { getEmailContent } from '../../../utils/getEmailContent'

/**
 * Main API Endpoint for sending an Email for a Specific Reason
 * reasons include: Newsletter, Memorial, Sunday School and Bible Class
 *
 * takes a query param ?reason=
 * @param req NextApiRequest
 * @param res NextApiResponse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.reason) {
    return res.status(404).json({ failed: 'Json Data Not Found' })
  }
  const reason = req.query.reason as emailReasons
  console.log('reason', reason)
  try {
    const [emailHtml, emailText] = await getEmailContent(reason)
    if (!(emailHtml && emailText)) {
      return res.status(404).json({ failed: 'Email template ' + reason + ' not found' })
    }
    emailSend({ reason, emailHtml, emailText })
      .then((result) => {
        console.log('result from AWS.SES', result)
        return res.status(200).json(result)
      })
      .catch((error) => {
        console.log('emailSend error', error)
        const failed = {
          message: 'Failed in-side catch',
          error,
        }
        return res.status(500).json({ failed: error })
      })
  } catch (e) {
    console.log('getEmailContent error', e)
    const failed = {
      message: 'Failed in outside catch',
      error: e,
    }
    return res.status(500).json({ failed })
  }
}
