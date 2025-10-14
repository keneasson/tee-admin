import { NextRequest, NextResponse } from 'next/server'
import { getEmailContent } from '@/utils/email/get-email-content'
import { emailSend } from '@/utils/email/email-send'

/**
 * Thursday 9:30pm Test Email
 *
 * Simple test endpoint that sends a newsletter-style test email
 * Scheduled via Vercel cron: Thursday at 9:30pm (America/Toronto)
 *
 * Security: Uses EMAIL_SENDER_SECRET for authentication
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    // Verify this is a legitimate cron job request
    if (authHeader !== `Bearer ${process.env.EMAIL_SENDER_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🕐 Thursday test email triggered')

    // Get newsletter content (can be changed to any email type)
    const emailContent = await getEmailContent('newsletter')
    const [emailHtml, emailText] = emailContent || ['', '']

    if (!emailHtml || !emailText) {
      throw new Error('Failed to generate email content')
    }

    // Send via SES in TEST MODE
    const result = await emailSend({
      reason: 'newsletter',
      emailHtml,
      emailText,
      test: true, // Always send to test list for safety
    })

    if (result instanceof Error) {
      throw result
    }

    const recipientCount = result.sends.length + result.skips.length
    const sentCount = result.sends.length
    const failedCount = result.skips.length

    console.log(`✅ Thursday test email sent: ${sentCount}/${recipientCount} delivered (TEST)`)

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: recipientCount,
      testMode: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Thursday test email failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req)
}
