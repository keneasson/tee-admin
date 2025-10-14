import { sendQueueTableDef, createTable } from './table-definitions'
import { sendQueueRepo } from './repositories/send-queue-repository'
import { EmailType, DayOfWeek } from '@my/app/types/send-queue'

// Default email schedules to initialize the system
const defaultSchedules = [
  {
    emailType: 'newsletter' as EmailType,
    dayOfWeek: 'thursday' as DayOfWeek,
    time: '17:00',
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Weekly community newsletter',
    testMode: false,
  },
  {
    emailType: 'bible-class' as EmailType,
    dayOfWeek: 'wednesday' as DayOfWeek,
    time: '14:00',
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Bible class study materials',
    testMode: false,
  },
  {
    emailType: 'sunday-school' as EmailType,
    dayOfWeek: 'saturday' as DayOfWeek,
    time: '14:00',
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Sunday school lesson preparation',
    testMode: false,
  },
  {
    emailType: 'memorial' as EmailType,
    dayOfWeek: 'saturday' as DayOfWeek,
    time: '15:00',
    timezone: 'America/Toronto',
    enabled: true,
    description: 'Memorial service arrangements',
    testMode: false,
  },
]

/**
 * Initialize the send queue system
 * - Creates the DynamoDB table if it doesn't exist
 * - Sets up default email schedules
 */
export async function setupSendQueue(): Promise<void> {
  try {
    console.log('🚀 Setting up email send queue system...')

    // Step 1: Create the table
    await createTable(sendQueueTableDef)

    // Step 2: Wait a moment for table to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 3: Initialize default schedules
    console.log('📧 Setting up default email schedules...')

    for (const schedule of defaultSchedules) {
      try {
        // Check if schedule already exists
        const existing = await sendQueueRepo.getScheduleByType(schedule.emailType)

        if (!existing) {
          await sendQueueRepo.putSchedule(schedule)
          console.log(`✅ Created schedule for ${schedule.emailType}: ${schedule.dayOfWeek} at ${schedule.time}`)
        } else {
          console.log(`⚠️  Schedule for ${schedule.emailType} already exists`)
        }
      } catch (error) {
        console.error(`❌ Failed to create schedule for ${schedule.emailType}:`, error)
      }
    }

    console.log('🎯 Email send queue system setup complete!')
    console.log('📝 Default schedules:')
    console.log('  • Newsletter: Thursday 5:00 PM')
    console.log('  • Bible Class: Wednesday 2:00 PM')
    console.log('  • Sunday School: Saturday 2:00 PM')
    console.log('  • Memorial: Saturday 3:00 PM')
    console.log('')
    console.log('📊 Cron job runs every 15 minutes to process the queue')
    console.log('🔗 Admin UI available at: /admin/email/schedule')

  } catch (error) {
    console.error('❌ Failed to setup send queue system:', error)
    throw error
  }
}

/**
 * Clean up old queue entries (for maintenance)
 */
export async function cleanupSendQueue(daysOld: number = 30): Promise<void> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    const cutoffString = cutoffDate.toISOString().split('T')[0] // YYYY-MM-DD

    console.log(`🧹 Cleaning up queue entries older than ${cutoffString}...`)

    const deletedCount = await sendQueueRepo.cleanupOldEntries(cutoffString)

    console.log(`✅ Cleaned up ${deletedCount} old queue entries`)
  } catch (error) {
    console.error('❌ Failed to cleanup send queue:', error)
    throw error
  }
}

// CLI support
if (require.main === module) {
  const command = process.argv[2]

  if (command === 'setup') {
    setupSendQueue()
  } else if (command === 'cleanup') {
    const days = parseInt(process.argv[3]) || 30
    cleanupSendQueue(days)
  } else {
    console.log('Usage:')
    console.log('  npm run setup-send-queue setup    - Initialize the system')
    console.log('  npm run setup-send-queue cleanup [days] - Clean up old entries (default: 30 days)')
  }
}