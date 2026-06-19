import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { convertHumanReadableDate } from './date'
import { formatScheduleDateForEmail } from '@my/app/utils/timezone'

import { ProgramsTypes } from '@my/app/types'
import type { BibleClassType, ProgramTypeKeys, ProgramTypes } from '@my/app/types'
import { getEcclesiaByName } from './dynamodb/locations'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { resolveTenantFromEnv } from '@my/app/config/tenants'
import {
  fetchServiceOverrides,
  applyOverrideToProgramItem,
  normalizeToISODate,
  overrideKey,
} from '@my/app/utils/service-overrides/merge'
import type { ServiceOverrideType } from '@my/app/provider/dynamodb/service-override-types'

/**
 * Get upcoming program events from DynamoDB
 * Returns the next 2 events for each schedule type, sorted by date
 *
 * Data flow: Google Sheets → DynamoDB sync → This function
 * YouTube URLs are added to memorial services via YouTube API sync (separate process)
 */
export async function get_upcoming_program(
  orderOfKeys: ProgramTypeKeys[]
): Promise<ProgramTypes[]> {
  try {
    console.log('📅 Fetching upcoming program from DynamoDB')
    const scheduleService = new ScheduleService()

    // CRITICAL FIX: Compare dates at midnight, not including time
    // This ensures events scheduled for TODAY are included even if the email
    // is sent after midnight (e.g., Bible class email sent Wednesday morning
    // should include Wednesday's Bible class, not skip to next week)
    const NOW = new Date()
    const TODAY_MIDNIGHT = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())

    const upcoming: ProgramTypes[] = []

    for (const sheetKey of orderOfKeys) {
      try {
        // Get schedule data from DynamoDB
        const scheduleData = await scheduleService.getScheduleData(sheetKey as 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc')

        if (!scheduleData || !scheduleData.content) {
          console.warn(`⚠️ No ${sheetKey} schedule data found in DynamoDB`)
          continue
        }

        // Filter to upcoming events (including today) and take the next 2
        const upcomingEvents = scheduleData.content
          .filter((event: any) => {
            const eventDate = new Date(event.Date || event.date)
            // Compare at midnight to include events scheduled for today
            const eventDateMidnight = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
            return !isNaN(eventDate.getTime()) && eventDateMidnight.getTime() >= TODAY_MIDNIGHT.getTime()
          })
          .slice(0, 2) // Take next 2 events

        // Convert to ProgramTypes format
        for (const event of upcomingEvents) {
          const eventDate = new Date(event.Date || event.date)
          const programType = sheetKeyToProgramType(sheetKey)

          // Use timezone-aware formatting if DateTime is available
          // Otherwise fall back to UTC-based date formatting
          const formattedDate = event.DateTime
            ? formatScheduleDateForEmail(event.DateTime, undefined, event.ServiceTimezone)
            : convertHumanReadableDate(eventDate)

          // Log YouTube URL for memorial services (debug)
          if (sheetKey === 'memorial' && event.YouTube) {
            console.log(`📺 Memorial ${formattedDate} has YouTube URL: ${event.YouTube}`)
          } else if (sheetKey === 'memorial') {
            console.log(`📺 Memorial ${formattedDate} - NO YouTube URL`)
          }

          upcoming.push({
            ...event,
            Date: formattedDate,
            Key: programType,
            // Preserve timezone fields for downstream consumers
            DateTime: event.DateTime,
            ServiceTimezone: event.ServiceTimezone,
            // Stable UTC date key for per-occurrence override matching
            occurrenceDate: normalizeToISODate(event.Date || event.DateTime),
          } as ProgramTypes)
        }

        // Resolve host ecclesia address for joint Bible classes
        if (sheetKey === 'bibleClass') {
          for (const item of upcoming) {
            const bc = item as BibleClassType
            if (bc.Key !== ProgramsTypes.bibleClass || !bc.Host) continue
            if (bc.InPerson === 'Yes') {
              try {
                const ecclesia = await getEcclesiaByName(bc.Host)
                if (ecclesia) {
                  if (ecclesia.venue) bc.resolvedVenue = ecclesia.venue
                  // Avoid duplicating city if it's already in the address
                  const addressIncludesCity = ecclesia.address && ecclesia.city &&
                    ecclesia.address.toLowerCase().includes(ecclesia.city.toLowerCase())
                  const parts = [
                    ecclesia.address,
                    addressIncludesCity ? null : ecclesia.city,
                    ecclesia.province,
                    ecclesia.postalCode,
                  ].filter(Boolean)
                  bc.resolvedAddress = parts.join(', ')
                  if (bc.resolvedAddress) {
                    bc.resolvedMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bc.resolvedAddress)}`
                  }
                } else {
                  console.warn(`⚠️ Ecclesia "${bc.Host}" not found for address resolution`)
                }
              } catch (err) {
                console.warn(`⚠️ Failed to resolve address for "${bc.Host}":`, err)
              }
            } else if (bc.InPerson && bc.InPerson !== 'Yes') {
              // InPerson contains the full address directly
              bc.resolvedAddress = bc.InPerson
              bc.resolvedMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bc.InPerson)}`
            }
          }
        }

        console.log(`✅ Found ${upcomingEvents.length} upcoming ${sheetKey} events`)
      } catch (error) {
        console.error(`❌ Error fetching ${sheetKey} from DynamoDB:`, error)
        // Continue with other schedule types
      }
    }

    // Apply per-occurrence overrides (cancel / custom message / note / attend-options).
    // Single chokepoint — this propagates to recap, bible-class, and newsletter emails.
    const occurrenceDates = upcoming.map((e) => e.occurrenceDate || '').filter(Boolean)
    const sortedDates = [...occurrenceDates].sort()
    if (sortedDates.length > 0) {
      const serviceTypes = Array.from(new Set(upcoming.map((e) => e.Key))) as ServiceOverrideType[]
      const overrides = await fetchServiceOverrides(
        resolveTenantFromEnv().homeEcclesiaName ?? HOME_ECCLESIA.canonicalName,
        serviceTypes,
        sortedDates[0],
        sortedDates[sortedDates.length - 1]
      )
      for (const item of upcoming) {
        applyOverrideToProgramItem(
          item,
          overrides.get(overrideKey(item.Key, item.occurrenceDate || ''))
        )
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
