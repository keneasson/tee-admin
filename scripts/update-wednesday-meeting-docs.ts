/**
 * One-off: add/update documents on the Wednesday business meeting.
 * Re-run safe — replaces the entire documents array each time.
 *
 * Usage:
 *   npx tsx scripts/update-wednesday-meeting-docs.ts
 */

import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../apps/next/.env') })

const MEETING_ID = 'a101dfc5-6b4f-43d5-b8e0-eeef081d529e'

const documents = [
  {
    title: 'Semi-Annual Business Meeting Agenda',
    url: 'https://docs.google.com/document/d/1EvWZS-M8Cw1WSMtA7L387l3_jIBRsCdM2e2JMD0bPT8/edit?usp=sharing',
  },
]

async function main() {
  const { meetingRepository } = await import(
    '../packages/app/provider/dynamodb/repositories/meeting-repository'
  )

  console.log(`Updating meeting ${MEETING_ID} with ${documents.length} document(s)...`)
  const ok = await meetingRepository.updateMeeting(MEETING_ID, { documents })
  if (!ok) {
    throw new Error('updateMeeting returned false')
  }

  const updated = await meetingRepository.getById(MEETING_ID)
  console.log('✅ Updated meeting documents:')
  console.log(JSON.stringify(updated?.documents, null, 2))
}

main().catch((err) => {
  console.error('❌ Update failed:', err)
  process.exit(1)
})
