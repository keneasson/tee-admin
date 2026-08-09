import { NextRequest, NextResponse } from 'next/server'
import { sendQueueRepo } from '@my/app/provider/dynamodb/repositories/send-queue-repository'
import { EmailType, QueueEntry } from '@my/app/types/send-queue'
import { getEmailContent } from '@/utils/email/get-email-content'
import { emailSend, emailReasons } from '@/utils/email/email-send'

// Configure route for longer timeout (matches legacy cron jobs)
export const maxDuration = 60 // 60 seconds

// Email types now align with email sending system (email-send.tsx)
const emailTypeMap: Record<EmailType, emailReasons> = {
  'newsletter': 'newsletter',
  'bible-class': 'bible-class',
  'sunday-school': 'sunday-school',
  'recap': 'recap',
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

    // How early the queue entry may be materialized, and how late a missed/
    // backed-up cron may still catch up. The send gate itself NEVER fires before
    // the scheduled minute (see Step 3) — a 2:00 PM schedule sends at 2:00 PM, not
    // 12:00 PM. The cron ticks every ~5 min, so the first tick at/after the
    // scheduled minute sends it. SEND_GRACE_MIN bounds same-day catch-up so a late
    // cron doesn't surprise-send hours later.
    const QUEUE_LEAD_MIN = 120 // materialize the entry up to 2h before send time
    const SEND_GRACE_MIN = 180 // send from the scheduled minute through +3h, then skip for the day

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

        // Materialize the entry from QUEUE_LEAD_MIN before send time through the
        // send-grace window, so a 'ready' entry exists whenever the send gate is
        // open. Queuing early is harmless — the entry just waits; Step 3 gates the
        // actual send to at/after the scheduled minute.
        const timeUntilSend = scheduleMinutes - currentMinutes
        if (timeUntilSend <= QUEUE_LEAD_MIN && timeUntilSend >= -SEND_GRACE_MIN) {
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
      // Must be scheduled for today
      if (entry.scheduledDate !== currentDate) {
        return false
      }

      const [emailHour, emailMinute] = entry.scheduledTime.split(':').map(Number)
      const emailMinutes = emailHour * 60 + emailMinute
      const currentMinutes = torontoTime.getHours() * 60 + torontoTime.getMinutes()

      // Send only AT or AFTER the scheduled minute — never early. Bounded by
      // SEND_GRACE_MIN so a missed/backed-up cron can still catch up the same day
      // without surprise-sending hours late.
      const minutesLate = currentMinutes - emailMinutes
      return minutesLate >= 0 && minutesLate <= SEND_GRACE_MIN
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

    // Step 4: Send the emails with atomic claiming to prevent duplicates
    for (const queueEntry of emailsToSend) {
      const isRetry = queueEntry.status === 'failed'
      const retryAttempt = (queueEntry.retryCount || 0) + 1

      // ATOMIC CLAIM: Try to claim this entry for processing
      // This ensures only ONE process can send this email, even if multiple cron jobs run simultaneously
      // For retries, we claim from 'failed' status, for new sends we claim from 'ready' status
      const claimedEntry = await sendQueueRepo.claimQueueEntry(
        queueEntry.emailType,
        queueEntry.scheduledDate,
        queueEntry.scheduledTime,
        isRetry ? 'failed' : 'ready' // Expected status depends on whether it's a retry
      )

      if (!claimedEntry) {
        // Another process already claimed this entry - skip it
        console.log(`⏭️  Skipping ${queueEntry.emailType} at ${queueEntry.scheduledTime} - already claimed by another process`)
        continue
      }

      try {
        if (isRetry) {
          console.log(`🔄 Retrying ${queueEntry.emailType} (attempt ${retryAttempt}/3)`)
        } else {
          console.log(`📧 Processing ${queueEntry.emailType} at ${queueEntry.scheduledTime} (claimed at ${claimedEntry.claimedAt})`)
        }

        const emailReason = emailTypeMap[queueEntry.emailType]

        // Get email content for this type. Some templates return a content-aware
        // subject as a 3rd element (e.g. Bible Class → "No Bible Class Tonight"
        // when there's no class), which must override the static per-reason subject.
        const emailContent = await getEmailContent(emailReason)
        const [emailHtml, emailText, generatedSubject] = emailContent || ['', '']

        if (!emailHtml || !emailText) {
          throw new Error(`Failed to generate email content for ${emailReason}`)
        }

        // Send via SES
        const sendResult = await emailSend({
          reason: emailReason,
          emailHtml,
          emailText,
          test: queueEntry.testMode || false,
          customSubject: generatedSubject || undefined,
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