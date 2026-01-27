import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { convertHumanReadableDate } from './date'

import { ProgramsTypes } from '@my/app/types'
import type { ProgramTypeKeys, ProgramTypes } from '@my/app/types'

/**
 * Get upcoming program events from DynamoDB
 * Returns the next 2 events for each schedule type, sorted by date
 *
 * Data flow: Google Sheets → DynamoDB sync → This function
 * YouTube URLs are stored in DynamoDB after being synced from Google Sheets
 */
export async function get_upcoming_program(
  orderOfKeys: ProgramTypeKeys[]
): Promise<ProgramTypes[]> {
  try {
    console.log('📅 Fetching upcoming program from DynamoDB')
    const scheduleService = new ScheduleService()
    const NOW = new Date()

    const upcoming: ProgramTypes[] = []

    for (const sheetKey of orderOfKeys) {
      try {
        // Get schedule data from DynamoDB
        const scheduleData = await scheduleService.getScheduleData(sheetKey as 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc')

        if (!scheduleData || !scheduleData.content) {
          console.warn(`⚠️ No ${sheetKey} schedule data found in DynamoDB`)
          continue
        }

        // Filter to upcoming events and take the next 2
        const upcomingEvents = scheduleData.content
          .filter((event: any) => {
            const eventDate = new Date(event.Date || event.date)
            return !isNaN(eventDate.getTime()) && eventDate.getTime() >= NOW.getTime()
          })
          .slice(0, 2) // Take next 2 events

        // Convert to ProgramTypes format
        for (const event of upcomingEvents) {
          const eventDate = new Date(event.Date || event.date)
          const programType = sheetKeyToProgramType(sheetKey)

          upcoming.push({
            ...event,
            Date: convertHumanReadableDate(eventDate),
            Key: programType,
          } as ProgramTypes)
        }

        console.log(`✅ Found ${upcomingEvents.length} upcoming ${sheetKey} events`)
      } catch (error) {
        console.error(`❌ Error fetching ${sheetKey} from DynamoDB:`, error)
        // Continue with other schedule types
      }
    }

    // Sort by date
    return upcoming.sort((a, b) => {
      const ad = typeof a.Date === 'string' ? new Date(a.Date) : a.Date
      const bd = typeof b.Date === 'string' ? new Date(b.Date) : b.Date
      return ad.getTime() - bd.getTime()
    })
  } catch (error) {
    console.error('❌ Error in get_upcoming_program:', error)
    throw error
  }
}

/**
 * Convert sheet key to ProgramsTypes enum value
 */
function sheetKeyToProgramType(sheetKey: ProgramTypeKeys): ProgramsTypes {
  switch (sheetKey) {
    case 'memorial':
      return ProgramsTypes.memorial
    case 'sundaySchool':
      return ProgramsTypes.sundaySchool
    case 'bibleClass':
      return ProgramsTypes.bibleClass
    case 'cyc':
      return ProgramsTypes.cyc
    default:
      return sheetKey as unknown as ProgramsTypes
  }
}
