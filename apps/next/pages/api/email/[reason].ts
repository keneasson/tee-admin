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
  const note = typeof req.query.note === 'string' ? req.query.note : undefined
  const reason = req.query.reason as emailReasons

  // For custom emails, we need additional parameters from the request body
  let customHtmlContent: string | undefined
  let customSubject: string | undefined
  let customList: string | undefined

  if (reason === 'custom' && req.method === 'POST') {
    const body = req.body
    customHtmlContent = body.htmlContent
    customSubject = body.subject
    customList = body.selectedList

    if (!customHtmlContent || !customSubject || !customList) {
      return res.status(400).json({
        failed: 'Custom email requires htmlContent, subject, and selectedList in request body'
      })
    }
  }

  try {
    const [emailHtml, emailText] = await getEmailContent(reason, note, customHtmlContent, customSubject)
    if (!(emailHtml && emailText)) {
      return res.status(500).json({ failed: 'Email template for ' + reason + ' not found' })
    }
    console.log('IS sending as TEST: ', { isTest, hasNote: !!note })
    const result = await emailSend({
      reason,
      emailHtml,
      emailText,
      test: isTest,
      customList,
      customSubject,
    })
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
