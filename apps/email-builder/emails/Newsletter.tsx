import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components'
import { columnAlignTop, container, defaultText, globalCss, header, link, main, program } from '../styles'
import React from 'react'
import { BibleClassType, MemorialServiceType, ProgramsTypes, SundaySchoolType } from '@my/app/types'
import { Event } from '@my/app/types/events'
import { Footer } from '../components/Footer'
import { AutoLinkText } from '../components/AutoLinkText'

type SundayEvents = MemorialServiceType &
  Pick<SundaySchoolType, 'Refreshments' | 'Holidays and Special Events'>
// Mock data uses same format as convertHumanReadableDate: "Weekday, Month Day, Year"
const mockEvents: SundayEvents[] | BibleClassType[] = [
  // Sunday School for Feb 25 (Sunday)
  {
    Key: ProgramsTypes.sundaySchool,
    Date: 'Sunday, February 25, 2024',
    Refreshments: 'Eassons',
    'Holidays and Special Events': undefined,
  } as any,
  // Memorial for Feb 25 (Sunday)
  {
    Key: ProgramsTypes.memorial,
    Date: 'Sunday, February 25, 2024',
    Preside: 'Presiding Brother',
    Exhort: 'Exhorting Brother',
    Organist: 'Keyboard Player',
    Steward: 'Hall Steward',
    Doorkeeper: 'Door Keeper',
    Collection: 'Collection',
    Lunch: 'a lunch will be served',
    Reading1: 'Reading 1',
    Reading2: 'Reading 2',
    'Hymn-opening': '111',
    'Hymn-exhortation': '222',
    'Hymn-memorial': '333',
    'Hymn-closing': '444',
    YouTube: 'The Youtube Link',
    Refreshments: 'Eassons',
    'Holidays and Special Events': undefined,
  },
  // Bible Class for Feb 28 (Wednesday)
  {
    Key: ProgramsTypes.bibleClass,
    Date: 'Wednesday, February 28, 2024',
    Presider: 'Presiding',
    Speaker: 'Speaker',
    Topic: 'Bible Class Topic',
  },
  // Sunday School for Mar 3 (Sunday)
  {
    Key: ProgramsTypes.sundaySchool,
    Date: 'Sunday, March 3, 2024',
    Refreshments: 'Johnson Family',
    'Holidays and Special Events': 'Toronto Fraternal Gathering',
  } as any,
  // Memorial for Mar 3 (Sunday)
  {
    Key: ProgramsTypes.memorial,
    Date: 'Sunday, March 3, 2024',
    Preside: 'Presiding Bro 2',
    Exhort: 'Exhort Bro 2',
    Organist: 'Keyboardist',
    Steward: 'Hall Steward 2',
    Doorkeeper: 'Door Keeper 2',
    Collection: '',
    Lunch: 'no lunch will be served',
    Reading1: 'Reading 1',
    Reading2: 'Reading 2',
    'Hymn-opening': '',
    'Hymn-exhortation': '',
    'Hymn-memorial': '',
    'Hymn-closing': '',
    YouTube: 'The Youtube Link',
    Refreshments: 'Johnson Family',
    'Holidays and Special Events': 'Toronto Fraternal Gathering',
  },
  // Bible Class for Mar 6 (Wednesday)
  {
    Key: ProgramsTypes.bibleClass,
    Date: 'Wednesday, March 6, 2024',
    Presider: 'Presiding 2',
    Speaker: 'Speaker 2',
    Topic: 'Bible Class Topic 2',
  },
]

// Mock Events for all supported event types
const mockUpcomingEvents: Event[] = [
  // Study Weekend
  {
    id: 'sw-001',
    title: 'Toronto East Study Weekend',
    type: 'study-weekend',
    status: 'published',
    published: true,
    description:
      'Join us for a weekend of spiritual fellowship and Bible study focused on the life and ministry of Jesus Christ.',
    theme: 'The Groups Jesus Worked With',
    dateRange: {
      start: '2024-10-11T00:00:00Z',
      end: '2024-10-12T23:59:59Z',
    },
    speakers: [
      {
        title: 'Bro.',
        firstName: 'John',
        lastName: 'Smith',
        ecclesia: 'Toronto East',
      },
      {
        title: 'Bro.',
        firstName: 'David',
        lastName: 'Wilson',
        ecclesia: 'Hamilton',
      },
    ],
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada',
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: [
      {
        id: 'doc-001',
        fileName: 'study-weekend-flyer.pdf',
        originalName: 'Study Weekend Flyer.pdf',
        fileUrl: 'https://example.com/study-weekend-flyer.pdf',
        fileSize: 1024000,
        mimeType: 'application/pdf',
        uploadedAt: new Date('2024-01-10'),
        uploadedBy: 'admin@tee.com',
      },
    ],
  } as any,

  // Wedding
  {
    id: 'w-001',
    title: 'Wedding Celebration',
    type: 'wedding',
    status: 'published',
    published: true,
    description: 'Join us in celebrating the marriage of our beloved brother and sister in Christ.',
    ceremonyDate: '2024-03-15T14:00:00Z',
    couple: {
      bride: {
        firstName: 'Sarah',
        lastName: 'Johnson',
      },
      groom: {
        firstName: 'Michael',
        lastName: 'Thompson',
      },
    },
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada',
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: [],
  } as any,

  // Baptism
  {
    id: 'b-001',
    title: 'Baptism Service',
    type: 'baptism',
    status: 'published',
    published: true,
    description: 'Rejoice with us as our sister is baptized into Christ.',
    baptismDate: '2024-02-25T11:00:00Z',
    candidate: {
      firstName: 'Emily',
      lastName: 'Davis',
    },
    aboutCandidate:
      'Sister Emily Davis has been attending Toronto East for two years and has made a good confession of faith. She is looking forward to walking in the Truth and serving the Lord.',
    location: {
      name: 'Toronto East Christadelphian Ecclesia',
      address: '975 Cosburn Avenue',
      city: 'Toronto',
      province: 'ON',
    },
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada',
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: [],
  } as any,

  // Funeral
  {
    id: 'f-001',
    title: 'Memorial Service',
    type: 'funeral',
    status: 'published',
    published: true,
    description: 'Join us in remembering the life and faith of our beloved brother.',
    serviceDate: '2024-04-08T14:00:00Z',
    deceased: {
      firstName: 'Robert',
      lastName: 'Anderson',
    },
    aboutDeceased:
      'Brother Robert Anderson fell asleep in the Lord on April 1, 2024. He was baptized in 1975 and served faithfully as a brother at Toronto East for nearly 50 years. He is survived by his wife, Sister Mary, and their three children.',
    locations: {
      service: {
        name: 'Toronto North Christadelphian Ecclesia',
        address: '123 Church Street',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 2K1',
      },
    },
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada',
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: [],
  } as any,

  // General Event
  {
    id: 'g-001',
    title: 'Ecclesial Picnic',
    type: 'general',
    status: 'published',
    published: true,
    description:
      'Annual summer picnic for all members and families. Bring your favorite dish to share!',
    startDate: '2024-06-22T12:00:00Z',
    endDate: '2024-06-22T17:00:00Z',
    location: {
      name: 'High Park',
      address: '1873 Bloor St W, Toronto, ON',
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: [],
  } as any,

  // Recurring Event
  {
    id: 'r-001',
    title: 'Weekly Bible Reading Group',
    type: 'recurring',
    status: 'published',
    published: true,
    description: 'Join us every Wednesday evening for Bible reading and discussion.',
    recurringConfig: {
      frequency: 'weekly',
      daysOfWeek: [3], // Wednesday
      startDate: '2024-01-10T19:00:00Z',
      endDate: '2024-12-31T21:00:00Z',
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: [],
  } as any,
]

// Mock Bible Readings - proper structure with 3 readings per day
const mockReadings = [
  {
    date: new Date('2024-02-26'),
    reading1: 'Genesis 1-2',
    reading2: 'Matthew 1-2',
    reading3: 'Psalms 1-2',
  },
  {
    date: new Date('2024-02-27'),
    reading1: 'Genesis 3-4',
    reading2: 'Matthew 3-4',
    reading3: 'Psalms 3-4',
  },
  {
    date: new Date('2024-02-28'),
    reading1: 'Genesis 5-6',
    reading2: 'Matthew 5-6',
    reading3: 'Psalms 5-6',
  },
  {
    date: new Date('2024-02-29'),
    reading1: 'Genesis 7-8',
    reading2: 'Matthew 7-8',
    reading3: 'Psalms 7-8',
  },
  {
    date: new Date('2024-03-01'),
    reading1: 'Genesis 9-10',
    reading2: 'Matthew 9-10',
    reading3: 'Psalms 9-10',
  },
  {
    date: new Date('2024-03-02'),
    reading1: 'Genesis 11-12',
    reading2: 'Matthew 11-12',
    reading3: 'Psalms 11-12',
  },
  {
    date: new Date('2024-03-03'),
    reading1: 'Genesis 13-14',
    reading2: 'Matthew 13-14',
    reading3: 'Psalms 13-14',
  },
]

// Helper function to calculate next occurrence of a recurring event
function getNextRecurrenceDate(recurringConfig: any): Date | null {
  if (!recurringConfig || !recurringConfig.startDate) {
    return null
  }

  const startDate = new Date(recurringConfig.startDate)
  const today = new Date()
  const frequency = recurringConfig.frequency
  const daysOfWeek = recurringConfig.daysOfWeek || []

  // If it's weekly and has specific days
  if (frequency === 'weekly' && daysOfWeek.length > 0) {
    // Find the next occurrence for each day of the week
    const nextDates: Date[] = []

    daysOfWeek.forEach((dayOfWeek: number) => {
      // Start from today and find the next occurrence of this day
      let nextDate = new Date(today)
      const todayDayOfWeek = today.getDay()

      // Calculate days until the target day
      let daysUntilTarget = dayOfWeek - todayDayOfWeek
      if (daysUntilTarget <= 0) {
        daysUntilTarget += 7 // Next week
      }

      nextDate.setDate(today.getDate() + daysUntilTarget)

      // Set the time from the start date
      nextDate.setHours(startDate.getHours())
      nextDate.setMinutes(startDate.getMinutes())
      nextDate.setSeconds(0)
      nextDate.setMilliseconds(0)

      nextDates.push(nextDate)
    })

    // Return the earliest next date
    return nextDates.sort((a, b) => a.getTime() - b.getTime())[0]
  }

  // Add other frequency types here if needed (monthly, biweekly, etc.)

  return null
}

// Helper function to get first paragraph of text (for shortened display)
const getFirstParagraph = (text: string | undefined): string => {
  if (!text) return ''
  // Split by double newlines (paragraph breaks) and take the first one
  const paragraphs = text.split(/\n\n+/)
  return paragraphs[0]?.trim() || ''
}

// Helper function to group schedule items by day (extracting date from datetime)
const groupScheduleByDay = (schedule: any[] | undefined): { [key: string]: any[] } | null => {
  if (!schedule || schedule.length === 0) return null

  const dayGroups: { [key: string]: any[] } = {}

  schedule.forEach((item) => {
    let dayKey = item.day || 'Schedule'

    // If no explicit day but we have a datetime, extract the day from it
    const timeValue = item.time || item.startTime
    if (timeValue && timeValue.includes('T') && !item.day) {
      const date = new Date(timeValue)
      // Format as "Saturday March 7" for grouping - use Toronto timezone
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' })
      const monthName = date.toLocaleDateString('en-US', { month: 'long', timeZone: 'America/Toronto' })
      const dayOfMonth = date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/Toronto' })
      dayKey = `${dayName} ${monthName} ${dayOfMonth}`
    }

    if (!dayGroups[dayKey]) {
      dayGroups[dayKey] = []
    }
    dayGroups[dayKey].push(item)
  })

  // Sort the groups by date (earliest first)
  const sortedEntries = Object.entries(dayGroups).sort((a, b) => {
    const getFirstDate = (items: any[]) => {
      const timeValue = items[0]?.time || items[0]?.startTime
      if (timeValue && timeValue.includes('T')) {
        return new Date(timeValue).getTime()
      }
      return 0
    }
    return getFirstDate(a[1]) - getFirstDate(b[1])
  })

  return Object.fromEntries(sortedEntries)
}

// Helper function to format schedule time from datetime
const formatScheduleTime = (timeValue: string | undefined): string => {
  if (!timeValue) return ''

  if (timeValue.includes('T')) {
    const date = new Date(timeValue)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Toronto',
    }).toLowerCase().replace(' ', '')
  } else if (timeValue.includes('-')) {
    return timeValue.split('-')[0].trim()
  }
  return timeValue
}

// Helper function to convert newlines to <br/> tags for email-safe text wrapping
// This is more reliable than whiteSpace: 'pre-wrap' which has Outlook compatibility issues
const TextWithLineBreaks: React.FC<{ text: string }> = ({ text }) => {
  if (!text) return null
  const lines = text.split(/\n/)
  return (
    <>
      {lines.map((line, index) => (
        <React.Fragment key={index}>
          {line}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </>
  )
}

// Helper function to format time from Date object
// IMPORTANT: Times are stored as EST in the database, so we must format in Toronto timezone
const formatServiceTime = (date: Date | string | undefined): string => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  // Use Toronto timezone to match how times are stored (EST)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Toronto',
  }).toLowerCase().replace(' ', '')
}

// Helper function to format date for service details
const formatServiceDate = (date: Date | string | undefined): string => {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })
}

// Helper function to check if an election-cycle event is currently active
const isElectionActive = (event: Event): boolean => {
  if (event.type !== 'election-cycle') return false
  const electionEvent = event as any
  if (!electionEvent.electionStartDate || !electionEvent.electionEndDate) return false
  const now = new Date()
  const start = new Date(electionEvent.electionStartDate)
  const end = new Date(electionEvent.electionEndDate)
  return now >= start && now <= end
}

// Helper function to display event dates for different event types
// IMPORTANT: All dates are stored as EST, so we must format in Toronto timezone
const EventDateDisplay = (event: Event): string => {
  if (event.type === 'study-weekend' && event.dateRange) {
    const start = new Date(event.dateRange.start)
    const end = new Date(event.dateRange.end)
    const startStr = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Toronto',
    })

    if (end.getTime() !== start.getTime()) {
      const endStr = end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Toronto',
      })
      return `${startStr} to ${endStr} ${start.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Toronto' })}`
    } else {
      return `${startStr} ${start.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Toronto' })}`
    }
  } else if (event.type === 'wedding' && event.ceremonyDate) {
    const date = new Date(event.ceremonyDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    })
  } else if (event.type === 'baptism' && event.baptismDate) {
    const date = new Date(event.baptismDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    })
  } else if (event.type === 'engagement' && (event as any).engagementDate) {
    const date = new Date((event as any).engagementDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    })
  } else if (event.type === 'funeral' && event.serviceDate) {
    const date = new Date(event.serviceDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Toronto',
    })
  } else if ((event as any).startDate) {
    const startDate = new Date((event as any).startDate)
    const endDate = (event as any).endDate ? new Date((event as any).endDate) : null

    // Check if it's a one-day event (same year, month, day)
    const isSameDay =
      !endDate ||
      (startDate.getDate() === endDate.getDate() &&
        startDate.getMonth() === endDate.getMonth() &&
        startDate.getFullYear() === endDate.getFullYear())

    if (isSameDay) {
      // One-day event: Show date + time range if times are specified
      const startHasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0
      const endHasTime = endDate && (endDate.getHours() !== 0 || endDate.getMinutes() !== 0)

      if (startHasTime || endHasTime) {
        // Format time helper - use Toronto timezone since times are stored as EST
        const formatTime = (date: Date) => {
          return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/Toronto',
          }).toLowerCase().replace(' ', '')
        }

        const dateStr = startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/Toronto',
        })

        if (endDate && endHasTime) {
          return `${dateStr} ${formatTime(startDate)} to ${formatTime(endDate)}`
        } else if (startHasTime) {
          return `${dateStr} ${formatTime(startDate)}`
        } else {
          return dateStr
        }
      } else {
        // No time specified, just show date
        return startDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'America/Toronto',
        })
      }
    } else {
      // Multi-day event: Show date range
      const startStr = startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Toronto',
      })
      const endStr = endDate!.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Toronto',
      })
      return `${startStr} to ${endStr} ${startDate.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'America/Toronto' })}`
    }
  }
  return '' // Return empty string for events without dates - don't show "Date TBD"
}

// Format date for readings display (similar to the bible-readings-layout)
/**
 * Format date for readings display
 *
 * CRITICAL: Bible readings dates represent calendar dates, not specific moments.
 * Uses UTC methods to avoid timezone shift issues where midnight UTC becomes
 * the previous day in Toronto time.
 */
const formatReadingDate = (date: Date | string): string => {
  if (!date) return 'Date unavailable'

  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) return 'Invalid date'

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  // CRITICAL: Use UTC methods to get the correct calendar date
  // Local methods would shift midnight UTC to previous day in Toronto timezone
  const dayName = dayNames[dateObj.getUTCDay()]
  const monthName = monthNames[dateObj.getUTCMonth()]
  const day = dateObj.getUTCDate()

  return `${dayName}, ${monthName} ${day}`
}

interface EmailNewsletterProps {
  scheduleEvents?: (MemorialServiceType | BibleClassType | SundaySchoolType)[]
  upcomingEvents?: Event[]
  readings?: any[]
  note?: string
}

const Newsletter: React.FC<EmailNewsletterProps> = ({
  scheduleEvents,
  upcomingEvents = [],
  readings = [],
  note,
}) => {
  const todaysDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })
  const allScheduleEvents = scheduleEvents || mockEvents
  const allUpcomingEvents = upcomingEvents.length > 0 ? upcomingEvents : mockUpcomingEvents
  const allReadings = readings.length > 0 ? readings : mockReadings

  // Group schedule events by date
  const groupedByDate: { [date: string]: typeof allScheduleEvents } = {}
  allScheduleEvents.forEach((event) => {
    const eventDateStr = String(event.Date)
    if (!groupedByDate[eventDateStr]) {
      groupedByDate[eventDateStr] = []
    }
    groupedByDate[eventDateStr].push(event)
  })

  // Group upcoming events by type (exclude special events that have their own sections)
  const groupedEvents: { [key: string]: Event[] } = {}

  allUpcomingEvents.forEach((event) => {
    // Skip LTRTBE recurring event - it has its own dedicated section
    const isLTRTBE =
      event.type === 'recurring' &&
      (event.title?.toLowerCase().includes('learn to read the bible') ||
        event.title?.toLowerCase().includes('ltrtbe'))

    if (isLTRTBE) {
      return // Skip this event
    }

    // Skip baptism, wedding, engagement, funeral - they have their own "Special Announcements" section
    // Skip election-cycle - it triggers a special message, not displayed as an event
    if (
      event.type === 'baptism' ||
      event.type === 'wedding' ||
      event.type === 'engagement' ||
      event.type === 'funeral' ||
      event.type === 'election-cycle'
    ) {
      return // Skip - displayed in Special Announcements section or as special message
    }

    const eventType = event?.type || 'general'
    if (!groupedEvents[eventType]) {
      groupedEvents[eventType] = []
    }
    groupedEvents[eventType].push(event)
  })

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
        <style>{`
          /* Desktop table styles */
          .readings-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: #ffffff;
          }

          .readings-mobile {
            display: none;
          }

          /* Mobile stacking - phones */
          @media only screen and (max-width: 600px) {
            .readings-table {
              display: none !important;
            }

            .readings-mobile {
              display: block !important;
            }

            .mobile-card {
              background-color: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 6px;
              margin-bottom: 12px;
              padding: 12px;
            }

            .mobile-date {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 8px;
              color: #495057;
            }

            .mobile-reading {
              margin-bottom: 6px;
              font-size: 13px;
              line-height: 1.4;
            }

            .mobile-reading-label {
              font-weight: bold;
              color: #495057;
              display: inline-block;
              min-width: 80px;
            }
          }

          /* Medium tablets - keep table but smaller */
          @media only screen and (min-width: 601px) and (max-width: 800px) {
            .readings-table th,
            .readings-table td {
              padding: 8px 6px !important;
              font-size: 12px !important;
            }
          }
        `}</style>
      </Head>
      <Preview>Toronto East Christadelphian Ecclesia's Newsletter</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Newsletter</Heading>
          <Text style={defaultText}>{todaysDate}</Text>
          <Text style={defaultText}>
            This email is intended for Christadelphians and friends, whether we meet in person or on
            Zoom.
            <br />
            All plans are subject to God's will.
          </Text>
        </Section>

        {/* Optional Note Section */}
        {note && note.trim() && (
          <Section
            style={{
              backgroundColor: '#fff3cd',
              padding: '16px',
              marginTop: '20px',
              marginBottom: '20px',
              borderRadius: '4px',
            }}
          >
            <Text
              style={{
                ...defaultText,
                margin: '0 0 8px 0',
                fontWeight: 'bold',
              }}
            >
              Note:
            </Text>
            <Text
              style={{
                ...defaultText,
                margin: '0',
                whiteSpace: 'pre-wrap',
              }}
            >
              <AutoLinkText text={note} />
            </Text>
          </Section>
        )}

        {/* Regular Services Section */}
        {Object.entries(groupedByDate).map(([date, events], dateIndex) => {
          const sundayEvents = events
            .filter((e: any) => e.Key === 'sundaySchool' || e.Key === 'memorial')
            // Sort so Sunday School always comes before Memorial
            .sort((a: any, b: any) => {
              if (a.Key === 'sundaySchool' && b.Key === 'memorial') return -1
              if (a.Key === 'memorial' && b.Key === 'sundaySchool') return 1
              return 0
            })

          const bibleClassEvents = events.filter((e: any) => e.Key === 'bibleClass')

          return (
            <React.Fragment key={date}>
              {/* Sunday Services Container */}
              {sundayEvents.length > 0 && (
                <Container style={{ ...container, marginTop: '24px' }} className="container">
                  {dateIndex > 0 && (
                    <hr
                      style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }}
                    />
                  )}

                  <Heading style={defaultText}>Arrangements for {date}</Heading>

                  {/* Sunday Services */}
                  {sundayEvents.map((event: any, index: number) => {
                    if (event.Key === 'sundaySchool') {
                      // Only show full Sunday School section when there's class (has Refreshments)
                      const hasSundaySchool = !!event.Refreshments

                      return (
                        <Section key={`ss-${index}`} style={program}>
                          {hasSundaySchool ? (
                            <>
                              <Heading style={defaultText}>Sunday School at 9:30am</Heading>
                              <Text style={defaultText}>
                                {'Refreshments: '}
                                <strong>{event.Refreshments}</strong>
                              </Text>
                            </>
                          ) : (
                            <Text style={defaultText}>
                              <strong>No Sunday school this week!</strong>
                            </Text>
                          )}
                          {index < sundayEvents.length - 1 && (
                            <hr
                              style={{
                                borderWidth: '0',
                                background: '#ddd',
                                color: '#ddd',
                                height: '1px',
                              }}
                            />
                          )}
                        </Section>
                      )
                    }

                    if (event.Key === 'memorial') {
                      const showHymns = dateIndex === 0 // Only show hymns for first Sunday
                      const hymnsContent = showHymns ? Hymns(event) : null

                      return (
                        <Section key={`memorial-${index}`} style={program}>
                          <Heading style={defaultText}>Memorial Service at 11:00am</Heading>
                          <Row>
                            <Column>
                              {hymnsContent ? (
                                // Two-column layout when hymns are present
                                <>
                                  <Row align="left" width={'49%'} className="deviceWidth">
                                    <Column style={columnAlignTop}>
                                      {MemorialServiceProgram(event)}
                                    </Column>
                                  </Row>
                                  <Row align="left" width={'49%'} className="deviceWidth">
                                    <Column style={columnAlignTop}>{hymnsContent}</Column>
                                  </Row>
                                </>
                              ) : (
                                // Single column layout when no hymns
                                <Row>
                                  <Column style={columnAlignTop}>
                                    {MemorialServiceProgram(event)}
                                  </Column>
                                </Row>
                              )}
                            </Column>
                          </Row>
                          {event.YouTube ? <YouTubeLink url={event.YouTube} /> : null}
                        </Section>
                      )
                    }
                    return null
                  })}
                </Container>
              )}

              {/* Bible Class - Standalone without "Arrangements" header */}
              {/* EXCEPTION: If Toronto East Business Meeting is on the same night, show that instead */}
              {bibleClassEvents.map((event: any, index: number) => {
                // Check if there's a Business Meeting event on the same date
                const bibleClassDate = new Date(event.Date)
                const businessMeetingEvent = allUpcomingEvents.find((upcomingEvent) => {
                  if (upcomingEvent.type !== 'general') return false
                  if (!upcomingEvent.title?.toLowerCase().includes('business meeting')) return false

                  // Compare dates
                  const eventDate = (upcomingEvent as any).startDate
                    ? new Date((upcomingEvent as any).startDate)
                    : null

                  if (!eventDate) return false

                  // Same day comparison
                  return (
                    bibleClassDate.getFullYear() === eventDate.getFullYear() &&
                    bibleClassDate.getMonth() === eventDate.getMonth() &&
                    bibleClassDate.getDate() === eventDate.getDate()
                  )
                })

                // If Business Meeting found, show that instead
                if (businessMeetingEvent) {
                  return (
                    <Container
                      key={`bm-${date}-${index}`}
                      style={{ ...container, marginTop: '24px' }}
                      className="container"
                    >
                      <hr
                        style={{
                          borderWidth: '0',
                          background: '#000',
                          color: '#000',
                          height: '2px',
                        }}
                      />
                      <Section style={program}>
                        <Text style={defaultText}>
                          <Link
                            href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${businessMeetingEvent.id}`}
                            style={{
                              color: '#0066cc',
                              textDecoration: 'none',
                              fontWeight: 'bold',
                            }}
                          >
                            {businessMeetingEvent.title}
                          </Link>
                          <br />
                          {EventDateDisplay(businessMeetingEvent)}
                          {businessMeetingEvent.description && (
                            <>
                              <br />
                              <TextWithLineBreaks text={businessMeetingEvent.description} />
                            </>
                          )}
                          <br />
                          <em>(Replaces regular Bible Class for this date)</em>
                          <br />
                          <br />
                          <Link
                            href={
                              businessMeetingEvent.membersOnly
                                ? `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/auth/signin?callbackUrl=/events/${businessMeetingEvent.id}`
                                : `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${businessMeetingEvent.id}`
                            }
                            style={{
                              color: '#0066cc',
                              textDecoration: 'none',
                              fontWeight: '600',
                            }}
                          >
                            View Details →
                          </Link>
                        </Text>
                      </Section>
                    </Container>
                  )
                }

                // Otherwise, show normal Bible Class
                // Check if there's no class - same logic as NextBibleClass component: !event.Speaker
                const hasClass = !!event.Speaker

                return (
                  <Container
                    key={`bc-${date}-${index}`}
                    style={{ ...container, marginTop: '24px' }}
                    className="container"
                  >
                    <hr
                      style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }}
                    />
                    <Section style={program}>
                      {hasClass ? (
                        <>
                          <Heading style={defaultText}>
                            Bible Class for {event.Date} at 7:30pm - on Zoom
                          </Heading>
                          <Row>
                            <Column style={columnAlignTop}>{BibleClassProgram(event)}</Column>
                          </Row>
                        </>
                      ) : (
                        <>
                          <Heading style={defaultText}>{event.Date}</Heading>
                          <Text style={defaultText}>
                            <strong>No Bible Class tonight</strong>
                          </Text>
                        </>
                      )}
                    </Section>
                  </Container>
                )
              })}
            </React.Fragment>
          )
        })}

        {/* Election Notice - Shows when there's an active election */}
        {(() => {
          const activeElection = allUpcomingEvents.find((event) => isElectionActive(event))
          if (!activeElection) return null

          const electionEvent = activeElection as any
          const endDate = new Date(electionEvent.electionEndDate)
          const formattedEndDate = endDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'America/Toronto',
          })

          return (
            <Container style={{ ...container, marginTop: '24px' }} className="container">
              <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
              <Section
                style={{
                  ...program,
                  backgroundColor: '#fff3e0',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '2px solid #ff9800',
                }}
              >
                <Heading style={{ ...defaultText, color: '#e65100' }}>Election Notice</Heading>
                <Text style={defaultText}>
                  Elections for Service brethren are underway. Members should have received a link
                  to the online ballot already—if not, please ask the Arranging brethren. You have 3
                  ways to vote: (1) online ballot, (2) asking another member to submit your vote, or
                  (3) requesting a printed ballot. The election concludes {formattedEndDate}.
                </Text>
              </Section>
            </Container>
          )
        })()}

        {/* Special Announcements - Baptisms, Weddings, Engagements, Funerals */}
        {/* These appear after regular program but before LTRTBE and general events */}
        {/* Sorted by date descending (newest first) */}
        {(() => {
          const specialEvents = allUpcomingEvents
            .filter(
              (event) =>
                event.type === 'baptism' ||
                event.type === 'wedding' ||
                event.type === 'engagement' ||
                event.type === 'funeral'
            )
            .sort((a, b) => {
              // Get the relevant date for each event type
              const getEventDate = (event: Event): Date => {
                if (event.type === 'wedding' && event.ceremonyDate)
                  return new Date(event.ceremonyDate)
                if (event.type === 'baptism' && event.baptismDate)
                  return new Date(event.baptismDate)
                if (event.type === 'engagement' && (event as any).engagementDate)
                  return new Date((event as any).engagementDate)
                if (event.type === 'funeral' && event.serviceDate)
                  return new Date(event.serviceDate)
                return new Date(0) // fallback for events without dates
              }
              // Sort descending (newest first)
              return getEventDate(b).getTime() - getEventDate(a).getTime()
            })

          if (specialEvents.length === 0) return null

          return (
            <Container style={container} className="container">
              <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
              {specialEvents.map((event, index) => (
                <React.Fragment key={event.id}>
                  {index > 0 && (
                    <hr
                      style={{
                        borderWidth: '0',
                        background: '#000',
                        color: '#000',
                        height: '2px',
                        margin: '16px 0',
                      }}
                    />
                  )}
                  <Section style={program}>
                    {/* Skip title for engagements - the announcement blurb serves as intro */}
                    {event.type !== 'engagement' && (
                      <Heading style={defaultText}>
                        <Link
                          href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`}
                          style={{
                            color: '#0066cc',
                            textDecoration: 'none',
                            fontWeight: 'bold',
                          }}
                        >
                          {event.title}
                        </Link>
                      </Heading>
                    )}
                    <Text style={defaultText}>
                      {/* Don't show date at top for funerals or engagements - shown in their specific sections */}
                      {event.type !== 'funeral' &&
                        event.type !== 'engagement' &&
                        EventDateDisplay(event)}
                      {/* Baptism-specific wording */}
                      {event.type === 'baptism' && (event as any).candidate && (
                        <>
                          <br />
                          <br />
                          After a good confession of Faith,{' '}
                          <strong>
                            {`${(event as any).candidate.firstName || ''} ${(event as any).candidate.lastName || ''}`.trim()}
                          </strong>{' '}
                          will be baptized into the saving name of our Lord.
                        </>
                      )}
                      {/* Baptism - About the Candidate with optional photo */}
                      {event.type === 'baptism' &&
                        ((event as any).aboutCandidate || (event as any).candidatePhoto) && (
                          <>
                            <br />
                            <br />
                            {(event as any).candidatePhoto ? (
                              <Row>
                                <Column
                                  style={{
                                    width: '140px',
                                    verticalAlign: 'top',
                                    paddingRight: '16px',
                                  }}
                                >
                                  <img
                                    src={(event as any).candidatePhoto.url}
                                    alt="Photo of the candidate"
                                    style={{
                                      width: '120px',
                                      height: '150px',
                                      objectFit: 'cover',
                                      borderRadius: '4px',
                                    }}
                                  />
                                </Column>
                                {(event as any).aboutCandidate && (
                                  <Column style={{ verticalAlign: 'top' }}>
                                    <Text
                                      style={{ ...defaultText, margin: 0, whiteSpace: 'pre-wrap' }}
                                    >
                                      <AutoLinkText text={(event as any).aboutCandidate} />
                                    </Text>
                                  </Column>
                                )}
                              </Row>
                            ) : (event as any).aboutCandidate ? (
                              <Text style={{ ...defaultText, margin: 0, whiteSpace: 'pre-wrap' }}>
                                <AutoLinkText text={(event as any).aboutCandidate} />
                              </Text>
                            ) : null}
                          </>
                        )}
                      {/* Baptism Location */}
                      {event.type === 'baptism' &&
                        (event as any).location &&
                        (() => {
                          const location = (event as any).location

                          if (typeof location === 'string') {
                            return (
                              <>
                                <br />
                                <br />
                                <strong>{location}</strong>
                              </>
                            )
                          }

                          return (location.name || location.placeName) ? (
                            <>
                              <br />
                              <br />
                              <strong>{location.name || location.placeName}</strong>
                              {location.address && (
                                <>
                                  <br />
                                  {location.address}
                                </>
                              )}
                              {(location.city || location.province) && (
                                <>
                                  <br />
                                  {[location.city, location.province, location.postalCode]
                                    .filter(Boolean)
                                    .join(', ')}
                                </>
                              )}
                              {location.mapsUrl && (
                                <>
                                  <br />
                                  <Link href={location.mapsUrl} style={{ color: '#2b6cb0', textDecoration: 'underline', fontSize: '14px' }}>
                                    Get Directions
                                  </Link>
                                </>
                              )}
                            </>
                          ) : null
                        })()}
                      {/* Wedding-specific wording */}
                      {event.type === 'wedding' && (event as any).couple && (
                        <>
                          <br />
                          <br />
                          <strong>
                            {`${(event as any).couple.bride?.firstName || ''} ${(event as any).couple.bride?.lastName || ''}`.trim()}
                            {' & '}
                            {`${(event as any).couple.groom?.firstName || ''} ${(event as any).couple.groom?.lastName || ''}`.trim()}
                          </strong>
                        </>
                      )}
                      {/* Engagement-specific wording */}
                      {event.type === 'engagement' && (
                        <>
                          {/* Rings image + Congratulations! header */}
                          <Row>
                            <Column
                              style={{
                                width: '100px',
                                verticalAlign: 'middle',
                                paddingRight: '12px',
                              }}
                            >
                              <img
                                src="https://tee-admin-files.s3.ca-central-1.amazonaws.com/uploads/email-assets/engagement-rings.jpg"
                                alt="Engagement rings"
                                style={{
                                  width: '100px',
                                  height: 'auto',
                                }}
                              />
                            </Column>
                            <Column style={{ verticalAlign: 'middle' }}>
                              <Text
                                style={{
                                  ...defaultText,
                                  margin: 0,
                                  fontSize: '24px',
                                  fontWeight: 'bold',
                                }}
                              >
                                Congratulations!
                              </Text>
                            </Column>
                          </Row>
                          {/* Announcement blurb */}
                          {(event as any).engagementAnnouncement && (
                            <>
                              <br />
                              <Text style={{ ...defaultText, margin: 0, whiteSpace: 'pre-wrap' }}>
                                <AutoLinkText text={(event as any).engagementAnnouncement} />
                              </Text>
                            </>
                          )}
                          {/* Engagement line */}
                          <br />
                          <Text style={{ ...defaultText, margin: 0 }}>
                            <strong>{(event as any).engagementProposed || ''}</strong> is engaged to{' '}
                            <strong>{(event as any).engagementTo || ''}</strong>
                            {(event as any).engagementDate && (
                              <>
                                ,{' '}
                                {new Date((event as any).engagementDate).toLocaleDateString(
                                  'en-US',
                                  { month: 'short', day: 'numeric', year: 'numeric' }
                                )}
                              </>
                            )}
                            .
                          </Text>
                          {/* Congratulations and scripture */}
                          <br />
                          <Text style={{ ...defaultText, margin: 0, fontStyle: 'italic' }}>
                            "Congratulations from your Brothers and Sisters of Toronto East
                            <br />
                            <br />
                            Ephesians 5:1 Follow God's example, therefore, as dearly loved children
                            2 and walk in the way of love, just as Christ loved us and gave himself
                            up for us as a fragrant offering and sacrifice to God."
                          </Text>
                        </>
                      )}
                      {/* Funeral - Photo and shortened about (first paragraph only) */}
                      {event.type === 'funeral' &&
                        ((event as any).aboutDeceased || (event as any).deceasedPhoto) && (
                          <>
                            {(event as any).deceasedPhoto ? (
                              <Row>
                                <Column
                                  style={{
                                    width: '160px',
                                    verticalAlign: 'top',
                                    paddingRight: '20px',
                                  }}
                                >
                                  <img
                                    src={(event as any).deceasedPhoto.url}
                                    alt="Photo of the deceased"
                                    style={{
                                      width: '150px',
                                      maxWidth: '150px',
                                      height: 'auto',
                                      borderRadius: '8px',
                                    }}
                                  />
                                </Column>
                                {(event as any).aboutDeceased && (
                                  <Column style={{ verticalAlign: 'top' }}>
                                    <Text style={{ ...defaultText, margin: 0 }}>
                                      <AutoLinkText
                                        text={getFirstParagraph((event as any).aboutDeceased)}
                                      />
                                    </Text>
                                  </Column>
                                )}
                              </Row>
                            ) : (event as any).aboutDeceased ? (
                              <Text style={{ ...defaultText, margin: 0 }}>
                                <AutoLinkText
                                  text={getFirstParagraph((event as any).aboutDeceased)}
                                />
                              </Text>
                            ) : null}
                          </>
                        )}
                      {/* Funeral Service Details - Visitation, Service, Graveside with times and locations */}
                      {event.type === 'funeral' &&
                        (() => {
                          const funeralEvent = event as any
                          const serviceDate = funeralEvent.serviceDate
                          // Support both old (viewingDate) and new (visitationDate) field names
                          const visitationDate = funeralEvent.visitationDate || funeralEvent.viewingDate
                          const visitationEndDate = funeralEvent.visitationEndDate
                          const gravesideDate = funeralEvent.gravesideDate
                          const locations = funeralEvent.locations
                          const simpleLocation = funeralEvent.location

                          // Format location helper
                          const formatLocation = (loc: any) => {
                            if (!loc) return null
                            if (typeof loc === 'string') return loc
                            return loc.name || null
                          }

                          const hasVisitation =
                            visitationDate ||
                            funeralEvent.viewingTime ||
                            funeralEvent.viewingLocation ||
                            locations?.visitation
                          const hasService = serviceDate || simpleLocation || locations?.service
                          const hasGraveside =
                            gravesideDate || funeralEvent.gravesideTime || locations?.graveside

                          if (!hasVisitation && !hasService && !hasGraveside) return null

                          return (
                            <>
                              {/* Visitation (Optional) - shown BEFORE service */}
                              {hasVisitation &&
                                (() => {
                                  const visLoc =
                                    funeralEvent.viewingLocation || locations?.visitation
                                  const visStartTime = visitationDate && formatServiceTime(visitationDate)
                                  const visEndTime = visitationEndDate && formatServiceTime(visitationEndDate)
                                  const visDate = visitationDate && formatServiceDate(visitationDate)
                                  return (
                                    <>
                                      <br />
                                      <br />
                                      <strong>Visitation</strong>
                                      <br />
                                      {visDate && (
                                        <>
                                          {visDate}
                                          <br />
                                        </>
                                      )}
                                      {funeralEvent.viewingTime ||
                                        (visStartTime && visEndTime
                                          ? `${visStartTime} - ${visEndTime}`
                                          : visStartTime)}
                                      {visLoc && ` at ${formatLocation(visLoc)}`}
                                    </>
                                  )
                                })()}
                              {/* Service/Funeral/Celebration of Life */}
                              {hasService &&
                                (() => {
                                  const serviceLoc = locations?.service || simpleLocation
                                  const serviceTime =
                                    funeralEvent.serviceTime ||
                                    (serviceDate && formatServiceTime(serviceDate))
                                  const formattedDate =
                                    serviceDate && formatServiceDate(serviceDate)
                                  return (
                                    <>
                                      <br />
                                      <br />
                                      <strong>Service</strong>
                                      <br />
                                      {formattedDate && (
                                        <>
                                          {formattedDate}
                                          <br />
                                        </>
                                      )}
                                      {serviceTime}
                                      {serviceLoc && ` at ${formatLocation(serviceLoc)}`}
                                      {serviceLoc &&
                                        typeof serviceLoc !== 'string' &&
                                        serviceLoc.address && (
                                          <>
                                            <br />
                                            {serviceLoc.address}
                                          </>
                                        )}
                                      {serviceLoc &&
                                        typeof serviceLoc !== 'string' &&
                                        (serviceLoc.city || serviceLoc.province) && (
                                          <>
                                            <br />
                                            {[
                                              serviceLoc.city,
                                              serviceLoc.province,
                                              serviceLoc.postalCode,
                                            ]
                                              .filter(Boolean)
                                              .join(', ')}
                                          </>
                                        )}
                                    </>
                                  )
                                })()}
                              {/* Graveside Service (Optional) */}
                              {hasGraveside &&
                                (() => {
                                  const graveLoc = locations?.graveside
                                  return (
                                    <>
                                      <br />
                                      <br />
                                      <strong>Graveside Service</strong>
                                      <br />
                                      {funeralEvent.gravesideTime ||
                                        (gravesideDate && formatServiceTime(gravesideDate))}
                                      {graveLoc && ` at ${formatLocation(graveLoc)}`}
                                    </>
                                  )
                                })()}
                            </>
                          )
                        })()}
                      {/* Location - for non-funeral events */}
                      {event.type !== 'funeral' && (event as any).location && (
                        <>
                          <br />
                          <br />
                          {typeof (event as any).location === 'string' ? (
                            (event as any).location
                          ) : (
                            <>
                              {((event as any).location.name || (event as any).location.placeName) && (
                                <strong>{(event as any).location.name || (event as any).location.placeName}</strong>
                              )}
                              {(event as any).location.address && (
                                <>
                                  <br />
                                  {(event as any).location.address}
                                </>
                              )}
                              {(event as any).location.directions && (
                                <>
                                  <br />
                                  <em>{(event as any).location.directions}</em>
                                </>
                              )}
                              {(event as any).location.mapsUrl && (
                                <>
                                  <br />
                                  <Link href={(event as any).location.mapsUrl} style={{ color: '#2b6cb0', textDecoration: 'underline', fontSize: '14px' }}>
                                    Get Directions
                                  </Link>
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}
                      {/* Description if provided */}
                      {event.description && (
                        <>
                          <br />
                          <br />
                          <TextWithLineBreaks text={event.description} />
                        </>
                      )}
                      <br />
                      <br />
                      <Link
                        href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`}
                        style={{
                          color: '#0066cc',
                          textDecoration: 'none',
                          fontWeight: '600',
                        }}
                      >
                        View Details →
                      </Link>
                    </Text>
                  </Section>
                </React.Fragment>
              ))}
            </Container>
          )
        })()}

        {/* Learn to Read the Bible Seminars */}
        {(() => {
          // Find the LTRTBE recurring event
          const ltrtbeEvent = allUpcomingEvents.find(
            (event) =>
              event.type === 'recurring' &&
              (event.title?.toLowerCase().includes('learn to read the bible') ||
                event.title?.toLowerCase().includes('ltrtbe'))
          )

          if (ltrtbeEvent && (ltrtbeEvent as any).recurringConfig) {
            const config = (ltrtbeEvent as any).recurringConfig
            const nextDate = getNextRecurrenceDate(config)

            return (
              <Container style={container} className="container">
                <hr
                  style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }}
                />
                <Section>
                  <Heading style={defaultText}>
                    <Link
                      href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${ltrtbeEvent.id}`}
                      style={{
                        color: '#0066cc',
                        textDecoration: 'none',
                        fontWeight: 'bold',
                      }}
                    >
                      Learn To Read The Bible Effectively
                    </Link>
                  </Heading>
                  <Heading style={defaultText}>
                    Next session:{' '}
                    {nextDate
                      ? nextDate.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          timeZone: 'America/Toronto',
                        })
                      : 'Date TBD'}{' '}
                    at 7:00-8:30 pm at the Hall
                  </Heading>
                  <Text style={defaultText}>
                    Please join us for our seminars: Learn to Read the Bible Effectively.
                    <br />
                    All welcome!
                    <br />
                    <br />
                    <Link
                      href={
                        ltrtbeEvent.membersOnly
                          ? `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/auth/signin?callbackUrl=/events/${ltrtbeEvent.id}`
                          : `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${ltrtbeEvent.id}`
                      }
                      style={{
                        color: '#0066cc',
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      View Details →
                    </Link>
                  </Text>
                </Section>
              </Container>
            )
          }

          // Fallback if no recurring event found
          return (
            <Container style={container} className="container">
              <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
              <Section>
                <Heading style={defaultText}>Learn To Read The Bible Effectively</Heading>
                <Heading style={defaultText}>Every Monday from 7:00-8:30 pm at the Hall</Heading>
                <Text style={defaultText}>
                  Please join us for our seminars: Learn to Read the Bible Effectively.
                  <br />
                  All welcome!
                </Text>
              </Section>
            </Container>
          )
        })()}

        {/* Events Section - Personal, no redundant headers */}
        {allUpcomingEvents.length > 0 && (
          <Container style={container} className="container">
            <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
            {Object.entries(groupedEvents).map(([eventType, typeEvents], groupIndex) => (
              <React.Fragment key={eventType}>
                {typeEvents.map((event, eventIndex) => (
                  <React.Fragment key={event.id}>
                    {/* Add separator line between different events (not between event types) */}
                    {(groupIndex > 0 || eventIndex > 0) && (
                      <hr
                        style={{
                          borderWidth: '0',
                          background: '#ccc',
                          color: '#ccc',
                          height: '1px',
                          margin: '16px 0',
                        }}
                      />
                    )}
                    <Section style={program}>
                      {/* Special rendering for study-weekend events */}
                      {event.type === 'study-weekend' ? (
                        <Text style={defaultText}>
                          {/* Title */}
                          <Link
                            href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`}
                            style={{
                              color: '#0066cc',
                              textDecoration: 'none',
                              fontWeight: 'bold',
                            }}
                          >
                            {event.title}
                          </Link>
                          <br />
                          {EventDateDisplay(event)}

                          {/* Theme */}
                          {(event as any).theme && (
                            <>
                              <br />
                              <br />
                              <strong>{(event as any).theme}</strong>
                            </>
                          )}

                          {/* Speakers */}
                          {event.speakers && event.speakers.length > 0 && (
                            <>
                              <br />
                              Speaker{event.speakers.length > 1 ? 's' : ''}:{' '}
                              {event.speakers
                                .map((s) => {
                                  const title = s.title || ''
                                  const firstName = s.firstName || ''
                                  const lastName = s.lastName || ''
                                  return `${title} ${firstName} ${lastName}`.trim()
                                })
                                .filter((name) => name.length > 0)
                                .join(', ') || 'TBA'}
                            </>
                          )}

                          {/* Location - just the name, full details on event page */}
                          {(event as any).location && typeof (event as any).location !== 'string' && ((event as any).location.name || (event as any).location.placeName) && (
                            <>
                              <br />
                              <br />
                              <strong>Location:</strong> {(event as any).location.name || (event as any).location.placeName}
                              {(event as any).location.mapsUrl && (
                                <>
                                  {' — '}
                                  <Link href={(event as any).location.mapsUrl} style={{ color: '#2b6cb0', textDecoration: 'underline', fontSize: '14px' }}>
                                    Directions
                                  </Link>
                                </>
                              )}
                            </>
                          )}

                          {/* Multi-section events: condensed summary with "View Details" link */}
                          {(event as any).sections && (event as any).sections.length > 0 ? (
                            <>
                              <br />
                              <br />
                              <em>Multiple locations — see event page for full schedule</em>
                            </>
                          ) : (
                            /* Schedule grouped by day (flat schedule, no sections) */
                            (() => {
                              const scheduleByDay = groupScheduleByDay((event as any).schedule)
                              if (!scheduleByDay) return null

                              return (
                                <>
                                  <br />
                                  <br />
                                  <strong>Schedule:</strong>
                                  {Object.entries(scheduleByDay).map(([dayLabel, items]) => {
                                    const showDayLabel = dayLabel !== 'Schedule'
                                    return (
                                      <React.Fragment key={dayLabel}>
                                        {showDayLabel && (
                                          <>
                                            <br />
                                            <span style={{ color: '#cc0000', fontWeight: 'bold' }}>{dayLabel}</span>
                                          </>
                                        )}
                                        {items.map((item: any, idx: number) => {
                                          const time = formatScheduleTime(item.time || item.startTime)
                                          return (
                                            <React.Fragment key={idx}>
                                              <br />
                                              &nbsp;&nbsp;&nbsp;&nbsp;{time && `${time}  `}
                                              {item.activity || ''}
                                              {item.title ? ` ${item.title}` : ''}
                                            </React.Fragment>
                                          )
                                        })}
                                      </React.Fragment>
                                    )
                                  })}
                                </>
                              )
                            })()
                          )}

                          {/* Parking info */}
                          {(event as any).location && typeof (event as any).location !== 'string' && (event as any).location.parkingInfo && (
                            <>
                              <br />
                              <br />
                              <em>Parking: {(event as any).location.parkingInfo}</em>
                            </>
                          )}

                          {/* Online Info */}
                          {(event as any).location && typeof (event as any).location !== 'string' && (event as any).location.onlineMeeting && (
                            <>
                              <br />
                              <br />
                              <strong>Online Info</strong>
                              {(event as any).location.onlineMeeting.link && (
                                <>
                                  <br />
                                  <Link
                                    href={(event as any).location.onlineMeeting.link}
                                    style={{ color: '#0066cc', textDecoration: 'underline' }}
                                  >
                                    Join Meeting
                                  </Link>
                                </>
                              )}
                              {(event as any).location.onlineMeeting.meetingId && (
                                <>
                                  <br />
                                  Meeting ID: {(event as any).location.onlineMeeting.meetingId}
                                </>
                              )}
                              {(event as any).location.onlineMeeting.password && (
                                <>
                                  <br />
                                  Password: {(event as any).location.onlineMeeting.password}
                                </>
                              )}
                              {(event as any).location.onlineMeeting.dialInNumber && (
                                <>
                                  <br />
                                  Dial-in: {(event as any).location.onlineMeeting.dialInNumber}
                                </>
                              )}
                            </>
                          )}

                          <br />
                          <br />
                          <Link
                            href={
                              event.membersOnly
                                ? `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/auth/signin?callbackUrl=/events/${event.id}`
                                : `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`
                            }
                            style={{
                              color: '#0066cc',
                              textDecoration: 'none',
                              fontWeight: '600',
                            }}
                          >
                            View Details →
                          </Link>
                        </Text>
                      ) : (
                        /* Default rendering for other event types */
                        <Text style={defaultText}>
                          <Link
                            href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`}
                            style={{
                              color: '#0066cc',
                              textDecoration: 'none',
                              fontWeight: 'bold',
                            }}
                          >
                            {event.title}
                          </Link>
                          {(event as any).theme && ` - ${(event as any).theme}`}
                          {/* Only show date line if there is a date */}
                          {EventDateDisplay(event) && (
                            <>
                              <br />
                              {EventDateDisplay(event)}
                            </>
                          )}
                          {/* Baptism-specific wording */}
                          {event.type === 'baptism' && (event as any).candidate && (
                            <>
                              <br />
                              <br />
                              After a good confession of Faith,{' '}
                              <strong>
                                {`${(event as any).candidate.firstName || ''} ${(event as any).candidate.lastName || ''}`.trim()}
                              </strong>{' '}
                              will be baptized into the saving name of our Lord.
                            </>
                          )}
                          {/* Location for events that have it */}
                          {(event as any).sections && (event as any).sections.length > 0 ? (
                            <>
                              <br />
                              <br />
                              <em>Multiple locations — see event page for full schedule</em>
                            </>
                          ) : (event as any).location ? (
                            <>
                              <br />
                              <br />
                              {typeof (event as any).location === 'string' ? (
                                (event as any).location
                              ) : (
                                <>
                                  {((event as any).location.name || (event as any).location.placeName) && (
                                    <strong>{(event as any).location.name || (event as any).location.placeName}</strong>
                                  )}
                                  {(event as any).location.address && (
                                    <>
                                      <br />
                                      {(event as any).location.address}
                                    </>
                                  )}
                                  {((event as any).location.city ||
                                    (event as any).location.province) && (
                                    <>
                                      <br />
                                      {[
                                        (event as any).location.city,
                                        (event as any).location.province,
                                        (event as any).location.postalCode,
                                      ]
                                        .filter(Boolean)
                                        .join(', ')}
                                    </>
                                  )}
                                  {(event as any).location.directions && (
                                    <>
                                      <br />
                                      <em>{(event as any).location.directions}</em>
                                    </>
                                  )}
                                  {(event as any).location.mapsUrl && (
                                    <>
                                      <br />
                                      <Link href={(event as any).location.mapsUrl} style={{ color: '#2b6cb0', textDecoration: 'underline', fontSize: '14px' }}>
                                        Get Directions
                                      </Link>
                                    </>
                                  )}
                                </>
                              )}
                            </>
                          ) : null}
                          {/* Description for non-baptism events (baptism uses the formal wording above) */}
                          {event.type !== 'baptism' && event.description && (
                            <>
                              <br />
                              <br />
                              <TextWithLineBreaks text={event.description} />
                            </>
                          )}
                          <br />
                          <br />
                          <Link
                            href={
                              event.membersOnly
                                ? `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/auth/signin?callbackUrl=/events/${event.id}`
                                : `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`
                            }
                            style={{
                              color: '#0066cc',
                              textDecoration: 'none',
                              fontWeight: '600',
                            }}
                          >
                            View Details →
                          </Link>
                        </Text>
                      )}
                    </Section>
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </Container>
        )}

        {/* Daily Bible Reading Section */}
        {allReadings.length > 0 && (
          <Container style={container} className="container">
            <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
            <Heading style={defaultText}>Daily Bible Reading Planner</Heading>

            <Section style={program}>
              {/* Desktop Table */}
              <table className="readings-table">
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th
                      style={{
                        padding: '10px 8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        color: '#495057',
                      }}
                    >
                      Day
                    </th>
                    <th
                      style={{
                        padding: '10px 8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        color: '#495057',
                      }}
                    >
                      Reading 1
                    </th>
                    <th
                      style={{
                        padding: '10px 8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        color: '#495057',
                      }}
                    >
                      Reading 2
                    </th>
                    <th
                      style={{
                        padding: '10px 8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'left',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        color: '#495057',
                      }}
                    >
                      Reading 3
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allReadings.map((reading: any, index: number) => {
                    const isEvenRow = index % 2 === 0
                    const rowBgColor = isEvenRow ? '#ffffff' : '#f8f9fa'

                    return (
                      <tr key={index} style={{ backgroundColor: rowBgColor }}>
                        <td
                          style={{
                            padding: '10px 8px',
                            border: '1px solid #dee2e6',
                            verticalAlign: 'top',
                            minWidth: '90px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                          }}
                        >
                          {formatReadingDate(reading.date)}
                        </td>
                        <td
                          style={{
                            padding: '10px 8px',
                            border: '1px solid #dee2e6',
                            verticalAlign: 'top',
                            fontSize: '13px',
                          }}
                        >
                          {reading.reading1}
                        </td>
                        <td
                          style={{
                            padding: '10px 8px',
                            border: '1px solid #dee2e6',
                            verticalAlign: 'top',
                            fontSize: '13px',
                          }}
                        >
                          {reading.reading2}
                        </td>
                        <td
                          style={{
                            padding: '10px 8px',
                            border: '1px solid #dee2e6',
                            verticalAlign: 'top',
                            fontSize: '13px',
                          }}
                        >
                          {reading.reading3}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="readings-mobile">
                {allReadings.map((reading: any, index: number) => (
                  <div key={index} className="mobile-card">
                    <div className="mobile-date">{formatReadingDate(reading.date)}</div>
                    <div className="mobile-reading">
                      <span className="mobile-reading-label">Reading 1:</span>
                      {reading.reading1}
                    </div>
                    <div className="mobile-reading">
                      <span className="mobile-reading-label">Reading 2:</span>
                      {reading.reading2}
                    </div>
                    <div className="mobile-reading">
                      <span className="mobile-reading-label">Reading 3:</span>
                      {reading.reading3}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </Container>
        )}

        <Footer />
      </Body>
    </Html>
  )
}

const Lunch = ({ lunch }: { lunch: string }) => {
  if (!lunch) {
    return null
  }
  return (
    <>
      <br />
      <strong>{lunch}</strong>
    </>
  )
}

const MemorialServiceProgram = (event: SundayEvents) => {
  // No service at hall: Both Exhort AND Preside are blank
  const noServiceAtHall = !event.Exhort && !event.Preside

  if (noServiceAtHall) {
    // Use Activities field to explain why (e.g., "Please join us at the Toronto Fraternal Gathering")
    const explanation = event.Activities || event['Holidays and Special Events']
    return (
      <Text style={defaultText}>
        <strong>There will be no service at our hall.</strong>
        {explanation ? (
          <>
            <br />
            <br />
            <Text>{explanation}</Text>
          </>
        ) : null}
      </Text>
    )
  }

  // If Exhort is blank but Preside has a value, exhorter is TBD
  const exhorterDisplay = event.Exhort || '--'

  return (
    <Text style={defaultText}>
      {'Presiding: '}
      <strong>{event.Preside}</strong>
      <br />
      {'Exhorting: '}
      <strong>{exhorterDisplay}</strong>
      <br />
      {'Keyboardist: '}
      <strong>{event.Organist}</strong>
      <br />
      {'Steward: '}
      <strong>{event.Steward}</strong>
      <br />
      {'Doorkeeper: '}
      <strong>{event.Doorkeeper}</strong>
      <br />
      <br />
      {event.Collection ? (
        <strong>
          {'Second Collection is for '}
          {event.Collection}
        </strong>
      ) : (
        <>No Second Collection.</>
      )}
      <Lunch lunch={event.Lunch} />
    </Text>
  )
}

const YouTubeLink = ({ url }: { url: string }) => {
  if (!url) return null
  return (
    <Row>
      <Column>
        <Text style={{ ...defaultText, paddingTop: '12px' }}>
          <strong>Watch on YouTube:</strong>
          <br />
          <Link href={url} style={{ ...link, fontSize: '14px', wordBreak: 'break-all' as const }}>
            {url}
          </Link>
        </Text>
      </Column>
    </Row>
  )
}

const Hymns = (event: MemorialServiceType) => {
  // Check if any hymn numbers are provided
  const hasHymns =
    event['Hymn-opening'] ||
    event['Hymn-exhortation'] ||
    event['Hymn-memorial'] ||
    event['Hymn-closing']

  // Don't show hymns section if no numbers are available
  if (!hasHymns) {
    return null
  }

  return (
    <Text style={defaultText}>
      <strong>Hymns</strong>
      <br />
      {'Opening: '}
      <strong>{event['Hymn-opening'] || 'TBA'}</strong>
      <br />
      {'Exhortation: '}
      <strong>{event['Hymn-exhortation'] || 'TBA'}</strong>
      <br />
      {'Memorial: '}
      <strong>{event['Hymn-memorial'] || 'TBA'}</strong>
      <br />
      {'Closing: '}
      <strong>{event['Hymn-closing'] || 'TBA'}</strong>
      <br />
    </Text>
  )
}

const BibleClassProgram = (event: BibleClassType) => {
  if (event.Topic === '') {
    return (
      <Text style={defaultText}>
        <strong>There is No Bible Class Tonight.</strong>
      </Text>
    )
  }
  return (
    <Text style={defaultText}>
      {'Presiding: '}
      <strong>{event.Presider}</strong>
      <br />
      {'Leading: '}
      <strong>{event.Speaker}</strong>
      <br />
      <strong>{event.Topic}</strong>
    </Text>
  )
}

export default Newsletter
