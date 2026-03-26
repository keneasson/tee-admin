import { unstable_cache } from 'next/cache'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { resolveServiceTime } from '@my/app/config/service-time-resolver'
import type { ScheduleTypeKey } from '@my/app/config/schedule-fields'
import { getEcclesiaByName } from './dynamodb/locations'
import type { GoogleSheetTypes, GoogleSheetData } from '@my/app/types'
import type { EnhancedScheduleEvent } from '@my/ui/src/data-table/enhanced-schedule-responsive'
import { CACHE_TAGS } from './cache'

// ── Helpers ──

// Map Google Sheet type names to schedule type keys
const SHEET_TO_SCHEDULE_KEY: Record<string, ScheduleTypeKey> = {
  memorial: 'memorial',
  bibleClass: 'bibleClass',
  sundaySchool: 'sundaySchool',
  cyc: 'cyc',
}

function getScheduleConfig(type: Exclude<GoogleSheetTypes, 'directory'>, scheduleConfig?: Record<string, any>) {
  const typeKey = SHEET_TO_SCHEDULE_KEY[type]
  if (!typeKey) return { name: type, defaultTime: '', location: '' }
  const resolved = resolveServiceTime(scheduleConfig, typeKey)
  return { name: resolved.name, defaultTime: resolved.displayTime, location: resolved.location }
}

function isInvalidDate(date: Date): boolean {
  if (isNaN(date.getTime())) return true
  if (date.getFullYear() < 1900 || date.getFullYear() > 2050) return true
  if (date.getFullYear() === 1899 && date.getMonth() === 11 && date.getDate() === 30) return true
  return false
}

function addScheduleSpecificFields(event: any, row: any, type: string): void {
  switch (type) {
    case 'memorial':
      event.Preside = row.Preside || ''
      event.Exhort = row.Exhort || ''
      event.Organist = row.Organist || ''
      event.Steward = row.Steward || ''
      event.Doorkeeper = row.Doorkeeper || ''
      event.Lunch = row.Lunch || row.lunch || ''
      event.Activities = row.Activities || row.activities || ''
      break
    case 'bibleClass':
      event.Presider = row.Presider || ''
      event.Speaker = row.Speaker || ''
      event.Topic = row.Topic || row.topic || ''
      if (row.MetaData) event.MetaData = row.MetaData
      if (row.Host) event.Host = row.Host
      if (row.ZoomURL) event.ZoomURL = row.ZoomURL
      if (row.MeetingID) event.MeetingID = String(row.MeetingID)
      if (row.MeetingPwd) event.MeetingPwd = String(row.MeetingPwd)
      if (row.InPerson) event.InPerson = row.InPerson
      break
    case 'sundaySchool':
      event.Refreshments = row.Refreshments || ''
      break
    case 'cyc':
      event.speaker = row.speaker || row.Speaker || ''
      event.topic = row.topic || row.Topic || ''
      event.location = row.location || row.Location || ''
      break
  }
}

function isValidRow(event: any, type: string): boolean {
  switch (type) {
    case 'memorial':
      return !!(event.Preside || event.Exhort || event.Organist || event.Steward || event.Doorkeeper)
    case 'bibleClass':
      return !!(event.Presider?.trim() || event.Speaker?.trim() || event.Host?.trim())
    case 'sundaySchool':
      return !!event.Refreshments
    case 'cyc':
      return !!(event.speaker || event.topic)
    default:
      return true
  }
}

function transformSheet(sheetData: GoogleSheetData): EnhancedScheduleEvent[] {
  const config = getScheduleConfig(sheetData.type as Exclude<GoogleSheetTypes, 'directory'>)
  if (!config.name) return []

  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))

  return sheetData.content
    .map((row: any, index: number) => {
      const date = new Date(row.Date || row.date)
      if (isInvalidDate(date)) return null

      const formattedDate = date.toISOString().split('T')[0]
      const eventDate = new Date(date)
      const torontoEvent = new Date(eventDate.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
      const isToday = torontoEvent.toDateString() === torontoToday.toDateString()
      const isUpcoming = torontoEvent >= torontoToday && torontoEvent <= new Date(torontoToday.getTime() + 7 * 86400000)

      const event: any = {
        id: `${sheetData.type}-${formattedDate}-${index}`,
        date: formattedDate,
        time: row.Time || config.defaultTime,
        event: row.Event || config.name,
        location: row.Location || config.location,
        type: sheetData.type as EnhancedScheduleEvent['type'],
        isNextEvent: isToday || (isUpcoming && index === 0),
        hasConflict: false,
        userHighlight: false,
      }

      addScheduleSpecificFields(event, row, sheetData.type as string)
      return event
    })
    .filter((e: any): e is EnhancedScheduleEvent => e !== null && e.date && isValidRow(e, sheetData.type as string))
}

// ── Core fetch (not cached — called inside unstable_cache wrappers) ──

async function fetchScheduleTab(tab: string): Promise<{
  events: EnhancedScheduleEvent[]
  hasOlder: boolean
  lastUpdated: string
}> {
  const scheduleService = new ScheduleService()
  const data = await scheduleService.getScheduleData(tab as any)

  if (!data?.content) {
    return { events: [], hasOlder: false, lastUpdated: new Date().toISOString() }
  }

  let events = transformSheet(data)

  // Resolve ecclesia addresses for joint Bible classes
  if (tab === 'bibleClass') {
    for (const event of events) {
      if (event.Host && event.InPerson === 'Yes') {
        try {
          const ecclesia = await getEcclesiaByName(event.Host)
          if (ecclesia) {
            if (ecclesia.venue) event.resolvedVenue = ecclesia.venue
            // Avoid duplicating city if it's already in the address
            const addressIncludesCity = ecclesia.address && ecclesia.city &&
              ecclesia.address.toLowerCase().includes(ecclesia.city.toLowerCase())
            const parts = [
              ecclesia.address,
              addressIncludesCity ? null : ecclesia.city,
              ecclesia.province,
              ecclesia.postalCode,
            ].filter(Boolean)
            event.resolvedAddress = parts.join(', ')
            if (event.resolvedAddress) {
              event.resolvedMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.resolvedAddress)}`
            }
          }
        } catch (err) {
          console.warn(`⚠️ Failed to resolve address for "${event.Host}":`, err)
        }
      } else if (event.Host && event.InPerson && event.InPerson !== 'Yes') {
        event.resolvedAddress = event.InPerson
        event.resolvedMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.InPerson)}`
      }
    }
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Filter to today onwards (Toronto timezone)
  const now = new Date()
  const torontoToday = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const todayStr = torontoToday.toISOString().split('T')[0]

  const futureEvents = events.filter((e) => e.date >= todayStr)
  const hasOlder = futureEvents.length < events.length

  return { events: futureEvents, hasOlder, lastUpdated: data.lastUpdated || new Date().toISOString() }
}

// ── Cached variants — one per tab for independent invalidation ──

const cacheOptions = (tag: string) => ({
  tags: [tag, CACHE_TAGS.SCHEDULES_ALL, CACHE_TAGS.ALL_SCHEDULE_DATA],
  revalidate: 300, // 5 min fallback
})

export const getMemorialData = unstable_cache(
  () => fetchScheduleTab('memorial'),
  ['schedule', 'memorial'],
  cacheOptions(CACHE_TAGS.SCHEDULES_MEMORIAL)
)

export const getBibleClassData = unstable_cache(
  () => fetchScheduleTab('bibleClass'),
  ['schedule', 'bibleClass'],
  cacheOptions(CACHE_TAGS.SCHEDULES_BIBLE_CLASS)
)

export const getSundaySchoolData = unstable_cache(
  () => fetchScheduleTab('sundaySchool'),
  ['schedule', 'sundaySchool'],
  cacheOptions(CACHE_TAGS.SCHEDULES_SUNDAY_SCHOOL)
)

export const getCycData = unstable_cache(
  () => fetchScheduleTab('cyc'),
  ['schedule', 'cyc'],
  cacheOptions(CACHE_TAGS.SCHEDULES_CYC)
)

/** Server-callable: get cached schedule data for a tab */
export async function getScheduleData(tab: string) {
  switch (tab) {
    case 'memorial': return getMemorialData()
    case 'bibleClass': return getBibleClassData()
    case 'sundaySchool': return getSundaySchoolData()
    case 'cyc': return getCycData()
    default: return getMemorialData()
  }
}
