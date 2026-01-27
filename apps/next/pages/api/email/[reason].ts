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
  let eventId: string | undefined
  let eventType: string | undefined

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

  // For event announcements, we need eventId and eventType from request body
  if (reason === 'event-announcement' && req.method === 'POST') {
    const body = req.body
    console.log('[event-announcement] Request body:', JSON.stringify(body, null, 2))
    eventId = body.eventId
    eventType = body.eventType
    customList = body.selectedList || 'newsletter' // Default to newsletter list

    if (!eventId || !eventType) {
      console.log('[event-announcement] Missing eventId or eventType:', { eventId, eventType })
      return res.status(400).json({
        failed: 'Event announcement requires eventId and eventType in request body'
      })
    }
    console.log('[event-announcement] Processing event:', { eventId, eventType })
  }

  // For inter-ecclesia announcements, we need eventId and eventType from request body
  if (reason === 'inter-ecclesia' && req.method === 'POST') {
    const body = req.body
    console.log('[inter-ecclesia] Request body:', JSON.stringify(body, null, 2))
    eventId = body.eventId
    eventType = body.eventType

    if (!eventId || !eventType) {
      console.log('[inter-ecclesia] Missing eventId or eventType:', { eventId, eventType })
      return res.status(400).json({
        failed: 'Inter-ecclesia announcement requires eventId and eventType in request body'
      })
    }
    console.log('[inter-ecclesia] Processing event:', { eventId, eventType })
  }

  try {
    const [emailHtml, emailText, generatedSubject] = await getEmailContent(reason, note, customHtmlContent, customSubject, eventId, eventType)
    if (!(emailHtml && emailText)) {
      return res.status(500).json({ failed: 'Email template for ' + reason + ' not found' })
    }
    console.log('IS sending as TEST: ', { isTest, hasNote: !!note, generatedSubject })
    const result = await emailSend({
      reason,
      emailHtml,
      emailText,
      test: isTest,
      customList,
      customSubject: generatedSubject || customSubject, // Use generated subject if available
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
