import { NextApiRequest, NextApiResponse } from 'next'
import { emailReasons, emailSend } from 'next-app/utils/email/email-send'
import { getEmailContent } from 'next-app/utils/email/get-email-content'

export const config = {
  maxDuration: 60, // 60 seconds
}

/**
 * Main API Endpoint for sending an Email for a Specific Reason
 * reasons include: "sunday-school" | "newsletter" | "bible-class" | "recap"
 *
 * takes a query param ?reason=
 * @param req NextApiRequest
 * @param res NextApiResponse
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!req.query.reason) {
    return res.status(404).json({ failed: 'Json Data Not Found' })
  }
  const isTest = !!req.query.test
  const reason = req.query.reason as emailReasons
  try {
    const [emailHtml, emailText] = await getEmailContent(reason)
    if (!(emailHtml && emailText)) {
      return res.status(500).json({ failed: 'Email template for ' + reason + ' not found' })
    }
    console.log('IS sending as TEST: ', { isTest })
    const result = await emailSend({ reason, emailHtml, emailText, test: isTest })
    console.log('result from AWS.SES', result)
    return res.status(200).json(result)
  } catch (e) {
    console.log('email[reason] failed with error:', e)
    const failed = {
      message: 'Failed in outside catch',
      error: e,
    }
    return res.status(500).json({ failed })
  }
}
