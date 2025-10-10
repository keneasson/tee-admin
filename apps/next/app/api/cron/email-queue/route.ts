import { NextRequest, NextResponse } from 'next/server'
import { sendQueueRepo } from '@my/app/provider/dynamodb/repositories/send-queue-repository'
import { EmailType, QueueEntry } from '@my/app/types/send-queue'
import { getEmailContent } from '@/utils/email/get-email-content'
import { emailSend, emailReasons } from '@/utils/email/email-send'

// Map new email types to existing email system
const emailTypeMap: Record<EmailType, emailReasons> = {
  'newsletter': 'newsletter',
  'bible-class': 'bible-class',
  'sunday-school': 'sunday-school',
  'memorial': 'recap', // Memorial service uses 'recap' in the old system
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    // Verify this is a legitimate cron job request
    if (authHeader !== `Bearer ${process.env.EMAIL_SENDER_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Use America/Toronto timezone for date/time calculations
    const torontoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
    const currentDate = torontoTime.toISOString().split('T')[0] // YYYY-MM-DD
    const currentTime = `${String(torontoTime.getHours()).padStart(2, '0')}:${String(torontoTime.getMinutes()).padStart(2, '0')}` // HH:MM
    const currentDay = torontoTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' }).toLowerCase() as any

    console.log(`🕐 Cron job running at ${currentDate} ${currentTime} (${currentDay}) Toronto time`)

    const response = {
      processed: {
        sent: 0,
        queued: 0,
        errors: 0,
      },
      details: {
        sentEmails: [] as string[],
        queuedEmails: [] as string[],
        errors: [] as string[],
      },
    }

    // Step 1: Check for schedules that should trigger today
    const allSchedules = await sendQueueRepo.getAllSchedules()
    const todaySchedules = allSchedules.filter(schedule =>
      schedule.enabled &&
      schedule.dayOfWeek === currentDay
    )

    console.log(`📅 Found ${todaySchedules.length} schedules for ${currentDay}`)

    // Step 2: Queue emails for schedules that should run
    for (const schedule of todaySchedules) {
      try {
        // Check if this email should be queued for sending
        // We queue emails up to 2 hours before they should be sent
        const scheduleTime = schedule.time
        const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number)
        const scheduleMinutes = scheduleHour * 60 + scheduleMinute
        const currentMinutes = torontoTime.getHours() * 60 + torontoTime.getMinutes()

        // Queue if we're within 2 hours of send time and haven't queued yet
        const timeUntilSend = scheduleMinutes - currentMinutes
        if (timeUntilSend <= 120 && timeUntilSend > -120) { // 2 hours before to 2 hours after (extended for testing)
          const existing = await sendQueueRepo.getQueueEntry(
            schedule.emailType,
            currentDate,
            scheduleTime
          )

          if (!existing) {
            await sendQueueRepo.addToQueue({
              emailType: schedule.emailType,
              scheduledDate: currentDate,
              scheduledTime: scheduleTime,
              testMode: schedule.testMode,
            })

            response.processed.queued++
            response.details.queuedEmails.push(
              `${schedule.emailType} scheduled for ${scheduleTime}`
            )
            console.log(`📧 Queued ${schedule.emailType} for ${scheduleTime}`)
          }
        }
      } catch (error) {
        response.processed.errors++
        response.details.errors.push(
          `Failed to queue ${schedule.emailType}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        console.error(`❌ Failed to queue ${schedule.emailType}:`, error)
      }
    }

    // Step 3: Process ready emails that should be sent now
    const readyEmails = await sendQueueRepo.getReadyEmails()
    const emailsToSend = readyEmails.filter(entry => {
      const [emailHour, emailMinute] = entry.scheduledTime.split(':').map(Number)
      const emailMinutes = emailHour * 60 + emailMinute
      const currentMinutes = torontoTime.getHours() * 60 + torontoTime.getMinutes()

      // Send if it's time (within 15 minutes of scheduled time)
      const timeDiff = Math.abs(emailMinutes - currentMinutes)
      return timeDiff <= 120 // Extended to 2 hours for testing
    })

    console.log(`📮 Found ${emailsToSend.length} emails ready to send`)

    // Step 3.5: Check for failed emails that should be retried
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(today.getDate() - 30)
    const start = thirtyDaysAgo.toISOString().split('T')[0]
    const end = currentDate

    const allRecent = await sendQueueRepo.getQueueByDateRange(start, end)
    const failedEmails = allRecent.filter(entry => {
      // Retry failed emails that:
      // 1. Have status 'failed'
      // 2. Have less than 3 retry attempts
      // 3. Last retry was at least 1 hour ago (or never retried)
      if (entry.status !== 'failed') return false
      if ((entry.retryCount || 0) >= 3) return false

      if (entry.lastRetry) {
        const lastRetryTime = new Date(entry.lastRetry).getTime()
        const hourAgo = Date.now() - (60 * 60 * 1000)
        return lastRetryTime < hourAgo
      }

      return true // Never retried, so retry now
    })

    console.log(`🔄 Found ${failedEmails.length} failed emails to retry`)

    // Add failed emails to send list (they'll be retried)
    emailsToSend.push(...failedEmails)

    // Step 4: Send the emails
    for (const queueEntry of emailsToSend) {
      const isRetry = queueEntry.status === 'failed'
      const retryAttempt = (queueEntry.retryCount || 0) + 1

      try {
        if (isRetry) {
          console.log(`🔄 Retrying ${queueEntry.emailType} (attempt ${retryAttempt}/3)`)
        }

        const emailReason = emailTypeMap[queueEntry.emailType]

        // Get email content for this type
        const emailContent = await getEmailContent(emailReason)
        const [emailHtml, emailText] = emailContent || ['', '']

        if (!emailHtml || !emailText) {
          throw new Error(`Failed to generate email content for ${emailReason}`)
        }

        // Send via SES
        const sendResult = await emailSend({
          reason: emailReason,
          emailHtml,
          emailText,
          test: queueEntry.testMode || false,
        })

        if (sendResult instanceof Error) {
          throw sendResult
        }

        const recipientCount = sendResult.sends.length + sendResult.skips.length
        const sentCount = sendResult.sends.length
        const failedCount = sendResult.skips.length

        // Mark as complete if successful, or failed if there were failures
        const newStatus = failedCount > 0 ? 'failed' : 'complete'

        await sendQueueRepo.updateQueueStatus(
          queueEntry.emailType,
          queueEntry.scheduledDate,
          queueEntry.scheduledTime,
          newStatus,
          {
            recipientCount,
            sentCount,
            failedCount,
            error: failedCount > 0 ? `${failedCount} recipients failed` : undefined,
            incrementRetry: isRetry && newStatus === 'failed', // Only increment if retry failed again
          }
        )

        response.processed.sent++
        const retryLabel = isRetry ? ` (retry ${retryAttempt})` : ''
        response.details.sentEmails.push(
          `${queueEntry.emailType} sent at ${queueEntry.scheduledTime}: ${sentCount}/${recipientCount} delivered${queueEntry.testMode ? ' (TEST)' : ''}${retryLabel}`
        )
        console.log(`✅ Sent ${queueEntry.emailType} at ${queueEntry.scheduledTime}: ${sentCount}/${recipientCount} delivered${queueEntry.testMode ? ' (TEST)' : ''}${retryLabel}`)
      } catch (error) {
        // Update status to failed and increment retry counter
        await sendQueueRepo.updateQueueStatus(
          queueEntry.emailType,
          queueEntry.scheduledDate,
          queueEntry.scheduledTime,
          'failed',
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            incrementRetry: isRetry, // Increment retry count
          }
        )

        response.processed.errors++
        const retryLabel = isRetry ? ` (retry ${retryAttempt} failed)` : ''
        response.details.errors.push(
          `Failed to send ${queueEntry.emailType}: ${error instanceof Error ? error.message : 'Unknown error'}${retryLabel}`
        )
        console.error(`❌ Failed to send ${queueEntry.emailType}${retryLabel}:`, error)
      }
    }

    console.log(`🎯 Cron job completed: ${response.processed.sent} sent, ${response.processed.queued} queued, ${response.processed.errors} errors`)

    return NextResponse.json(response)
  } catch (error) {
    console.error('❌ Cron job failed:', error)
    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Also support POST for manual testing
export async function POST(req: NextRequest) {
  return GET(req)
}