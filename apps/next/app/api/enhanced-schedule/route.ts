import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import type { GoogleSheetTypes, GoogleSheetData } from '@my/app/types'
import type { EnhancedScheduleEvent } from '@my/ui/src/data-table/enhanced-schedule-responsive'
import type { ScheduleTab } from '@my/ui/src/data-table/schedule-tabs'

// Configuration for schedule types (excluding directory)
const SCHEDULE_CONFIG: Record<
  Exclude<GoogleSheetTypes, 'directory'>,
  {
    name: string
    defaultTime: string
    location: string
  }
> = {
  memorial: {
    name: 'Memorial Service',
    defaultTime: '11:00 AM',
    location: 'Main Hall',
  },
  bibleClass: {
    name: 'Bible Class',
    defaultTime: '7:30 PM',
    location: 'Fellowship Hall',
  },
  sundaySchool: {
    name: 'Sunday School',
    defaultTime: '9:30 AM',
    location: 'Classroom A',
  },
  cyc: {
    name: 'CYC',
    defaultTime: '6:30 PM',
    location: 'Youth Room',
  },
}

// Check if date is invalid or corrupted
function isInvalidDate(date: Date): boolean {
  // Check if date is NaN
  if (isNaN(date.getTime())) {
    return true
  }

  // Check for Excel epoch date (1899-12-30)
  if (date.getFullYear() === 1899 && date.getMonth() === 11 && date.getDate() === 30) {
    return true
  }

  // Check for dates before 1900 (likely corrupted)
  if (date.getFullYear() < 1900) {
    return true
  }

  // Check for dates too far in the future (likely corrupted)
  if (date.getFullYear() > 2050) {
    return true
  }

  return false
}

// Filter events by date range
function filterEventsByDateRange(
  events: EnhancedScheduleEvent[],
  fromDate: string,
  toDate?: string,
  limit: number = 50,
  offset: number = 0,
  sortOrder: 'asc' | 'desc' = 'asc'
): { events: EnhancedScheduleEvent[]; hasMore: boolean; total: number } {
  // Filter by date range
  console.log('Filtering events with:', { fromDate, toDate, sortOrder, totalEvents: events.length })
  const filteredEvents = events.filter((event) => {
    const eventDate = event.date
    if (fromDate && eventDate < fromDate) return false
    // For older events (desc order), use strict less than to exclude the boundary date
    if (toDate) {
      if (sortOrder === 'desc') {
        if (eventDate >= toDate) return false // Exclude events on or after the boundary
      } else {
        if (eventDate > toDate) return false // Include events on the boundary for future loads
      }
    }
    return true
  })

  console.log('After filtering:', {
    filteredCount: filteredEvents.length,
    sampleDates: filteredEvents.slice(0, 5).map((e) => e.date),
  })

  // Sort by date (ascending or descending)
  if (sortOrder === 'desc') {
    filteredEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } else {
    filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  // Apply pagination
  const total = filteredEvents.length
  const paginatedEvents = filteredEvents.slice(offset, offset + limit)
  const hasMore = offset + limit < total

  return {
    events: paginatedEvents,
    hasMore,
    total,
  }
}

// Transform Google Sheets data to Enhanced Table format with dynamic fields
function transformScheduleData(
  sheetData: GoogleSheetData,
  currentUser?: string | null,
  allScheduleData?: Record<string, any[]>
): EnhancedScheduleEvent[] {
  const config = SCHEDULE_CONFIG[sheetData.type as Exclude<GoogleSheetTypes, 'directory'>]
  if (!config) return []

  return sheetData.content
    .map((row: any, index: number) => {
      const date = new Date(row.Date || row.date)

      // Skip invalid/corrupted dates (Excel epoch date and other invalid dates)
      if (isInvalidDate(date)) {
        return null
      }

      const formattedDate = date.toISOString().split('T')[0]

      // Extract all person fields for this schedule type for user highlighting and conflict detection
      const personFields = extractPersonFields(
        row,
        sheetData.type as Exclude<GoogleSheetTypes, 'directory'>
      )

      // User highlighting - check if current user is involved in this event
      const userHighlight = currentUser
        ? personFields.some(
            (name) => name && name.toLowerCase().includes(currentUser.split('@')[0].toLowerCase())
          )
        : false

      // Next event logic - check if this is today or the next upcoming event (using Toronto timezone)
      const today = new Date()
      const eventDate = new Date(date)

      // Convert to Toronto timezone for proper date comparison
      const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
      const torontoEventDate = new Date(
        eventDate.toLocaleString('en-US', { timeZone: 'America/Toronto' })
      )

      const isToday = torontoEventDate.toDateString() === torontoToday.toDateString()
      const isUpcoming =
        torontoEventDate >= torontoToday &&
        torontoEventDate <= new Date(torontoToday.getTime() + 7 * 24 * 60 * 60 * 1000)
      const isNextEvent = isToday || (isUpcoming && index === 0)

      // Conflict detection - check if user has multiple responsibilities on same date
      const hasConflict =
        currentUser && allScheduleData
          ? checkForScheduleConflicts(formattedDate, currentUser, allScheduleData)
          : false

      // Create base event with dynamic fields based on schedule type
      const event: any = {
        id: `${sheetData.type}-${formattedDate}-${index}`,
        date: formattedDate,
        time: row.Time || config.defaultTime,
        event: row.Event || config.name,
        location: row.Location || config.location,
        type: sheetData.type as EnhancedScheduleEvent['type'],
        isNextEvent,
        hasConflict,
        userHighlight,
      }

      // Add schedule-specific fields
      addScheduleSpecificFields(
        event,
        row,
        sheetData.type as Exclude<GoogleSheetTypes, 'directory'>
      )

      return event
    })
    .filter((event) => {
      // Filter out null entries and events without valid dates
      if (!event || !event.date) return false

      // Filter out events that are essentially empty (no meaningful data)
      const scheduleType = sheetData.type as Exclude<GoogleSheetTypes, 'directory'>

      switch (scheduleType) {
        case 'memorial':
          // Memorial must have at least one person assigned
          return !!(
            event.Preside ||
            event.Exhort ||
            event.Organist ||
            event.Steward ||
            event.Doorkeeper
          )

        case 'bibleClass':
          // Bible class must have presider or speaker
          return !!(event.Presider || event.Speaker)

        case 'sundaySchool':
          // Sunday school must have refreshments assigned
          return !!event.Refreshments

        case 'cyc':
          // CYC must have speaker or topic
          return !!(event.speaker || event.topic)

        default:
          return true
      }
    }) // Filter out null entries and events without valid dates
}

// Extract person fields for user highlighting based on schedule type
function extractPersonFields(
  row: any,
  scheduleType: Exclude<GoogleSheetTypes, 'directory'>
): string[] {
  switch (scheduleType) {
    case 'memorial':
      return [
        row.Preside || '',
        row.Exhort || '',
        row.Organist || '',
        row.Steward || '',
        row.Doorkeeper || '',
      ].filter(Boolean)

    case 'bibleClass':
      return [row.Presider || '', row.Speaker || ''].filter(Boolean)

    case 'sundaySchool':
      return [row.Refreshments || ''].filter(Boolean)

    case 'cyc':
      return [row.speaker || row.Speaker || ''].filter(Boolean)

    default:
      return []
  }
}

// Add schedule-specific fields to the event object
function addScheduleSpecificFields(
  event: any,
  row: any,
  scheduleType: Exclude<GoogleSheetTypes, 'directory'>
): void {
  switch (scheduleType) {
    case 'memorial':
      event.Preside = row.Preside || ''
      event.Exhort = row.Exhort || ''
      event.Organist = row.Organist || ''
      event.Steward = row.Steward || ''
      event.Doorkeeper = row.Doorkeeper || ''
      // Secondary information for memorial
      event.Lunch = row.Lunch || row.lunch || ''
      event.Activities = row.Activities || row.activities || ''
      break

    case 'bibleClass':
      event.Presider = row.Presider || ''
      event.Speaker = row.Speaker || ''
      // Secondary information for bible class
      event.Topic = row.Topic || row.topic || ''
      break

    case 'sundaySchool':
      event.Refreshments = row.Refreshments || ''
      // Sunday School doesn't use secondary rows currently
      break

    case 'cyc':
      event.speaker = row.speaker || row.Speaker || ''
      event.topic = row.topic || row.Topic || ''
      event.location = row.location || row.Location || ''
      // CYC already shows topic in main row, no secondary info needed
      break
  }
}

// Check for scheduling conflicts across all schedule types
function checkForScheduleConflicts(
  date: string,
  currentUser: string,
  allScheduleData: Record<string, any[]>
): boolean {
  const userEmail = currentUser.split('@')[0].toLowerCase()
  let involvementCount = 0

  Object.values(allScheduleData).forEach((scheduleArray) => {
    scheduleArray.forEach((event) => {
      if (event.date === date) {
        const names = [event.presider, event.speaker, event.steward].filter(Boolean)
        if (names.some((name) => name.toLowerCase().includes(userEmail))) {
          involvementCount++
        }
      }
    })
  })

  return involvementCount > 1
}

// Generate tabs configuration from available schedule types
function generateTabs(availableTypes: Exclude<GoogleSheetTypes, 'directory'>[]): ScheduleTab[] {
  return availableTypes.map((type) => ({
    id: type,
    name: SCHEDULE_CONFIG[type]?.name || type,
    key: type,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get requested schedule types (default to memorial only for focused experience)
    const requestedTypes = (searchParams.get('types')?.split(',') as Exclude<
      GoogleSheetTypes,
      'directory'
    >[]) || ['memorial']

    // Get date range parameters for infinite scroll
    const fromDate = searchParams.get('fromDate') || new Date().toISOString().split('T')[0] // Default to today
    const toDate = searchParams.get('toDate') // Optional end date
    const limit = parseInt(searchParams.get('limit') || '50') // Default 50 events per request
    const offset = parseInt(searchParams.get('offset') || '0') // For pagination
    const sortOrder = searchParams.get('sortOrder') || 'asc' // 'asc' or 'desc'

    console.log('API called with params:', { fromDate, toDate, limit, offset, sortOrder })

    // Get current user session (optional - schedules are public)
    let currentUser: string | null = null
    try {
      const session = await auth()
      currentUser = session?.user?.email || null
    } catch (error) {
      // Authentication is optional for schedule viewing
      console.log('No authentication session found (this is ok)')
    }

    // Initialize schedule service
    const scheduleService = new ScheduleService()

    // Fetch all requested schedule data
    const schedulePromises = requestedTypes.map(async (type) => {
      try {
        // Check if DynamoDB data is fresh (within 60 minutes)
        const isDataFresh = await scheduleService.isDataFresh(type, 60)

        let data: GoogleSheetData | null

        if (!isDataFresh) {
          // Fallback to Google Sheets
          const { get_google_sheet } = await import('../../../utils/get-google-sheets')
          data = await get_google_sheet(type)
        } else {
          // Fetch from DynamoDB cache
          data = await scheduleService.getScheduleData(type)
        }

        return { type, data }
      } catch (error) {
        console.error(`Error fetching ${type} schedule:`, error)
        return { type, data: null }
      }
    })

    const scheduleResults = await Promise.all(schedulePromises)

    // Transform data for Enhanced Table format
    const transformedData: Record<string, EnhancedScheduleEvent[]> = {}
    const allScheduleData: Record<string, any[]> = {}

    // First pass: transform all data
    scheduleResults.forEach(({ type, data }) => {
      if (data) {
        const transformed = transformScheduleData(data, currentUser)
        transformedData[type] = transformed
        allScheduleData[type] = transformed
      } else {
        transformedData[type] = []
        allScheduleData[type] = []
      }
    })

    // Second pass: update conflict detection with full dataset
    Object.keys(transformedData).forEach((type) => {
      transformedData[type] = transformedData[type].map((event) => ({
        ...event,
        hasConflict: currentUser
          ? checkForScheduleConflicts(event.date, currentUser, allScheduleData)
          : false,
      }))
    })

    // Apply date filtering and pagination to each schedule type
    const filteredData: Record<string, EnhancedScheduleEvent[]> = {}
    let totalEvents = 0
    let hasMoreEvents = false

    Object.keys(transformedData).forEach((type) => {
      const filtered = filterEventsByDateRange(
        transformedData[type],
        fromDate,
        toDate || undefined,
        limit,
        offset,
        sortOrder as 'asc' | 'desc'
      )

      filteredData[type] = filtered.events
      totalEvents += filtered.total
      hasMoreEvents = hasMoreEvents || filtered.hasMore
    })

    // Generate tabs for available data
    const availableTypes = scheduleResults
      .filter(({ data }) => data && data.content.length > 0)
      .map(({ type }) => type)

    const tabs = generateTabs(availableTypes)

    // Check if more historical data is available beyond what we've loaded
    const today = new Date().toISOString().split('T')[0]
    let hasMoreHistoricalData = false

    if (sortOrder === 'desc') {
      // For older event requests, check if we have more historical data for the specific requested types
      const returnedAnyEvents = Object.values(filteredData).some((events) => events.length > 0)

      if (returnedAnyEvents) {
        // Find the earliest date we just returned across requested types
        const allReturnedEvents = Object.values(filteredData).flat()
        if (allReturnedEvents.length > 0) {
          const earliestReturnedDate = allReturnedEvents.reduce(
            (earliest, event) => (event.date < earliest ? event.date : earliest),
            allReturnedEvents[0].date
          )

          // Check if there are events in the requested types that are older than what we just returned
          hasMoreHistoricalData = requestedTypes.some(
            (type) =>
              transformedData[type] &&
              transformedData[type].some((event) => event.date < earliestReturnedDate)
          )
        }
      }
    } else {
      // For initial/future requests, check if historical data exists for the requested types
      hasMoreHistoricalData = requestedTypes.some(
        (type) => transformedData[type] && transformedData[type].some((event) => event.date < today)
      )
    }

    // Response data
    const responseData = {
      tabs,
      data: filteredData,
      currentUser,
      lastUpdated: new Date().toISOString(),
      dataSource: 'dynamodb-with-google-sheets-fallback',
      totalEvents,
      hasMore: hasMoreEvents,
      hasOlder: hasMoreHistoricalData, // Show when more historical data is available
      pagination: {
        fromDate,
        toDate,
        limit,
        offset,
        sortOrder,
        currentCount: Object.values(filteredData).reduce((sum, events) => sum + events.length, 0),
      },
    }

    // Set cache headers
    const response = NextResponse.json(responseData)
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600') // 5min client, 10min CDN
    response.headers.set('X-Data-Source', 'enhanced-schedule-api')
    response.headers.set('X-Schedule-Source', 'dynamodb-with-fallback')

    return response
  } catch (error) {
    console.error('Enhanced Schedule API Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch schedule data',
        message: error instanceof Error ? error.message : 'Unknown error',
        tabs: [],
        data: {},
        currentUser: null,
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
