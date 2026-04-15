/**
 * Seed Script: Wednesday (April 15, 2026) Semi-Annual Business Meeting
 *
 * Creates the first real MeetingRecord in DynamoDB for Toronto East's
 * semi-annual business meeting. This is a one-off script — re-running it
 * will create a duplicate, so run it once only.
 *
 * Usage:
 *   npx tsx scripts/seed-wednesday-meeting.ts
 */

import * as path from 'path'
import * as dotenv from 'dotenv'

// Load AWS credentials from the Next.js .env BEFORE importing the repository.
// The DynamoDB config reads env vars at module load, so we must populate
// them before the import graph touches config.ts.
dotenv.config({ path: path.resolve(__dirname, '../apps/next/.env') })

async function main() {
  console.log('Seeding Wednesday business meeting...')

  // Dynamic import so config.ts runs AFTER dotenv has loaded credentials
  const { meetingRepository } = await import(
    '../packages/app/provider/dynamodb/repositories/meeting-repository'
  )

  const meeting = await meetingRepository.create({
    title: 'Semi-Annual Business Meeting',
    meetingType: 'business',
    ownerType: 'ecclesia',
    ownerName: 'Toronto East',
    oneOffDate: '2026-04-15',
    startTime: '19:30',
    timezone: 'America/Toronto',
    platform: 'hybrid',
    onlineMeeting: {
      link: 'https://us02web.zoom.us/j/83272130710?pwd=D5KHaRlVwuGGJsyMkf1JcRoOQAsFg6.1',
      meetingId: '832 7213 0710',
      passcode: '499916',
      dialIn: '1 647 374 4685',
      platform: 'zoom',
    },
    documents: [],
    audience: { type: 'ses_topic', topic: 'members' },
    supersedes: { scheduleType: 'bibleClass' },
    active: true,
    createdBy: 'seed-script@tee-admin',
  })

  console.log('✅ Created meeting:')
  console.log(JSON.stringify(meeting, null, 2))
}

main().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
