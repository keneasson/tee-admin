import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeContact } from '../../../../utils/email/contact'
import { sendRecordRepository } from '@my/app/provider/dynamodb/repositories/send-record-repository'
import { sendRecipientRepository } from '@my/app/provider/dynamodb/repositories/send-recipient-repository'

// Types for SNS/SES notifications
interface SNSMessage {
  Type: 'SubscriptionConfirmation' | 'Notification' | 'UnsubscribeConfirmation'
  MessageId: string
  TopicArn: string
  Subject?: string
  Message: string
  Timestamp: string
  SignatureVersion: string
  Signature: string
  SigningCertURL: string
  SubscribeURL?: string // For SubscriptionConfirmation
  UnsubscribeURL?: string
}

interface SESBounceNotification {
  notificationType: 'Bounce' | 'Complaint' | 'Delivery' | 'Open' | 'Click'
  bounce?: {
    bounceType: 'Permanent' | 'Transient' | 'Undetermined'
    bounceSubType: string
    bouncedRecipients: Array<{
      emailAddress: string
      action?: string
      status?: string
      diagnosticCode?: string
    }>
    timestamp: string
    feedbackId: string
  }
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string
    }>
    timestamp: string
    feedbackId: string
    complaintFeedbackType?: string
  }
  open?: {
    timestamp: string
    userAgent: string
    ipAddress: string
  }
  click?: {
    timestamp: string
    userAgent: string
    ipAddress: string
    link: string
    linkTags?: Record<string, string[]>
  }
  mail: {
    timestamp: string
    source: string
    sourceArn: string
    sendingAccountId: string
    messageId: string
    destination: string[]
    tags?: Record<string, string[]>
  }
}

/**
 * POST /api/ses/bounce-webhook
 *
 * Receives SNS notifications from SES for bounces and complaints.
 * Automatically unsubscribes bounced/complained email addresses.
 *
 * Setup required in AWS:
 * 1. Create SNS topic (e.g., tee-ses-bounces)
 * 2. Add this endpoint as HTTPS subscription to the SNS topic
 * 3. Configure SES Configuration Set to publish bounce/complaint events to SNS topic
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const snsMessage: SNSMessage = JSON.parse(body)

    console.log('📬 Received SNS message type:', snsMessage.Type)

    // Handle SNS subscription confirmation
    if (snsMessage.Type === 'SubscriptionConfirmation') {
      console.log('📬 SNS Subscription confirmation received')
      console.log('📬 SubscribeURL:', snsMessage.SubscribeURL)

      // Automatically confirm the subscription by visiting the SubscribeURL
      if (snsMessage.SubscribeURL) {
        await fetch(snsMessage.SubscribeURL)
        console.log('✅ SNS Subscription confirmed')
      }

      return NextResponse.json({
        success: true,
        message: 'Subscription confirmed'
      })
    }

    // Handle actual notifications
    if (snsMessage.Type === 'Notification') {
      const sesNotification: SESBounceNotification = JSON.parse(snsMessage.Message)

      console.log('📬 SES notification type:', sesNotification.notificationType)

      // Extract campaign ID from SES message tags (best-effort)
      const campaignId = sesNotification.mail.tags?.Campaign?.[0]

      // Recipient(s) for this event — present on every SES notification.
      const eventRecipients = sesNotification.mail.destination ?? []

      // Handle Open events — update send record metrics
      if (sesNotification.notificationType === 'Open') {
        console.log('📬 Open event received')
        if (campaignId) {
          await sendRecordRepository.incrementMetric(campaignId, 'opens')
          await Promise.all(eventRecipients.map((e) => sendRecipientRepository.recordOpen(campaignId, e)))
        }
        return NextResponse.json({ success: true, type: 'open', campaignId })
      }

      // Handle Click events — update send record metrics
      if (sesNotification.notificationType === 'Click') {
        console.log('📬 Click event received:', sesNotification.click?.link)
        if (campaignId) {
          await sendRecordRepository.incrementMetric(campaignId, 'clicks')
          await Promise.all(eventRecipients.map((e) => sendRecipientRepository.recordClick(campaignId, e)))
        }
        return NextResponse.json({ success: true, type: 'click', campaignId })
      }

      // Handle bounces
      if (sesNotification.notificationType === 'Bounce' && sesNotification.bounce) {
        const { bounceType, bounceSubType, bouncedRecipients } = sesNotification.bounce

        console.log(`📬 Bounce received: ${bounceType} (${bounceSubType})`)

        // Unsubscribe all bounced recipients
        const results = await Promise.all(
          bouncedRecipients.map(async (recipient) => {
            const reason = `${bounceType} bounce: ${bounceSubType}`

            // Always unsubscribe permanent (hard) bounces
            // For transient bounces, only unsubscribe if it's a serious issue
            if (bounceType === 'Permanent' || bounceSubType === 'General') {
              try {
                await unsubscribeContact(recipient.emailAddress, reason)
                console.log(`✅ Unsubscribed bounced email: ${recipient.emailAddress}`)
                return { email: recipient.emailAddress, success: true }
              } catch (error) {
                console.error(`❌ Failed to unsubscribe ${recipient.emailAddress}:`, error)
                return { email: recipient.emailAddress, success: false, error }
              }
            } else {
              console.log(`⚠️ Transient bounce for ${recipient.emailAddress} - not unsubscribing`)
              return { email: recipient.emailAddress, success: true, skipped: true }
            }
          })
        )

        // Update send record bounce count
        if (campaignId) {
          await sendRecordRepository.incrementMetric(campaignId, 'bounces', bouncedRecipients.length)
          await Promise.all(
            bouncedRecipients.map((r) =>
              sendRecipientRepository.recordBounce(campaignId, r.emailAddress, bounceType)
            )
          )
        }

        return NextResponse.json({
          success: true,
          type: 'bounce',
          bounceType,
          bounceSubType,
          processed: results,
        })
      }

      // Handle complaints (spam reports)
      if (sesNotification.notificationType === 'Complaint' && sesNotification.complaint) {
        const { complainedRecipients, complaintFeedbackType } = sesNotification.complaint

        console.log(`📬 Complaint received: ${complaintFeedbackType || 'unknown type'}`)

        // Always unsubscribe users who complain (marked as spam)
        const results = await Promise.all(
          complainedRecipients.map(async (recipient) => {
            const reason = `Complaint: ${complaintFeedbackType || 'spam'}`
            try {
              await unsubscribeContact(recipient.emailAddress, reason)
              console.log(`✅ Unsubscribed complained email: ${recipient.emailAddress}`)
              return { email: recipient.emailAddress, success: true }
            } catch (error) {
              console.error(`❌ Failed to unsubscribe ${recipient.emailAddress}:`, error)
              return { email: recipient.emailAddress, success: false, error }
            }
          })
        )

        // Update send record complaint count
        if (campaignId) {
          await sendRecordRepository.incrementMetric(campaignId, 'complaints', complainedRecipients.length)
          await Promise.all(
            complainedRecipients.map((r) =>
              sendRecipientRepository.recordComplaint(campaignId, r.emailAddress)
            )
          )
        }

        return NextResponse.json({
          success: true,
          type: 'complaint',
          complaintType: complaintFeedbackType,
          processed: results,
        })
      }

      // Delivery notifications — update send record delivery count
      if (sesNotification.notificationType === 'Delivery') {
        console.log('📬 Delivery confirmation received')
        if (campaignId) {
          await sendRecordRepository.incrementMetric(campaignId, 'deliveries', eventRecipients.length)
          await Promise.all(eventRecipients.map((e) => sendRecipientRepository.recordDelivery(campaignId, e)))
        }
        return NextResponse.json({ success: true, type: 'delivery', campaignId })
      }
    }

    return NextResponse.json({ success: true, message: 'Notification processed' })

  } catch (error) {
    console.error('❌ Error processing SES webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process notification' },
      { status: 500 }
    )
  }
}

// GET endpoint for testing/health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'SES Bounce Webhook',
    description: 'Receives SNS notifications for SES bounces and complaints',
  })
}
