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
import { columnAlignTop, container, defaultText, globalCss, header, main, program } from '../styles'
import React from 'react'
import {
  BibleClassType,
  MemorialServiceType,
  NextNewsletterProps,
  ProgramsTypes,
  SundaySchoolType,
} from '@my/app/types'
import { Event } from '@my/app/types/events'
import { Footer } from '../components/Footer'

function getNextDayOfTheWeek(dayName: string, excludeToday = true, refDate = new Date()): Date {
  const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(
    dayName.slice(0, 3).toLowerCase()
  )
  refDate.setHours(0, 0, 0, 0)
  refDate.setDate(
    refDate.getDate() + +excludeToday + ((dayOfWeek + 7 - refDate.getDay() - +excludeToday) % 7)
  )
  return refDate
}

type SundayEvents = MemorialServiceType &
  Pick<SundaySchoolType, 'Refreshments' | 'Holidays and Special Events'>
const mockEvents: SundayEvents[] | BibleClassType[] = [
  // Sunday School for Feb 25
  {
    Key: ProgramsTypes.sundaySchool,
    Date: 'Feb 25, 2024',
    Refreshments: 'Eassons',
    'Holidays and Special Events': undefined,
  } as any,
  // Memorial for Feb 25
  {
    Key: ProgramsTypes.memorial,
    Date: 'Feb 25, 2024',
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
  // Bible Class for Feb 28
  {
    Key: ProgramsTypes.bibleClass,
    Date: 'Feb 28, 2024',
    Presider: 'Presiding',
    Speaker: 'Speaker',
    Topic: 'Bible Class Topic',
  },
  // Sunday School for Mar 3
  {
    Key: ProgramsTypes.sundaySchool,
    Date: 'Mar 3, 2024',
    Refreshments: 'Johnson Family',
    'Holidays and Special Events': 'Toronto Fraternal Gathering',
  } as any,
  // Memorial for Mar 3
  {
    Key: ProgramsTypes.memorial,
    Date: 'Mar 3, 2024',
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
  // Bible Class for Mar 6
  {
    Key: ProgramsTypes.bibleClass,
    Date: 'Mar 6, 2024',
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
    description: 'Join us for a weekend of spiritual fellowship and Bible study focused on the life and ministry of Jesus Christ.',
    theme: 'The Groups Jesus Worked With',
    dateRange: {
      start: '2024-10-11T00:00:00Z',
      end: '2024-10-12T23:59:59Z'
    },
    speakers: [
      {
        title: 'Bro.',
        firstName: 'John',
        lastName: 'Smith',
        ecclesia: 'Toronto East'
      },
      {
        title: 'Bro.',
        firstName: 'David',
        lastName: 'Wilson',
        ecclesia: 'Hamilton'
      }
    ],
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada'
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
        uploadedBy: 'admin@tee.com'
      }
    ]
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
        lastName: 'Johnson'
      },
      groom: {
        firstName: 'Michael',
        lastName: 'Thompson'
      }
    },
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada'
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: []
  } as any,

  // Baptism
  {
    id: 'b-001',
    title: 'Baptism Service',
    type: 'baptism',
    status: 'published',
    published: true,
    description: 'Rejoice with us as our brother/sister is baptized into Christ.',
    baptismDate: '2024-02-25T11:00:00Z',
    candidate: {
      firstName: 'Emily',
      lastName: 'Davis'
    },
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada'
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: []
  } as any,

  // Funeral
  {
    id: 'f-001',
    title: 'Memorial Service',
    type: 'funeral',
    status: 'published',
    published: true,
    description: 'Join us in remembering the life and faith of our beloved brother/sister.',
    serviceDate: '2024-04-08T14:00:00Z',
    deceased: {
      firstName: 'Robert',
      lastName: 'Anderson'
    },
    hostingEcclesia: {
      name: 'Toronto East',
      province: 'ON',
      country: 'Canada'
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: []
  } as any,

  // General Event
  {
    id: 'g-001',
    title: 'Ecclesial Picnic',
    type: 'general',
    status: 'published',
    published: true,
    description: 'Annual summer picnic for all members and families. Bring your favorite dish to share!',
    startDate: '2024-06-22T12:00:00Z',
    endDate: '2024-06-22T17:00:00Z',
    location: {
      name: 'High Park',
      address: '1873 Bloor St W, Toronto, ON'
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: []
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
      endDate: '2024-12-31T21:00:00Z'
    },
    createdBy: 'admin@tee.com',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    documents: []
  } as any
]

// Mock Bible Readings - proper structure with 3 readings per day
const mockReadings = [
  { date: new Date('2024-02-26'), reading1: 'Genesis 1-2', reading2: 'Matthew 1-2', reading3: 'Psalms 1-2' },
  { date: new Date('2024-02-27'), reading1: 'Genesis 3-4', reading2: 'Matthew 3-4', reading3: 'Psalms 3-4' },
  { date: new Date('2024-02-28'), reading1: 'Genesis 5-6', reading2: 'Matthew 5-6', reading3: 'Psalms 5-6' },
  { date: new Date('2024-02-29'), reading1: 'Genesis 7-8', reading2: 'Matthew 7-8', reading3: 'Psalms 7-8' },
  { date: new Date('2024-03-01'), reading1: 'Genesis 9-10', reading2: 'Matthew 9-10', reading3: 'Psalms 9-10' },
  { date: new Date('2024-03-02'), reading1: 'Genesis 11-12', reading2: 'Matthew 11-12', reading3: 'Psalms 11-12' },
  { date: new Date('2024-03-03'), reading1: 'Genesis 13-14', reading2: 'Matthew 13-14', reading3: 'Psalms 13-14' }
]

function getDateFormatted(date: Date | string): string {
  if (typeof date === 'string') {
    const when = new Date(date)
    return when.toDateString()
  }
  return date.toDateString()
}

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

// Helper function to display event dates for different event types
const EventDateDisplay = (event: Event): string => {
  if (event.type === 'study-weekend' && event.dateRange) {
    const start = new Date(event.dateRange.start)
    const end = new Date(event.dateRange.end)
    const startStr = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })

    if (end.getTime() !== start.getTime()) {
      const endStr = end.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
      return `${startStr} to ${endStr} ${start.getFullYear()}`
    } else {
      return `${startStr} ${start.getFullYear()}`
    }
  } else if (event.type === 'wedding' && event.ceremonyDate) {
    const date = new Date(event.ceremonyDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } else if (event.type === 'baptism' && event.baptismDate) {
    const date = new Date(event.baptismDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } else if (event.type === 'funeral' && event.serviceDate) {
    const date = new Date(event.serviceDate)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } else if ((event as any).startDate) {
    const startDate = new Date((event as any).startDate)
    const endDate = (event as any).endDate ? new Date((event as any).endDate) : null
    const startStr = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })

    if (endDate && endDate.getTime() !== startDate.getTime()) {
      const endStr = endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
      return `${startStr} to ${endStr} ${startDate.getFullYear()}`
    } else {
      return `${startStr} ${startDate.getFullYear()}`
    }
  }
  return 'Date TBD'
}

// Format date for readings display (similar to the bible-readings-layout)
const formatReadingDate = (date: Date | string): string => {
  if (!date) return 'Date unavailable'

  const dateObj = date instanceof Date ? date : new Date(date)
  if (isNaN(dateObj.getTime())) return 'Invalid date'

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const dayName = dayNames[dateObj.getDay()]
  const monthName = monthNames[dateObj.getMonth()]
  const day = dateObj.getDate()

  return `${dayName}, ${monthName} ${day}`
}

interface EmailNewsletterProps {
  scheduleEvents?: (MemorialServiceType | BibleClassType | SundaySchoolType)[]
  upcomingEvents?: Event[]
  readings?: any[]
}

const Newsletter: React.FC<EmailNewsletterProps> = ({
  scheduleEvents,
  upcomingEvents = [],
  readings = []
}) => {
  const todaysDate = new Date().toDateString()
  const allScheduleEvents = scheduleEvents || mockEvents
  const allUpcomingEvents = upcomingEvents.length > 0 ? upcomingEvents : mockUpcomingEvents
  const allReadings = readings.length > 0 ? readings : mockReadings

  // Group schedule events by date
  const groupedByDate: { [date: string]: typeof allScheduleEvents } = {}
  allScheduleEvents.forEach(event => {
    const eventDateStr = String(event.Date)
    if (!groupedByDate[eventDateStr]) {
      groupedByDate[eventDateStr] = []
    }
    groupedByDate[eventDateStr].push(event)
  })

  // Group upcoming events by type
  const groupedEvents: { [key: string]: Event[] } = {}

  allUpcomingEvents.forEach(event => {
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
            This email is intended for Christadelphians and friends, whether we meet in person or on Zoom.
            <br />
            All plans are subject to God's will.
          </Text>
        </Section>

        {/* Regular Services Section */}
        {Object.entries(groupedByDate).map(([date, events], dateIndex) => {
          const sundayEvents = events.filter((e: any) =>
            e.Key === 'sundaySchool' || e.Key === 'memorial'
          )
          const bibleClassEvents = events.filter((e: any) => e.Key === 'bibleClass')

          return (
            <React.Fragment key={date}>
              {/* Sunday Services Container */}
              {sundayEvents.length > 0 && (
                <Container style={{ ...container, marginTop: '24px' }} className="container">
                  {dateIndex > 0 && (
                    <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
                  )}

                  <Heading style={defaultText}>
                    Arrangements for {getDateFormatted(date)}
                  </Heading>

                  {/* Sunday Services */}
                  {sundayEvents.map((event: any, index: number) => {
                    if (event.Key === 'sundaySchool') {
                      return (
                        <Section key={`ss-${index}`} style={program}>
                          <Heading style={defaultText}>Sunday School at 9:30am</Heading>
                          {event.Refreshments ? (
                            <Text style={defaultText}>
                              {'Refreshments: '}
                              <strong>{event.Refreshments}</strong>
                            </Text>
                          ) : (
                            <Text style={defaultText}>{'No Sunday school this week!'}</Text>
                          )}
                          {index < sundayEvents.length - 1 && (
                            <hr style={{ borderWidth: '0', background: '#ddd', color: '#ddd', height: '1px' }} />
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
                                    <Column style={columnAlignTop}>{MemorialServiceProgram(event)}</Column>
                                  </Row>
                                  <Row align="left" width={'49%'} className="deviceWidth">
                                    <Column style={columnAlignTop}>{hymnsContent}</Column>
                                  </Row>
                                </>
                              ) : (
                                // Single column layout when no hymns
                                <Row>
                                  <Column style={columnAlignTop}>{MemorialServiceProgram(event)}</Column>
                                </Row>
                              )}
                            </Column>
                          </Row>
                        </Section>
                      )
                    }
                    return null
                  })}
                </Container>
              )}

              {/* Bible Class - Standalone without "Arrangements" header */}
              {bibleClassEvents.map((event: any, index: number) => (
                <Container key={`bc-${date}-${index}`} style={{ ...container, marginTop: '24px' }} className="container">
                  <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
                  <Section style={program}>
                    <Heading style={defaultText}>
                      Bible Class for {getDateFormatted(event.Date)} at 7:30pm - on Zoom
                    </Heading>
                    <Row>
                      <Column style={columnAlignTop}>{BibleClassProgram(event)}</Column>
                    </Row>
                  </Section>
                </Container>
              ))}
            </React.Fragment>
          )
        })}

        {/* Learn to Read the Bible Seminars */}
        {(() => {
          // Find the LTRTBE recurring event
          const ltrtbeEvent = allUpcomingEvents.find(event =>
            event.type === 'recurring' &&
            (event.title?.toLowerCase().includes('learn to read the bible') ||
             event.title?.toLowerCase().includes('ltrtbe'))
          )

          if (ltrtbeEvent && (ltrtbeEvent as any).recurringConfig) {
            const config = (ltrtbeEvent as any).recurringConfig
            const nextDate = getNextRecurrenceDate(config)

            return (
              <Container style={container} className="container">
                <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
                <Section>
                  <Heading style={defaultText}>Learn To Read The Bible Effectively</Heading>
                  <Heading style={defaultText}>
                    Next session: {nextDate ? nextDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Date TBD'} at 7:00-8:30 pm at the Hall
                  </Heading>
                  <Text style={defaultText}>
                    Please join us for our seminars: Learn to Read the Bible Effectively.
                    <br />
                    All welcome!
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
                      <hr style={{ borderWidth: '0', background: '#ccc', color: '#ccc', height: '1px', margin: '16px 0' }} />
                    )}
                    <Section style={program}>
                      <Text style={defaultText}>
                        <Link
                          href={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://torontoeast.com'}/events/${event.id}`}
                          style={{
                            color: '#0066cc',
                            textDecoration: 'none',
                            fontWeight: 'bold'
                          }}
                        >
                          {event.title}
                        </Link>
                        {(event as any).theme && ` - ${(event as any).theme}`}
                        <br />
                        {EventDateDisplay(event)}
                        {event.description && (
                          <>
                            <br />
                            {event.description}
                          </>
                        )}
                      </Text>
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
                    <th style={{
                      padding: '10px 8px',
                      border: '1px solid #dee2e6',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: '#495057'
                    }}>Day</th>
                    <th style={{
                      padding: '10px 8px',
                      border: '1px solid #dee2e6',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: '#495057'
                    }}>Reading 1</th>
                    <th style={{
                      padding: '10px 8px',
                      border: '1px solid #dee2e6',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: '#495057'
                    }}>Reading 2</th>
                    <th style={{
                      padding: '10px 8px',
                      border: '1px solid #dee2e6',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: '#495057'
                    }}>Reading 3</th>
                  </tr>
                </thead>
                <tbody>
                  {allReadings.map((reading: any, index: number) => {
                    const isEvenRow = index % 2 === 0
                    const rowBgColor = isEvenRow ? '#ffffff' : '#f8f9fa'

                    return (
                      <tr key={index} style={{ backgroundColor: rowBgColor }}>
                        <td style={{
                          padding: '10px 8px',
                          border: '1px solid #dee2e6',
                          verticalAlign: 'top',
                          minWidth: '90px',
                          fontSize: '13px',
                          fontWeight: 'bold'
                        }}>
                          {formatReadingDate(reading.date)}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          border: '1px solid #dee2e6',
                          verticalAlign: 'top',
                          fontSize: '13px'
                        }}>
                          {reading.reading1}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          border: '1px solid #dee2e6',
                          verticalAlign: 'top',
                          fontSize: '13px'
                        }}>
                          {reading.reading2}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          border: '1px solid #dee2e6',
                          verticalAlign: 'top',
                          fontSize: '13px'
                        }}>
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
                    <div className="mobile-date">
                      {formatReadingDate(reading.date)}
                    </div>
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
  if (event.Exhort === '') {
    return (
      /**
       * When there's no Memorial Service at TEE's Hall, we need to provide clear alternatives.
       */
      <Text style={defaultText}>
        <strong>There will be no Memorial service at the Toronto East Hall.</strong>
        {event['Holidays and Special Events'] && (
          <Text>{event['Holidays and Special Events']}</Text>
        )}
      </Text>
    );
  }
  return (
    <Text style={defaultText}>
      {'Presiding: '}
      <strong>{event.Preside}</strong>
      <br />
      {'Exhorting: '}
      <strong>{event.Exhort}</strong>
      <br />
      {'Keyboardist: '}
      <strong>{event.Organist}</strong>
      <br />
      {'Stewart: '}
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

const Hymns = (event: MemorialServiceType) => {
  // Check if any hymn numbers are provided
  const hasHymns = event['Hymn-opening'] ||
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
