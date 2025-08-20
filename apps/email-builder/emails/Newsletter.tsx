import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Row,
  Section,
  Text,
  Button,
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
import { CurrentWeekData } from '@my/app/types/newsletter'
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
  {
    Key: ProgramsTypes.bibleClass,
    Date: 'Feb 28, 2004',
    Presider: 'Presiding',
    Speaker: 'Speaker',
    Topic: 'Bible Class Topic',
  },
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
    Refreshments: 'Eassons',
    'Holidays and Special Events': 'Toronto Fraternal Gathering',
  },
  {
    Key: ProgramsTypes.bibleClass,
    Date: 'Mar 6, 2004',
    Presider: 'Presiding 2',
    Speaker: 'Speaker 2',
    Topic: 'Bible Class Topic 2',
  },
]

function getDateFormatted(date: Date | string): string {
  if (typeof date === 'string') {
    const when = new Date(date)
    return when.toDateString()
  }
  return date.toDateString()
}

// Newsletter Header Component
const NewsletterHeader: React.FC<{ date: string }> = ({ date }) => (
  <Section style={header}>
    <Heading>Toronto East Newsletter</Heading>
    <Text style={defaultText}>{date}</Text>
    <Text style={defaultText}>
      <Text>
        {
          'This email is intended for Christadelphians and friends, whether we meet in person or on Zoom.'
        }
      </Text>
      <br />
      <Text>{`All plans are subject to God's will.`}</Text>
    </Text>
  </Section>
)

// Weekly Events Section Component
const WeeklyEventsSection: React.FC<{
  title: string
  events: any[]
  isCurrentWeek: boolean
}> = ({ title, events, isCurrentWeek }) => {
  // Sort events by date, then by time (Sunday School before Memorial)
  const sortedEvents = events.sort((a, b) => {
    const dateCompare = new Date(a.Date).getTime() - new Date(b.Date).getTime()
    if (dateCompare !== 0) return dateCompare

    // Same date: Sunday School (9:30) comes before Memorial (11:00)
    if (a.Key === ProgramsTypes.sundaySchool) return -1
    if (b.Key === ProgramsTypes.sundaySchool) return 1
    return 0
  })

  // Group events by date
  const eventsByDate = sortedEvents.reduce(
    (acc, event) => {
      const date = event.Date
      if (!acc[date]) acc[date] = []
      acc[date].push(event)
      return acc
    },
    {} as Record<string, any[]>
  )

  return (
    <Container style={{ ...container, marginTop: '24px' }} className="container">
      <Heading style={defaultText}>{title}</Heading>
      {Object.entries(eventsByDate).map(([date, dayEvents]) => (
        <DayEventsSection key={date} date={date} events={dayEvents} />
      ))}
    </Container>
  )
}

// Day Events Section (Memorial + Sunday School for same day)
const DayEventsSection: React.FC<{
  date: string
  events: any[]
}> = ({ date, events }) => {
  const memorialEvent = events.find((e) => e.Key === ProgramsTypes.memorial)
  const sundaySchoolEvent = events.find((e) => e.Key === ProgramsTypes.sundaySchool)
  const bibleClassEvent = events.find((e) => e.Key === ProgramsTypes.bibleClass)

  return (
    <Section style={program}>
      <Heading style={defaultText}>Arrangements for {getDateFormatted(date)}</Heading>

      {/* Sunday School Section */}
      {(memorialEvent || sundaySchoolEvent) && (
        <SundaySchoolSection memorialEvent={memorialEvent} sundaySchoolEvent={sundaySchoolEvent} />
      )}

      {/* Memorial Service Section */}
      {memorialEvent && <MemorialServiceSection event={memorialEvent} />}

      {/* Bible Class Section */}
      {bibleClassEvent && <BibleClassSection event={bibleClassEvent} />}
    </Section>
  )
}

// Sunday School Section
const SundaySchoolSection: React.FC<{
  memorialEvent?: any
  sundaySchoolEvent?: any
}> = ({ memorialEvent, sundaySchoolEvent }) => {
  const hasRefreshments = memorialEvent?.Refreshments || sundaySchoolEvent?.Refreshments
  const hasSpecialEvents =
    memorialEvent?.['Holidays and Special Events'] ||
    sundaySchoolEvent?.['Holidays and Special Events']

  return (
    <>
      <Section style={program}>
        <Heading style={defaultText}>Sunday School at 9:30am</Heading>
        {hasRefreshments ? (
          <Text style={defaultText}>
            <Text>{'Refreshments: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{hasRefreshments}</Text>
          </Text>
        ) : (
          <Text style={defaultText}>{'No Sunday school this week!'}</Text>
        )}
        {hasSpecialEvents && (
          <Text style={defaultText}>
            <Text style={{ fontWeight: 'bold' }}>{hasSpecialEvents}</Text>
          </Text>
        )}
      </Section>
      <hr style={{ borderWidth: '0', background: '#333', color: '#333', height: '1px' }} />
    </>
  )
}

// Memorial Service Section
const MemorialServiceSection: React.FC<{ event: any }> = ({ event }) => (
  <Section style={program}>
    <Heading style={defaultText}>Memorial Service at 11:00am</Heading>
    <Row>
      <Column>
        <Row align="left" className="two-column deviceWidth">
          <Column style={columnAlignTop}>
            <MemorialServiceProgram event={event} />
          </Column>
        </Row>
        <Row align="left" className="two-column deviceWidth">
          <Column style={columnAlignTop}>
            <Hymns event={event} />
          </Column>
        </Row>
      </Column>
    </Row>
  </Section>
)

// Bible Class Section
const BibleClassSection: React.FC<{ event: any }> = ({ event }) => (
  <Section style={program}>
    <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
    <Heading style={defaultText}>
      Bible Class for {getDateFormatted(event.Date)} at 7:30pm - on Zoom
    </Heading>
    <Row>
      <Column style={columnAlignTop}>
        <BibleClassProgram event={event} />
      </Column>
    </Row>
  </Section>
)

// Daily Readings Section (Current Week Data)
const DailyReadingsSection: React.FC<{ readings: CurrentWeekData['dailyReadings'] }> = ({ readings }) => (
  <Container style={{ ...container, marginTop: '16px' }} className="container">
    <Section style={{ ...program, paddingTop: '12px', paddingBottom: '12px' }}>
      <Heading style={{ ...defaultText, marginBottom: '8px' }}>Daily Bible Readings</Heading>
      {readings.map((reading, index) => (
        <Text key={index} style={{ ...defaultText, marginBottom: '4px' }}>
          <Text style={{ fontWeight: 'bold' }}>{reading.dayName}: </Text>
          <Text>{reading.reading1}, {reading.reading2}, {reading.reading3}</Text>
        </Text>
      ))}
    </Section>
  </Container>
)

// Current Bible Class Section (This Week)
const CurrentBibleClassSection: React.FC<{ bibleClass: CurrentWeekData['bibleClass']['current'] }> = ({ bibleClass }) => (
  <Container style={{ ...container, marginTop: '12px' }} className="container">
    <Section style={{ ...program, paddingTop: '12px', paddingBottom: '12px' }}>
      <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px', marginBottom: '8px' }} />
      <Heading style={{ ...defaultText, marginBottom: '6px' }}>
        Bible Class for {getDateFormatted(bibleClass.date)} at 7:30pm - on Zoom
      </Heading>
      <Text style={defaultText}>
        <Text>{'Speaker: '}</Text>
        <Text style={{ fontWeight: 'bold' }}>{bibleClass.speaker}</Text>
        <br />
        <Text style={{ fontWeight: 'bold' }}>{bibleClass.topic}</Text>
        {bibleClass.notes && (
          <>
            <br />
            <Text>{bibleClass.notes}</Text>
          </>
        )}
      </Text>
    </Section>
  </Container>
)

// Next Bible Class Section (Next Week)
const NextBibleClassSection: React.FC<{ bibleClass: CurrentWeekData['bibleClass']['next'] }> = ({ bibleClass }) => (
  <Container style={{ ...container, marginTop: '12px' }} className="container">
    <Section style={{ ...program, paddingTop: '12px', paddingBottom: '12px' }}>
      <Heading style={{ ...defaultText, marginBottom: '6px' }}>
        Next Bible Class for {getDateFormatted(bibleClass.date)} at 7:30pm - on Zoom
      </Heading>
      <Text style={defaultText}>
        <Text>{'Speaker: '}</Text>
        <Text style={{ fontWeight: 'bold' }}>{bibleClass.speaker}</Text>
        <br />
        <Text style={{ fontWeight: 'bold' }}>{bibleClass.topic}</Text>
        {bibleClass.notes && (
          <>
            <br />
            <Text>{bibleClass.notes}</Text>
          </>
        )}
      </Text>
    </Section>
  </Container>
)

// Sunday School Section (Current Week Data)
const SundaySchoolCurrentSection: React.FC<{ sundaySchool: CurrentWeekData['sundaySchool'] }> = ({ sundaySchool }) => (
  <Container style={{ ...container, marginTop: '12px' }} className="container">
    <Section style={{ ...program, paddingTop: '12px', paddingBottom: '12px' }}>
      <Heading style={{ ...defaultText, marginBottom: '6px' }}>
        Sunday School for {getDateFormatted(sundaySchool.date)} at 9:30am
      </Heading>
      <Text style={defaultText}>
        <Text>{'Refreshments: '}</Text>
        <Text style={{ fontWeight: 'bold' }}>{sundaySchool.refreshments}</Text>
        {sundaySchool.notes && (
          <>
            <br />
            <Text>{sundaySchool.notes}</Text>
          </>
        )}
        {sundaySchool.specialEvents && (
          <>
            <br />
            <Text style={{ fontWeight: 'bold' }}>{sundaySchool.specialEvents}</Text>
          </>
        )}
      </Text>
      <hr style={{ borderWidth: '0', background: '#333', color: '#333', height: '1px', marginTop: '8px' }} />
    </Section>
  </Container>
)

// Memorial Service Section (Current Week Data)
const MemorialCurrentSection: React.FC<{ memorial: CurrentWeekData['memorial'] }> = ({ memorial }) => (
  <Container style={{ ...container, marginTop: '12px' }} className="container">
    <Section style={{ ...program, paddingTop: '12px', paddingBottom: '12px' }}>
      <Heading style={{ ...defaultText, marginBottom: '6px' }}>
        Memorial Service for {getDateFormatted(memorial.date)} at 11:00am
      </Heading>
      <Row>
        <Column>
          <Text style={defaultText}>
            <Text>{'Presiding: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{memorial.preside}</Text>
            <br />
            <Text>{'Exhorting: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{memorial.exhort}</Text>
            <br />
            <Text>{'Keyboardist: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{memorial.organist}</Text>
            <br />
            <Text>{'Steward: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{memorial.steward}</Text>
            <br />
            <Text>{'Doorkeeper: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{memorial.doorkeeper}</Text>
            <br />
            <br />
            <Text>{'Collection: '}</Text>
            <Text style={{ fontWeight: 'bold' }}>{memorial.collection}</Text>
            <br />
            <Text style={{ fontWeight: 'bold' }}>{memorial.lunch}</Text>
          </Text>
        </Column>
      </Row>
    </Section>
  </Container>
)

// Standing Sections (Always included) - Reduced spacing
const StandingSections: React.FC = () => (
  <Container style={{ ...container, marginTop: '16px' }} className="container">
    <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
    <Section style={{ paddingTop: '12px', paddingBottom: '12px' }}>
      <Heading style={{ ...defaultText, marginBottom: '6px' }}>Learn To Read The Bible Effectively</Heading>
      <Heading style={{ ...defaultText, marginBottom: '6px' }}>Every Monday from 7:00-8:30 pm at the Hall</Heading>
      <Text style={defaultText}>
        <Text>Please join us for our seminars: Learn to Read the Bible Effectively.</Text>
        <br />
        <Text>All welcome!</Text>
      </Text>
    </Section>
  </Container>
)

// Dynamic section configuration
interface NewsletterSection {
  id: string
  title: string
  events: ProgramsTypes[]
  priority: number
  isVisible: boolean
}

// Enhanced newsletter component with dynamic sections
const Newsletter: React.FC<NextNewsletterProps & { currentWeekData?: CurrentWeekData; mode?: 'email' | 'web' }> = ({ events, currentWeekData, mode = 'email' }) => {
  const todaysDate = new Date().toDateString()
  
  // Debug logging
  console.log('📰 Newsletter Component:')
  console.log('- Current week data provided:', !!currentWeekData)
  console.log('- Mode:', mode)
  
  if (currentWeekData) {
    console.log('- Week range:', currentWeekData.weekRange)
    console.log('- Bible class current:', currentWeekData.bibleClass.current)
    console.log('- Daily readings count:', currentWeekData.dailyReadings.length)
  }

  // Use current week data if provided, otherwise fallback to events or mock data
  const useCurrentWeekData = currentWeekData && mode === 'email'

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Toronto East Christadelphian Ecclesia's Newsletter</Preview>
      <Body style={main} className="email-container">
        {/* Header Section */}
        <NewsletterHeader date={todaysDate} />

        {useCurrentWeekData ? (
          <>
            {/* Daily Readings Section */}
            <DailyReadingsSection readings={currentWeekData.dailyReadings} />
            
            {/* This Week's Bible Class */}
            <CurrentBibleClassSection bibleClass={currentWeekData.bibleClass.current} />
            
            {/* Next Week's Bible Class */}
            <NextBibleClassSection bibleClass={currentWeekData.bibleClass.next} />
            
            {/* Sunday School */}
            <SundaySchoolCurrentSection sundaySchool={currentWeekData.sundaySchool} />
            
            {/* Memorial Service */}
            <MemorialCurrentSection memorial={currentWeekData.memorial} />
          </>
        ) : (
          <>
            {/* Fallback to old system for non-email mode or when no current data */}
            {events && events.length > 0 ? (
              <WeeklyEventsSection
                title="This Week's Arrangements"
                events={events}
                isCurrentWeek={true}
              />
            ) : (
              <WeeklyEventsSection
                title="This Week's Arrangements"
                events={mockEvents}
                isCurrentWeek={true}
              />
            )}
          </>
        )}

        {/* Standing Sections */}
        <StandingSections />

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

const MemorialServiceProgram: React.FC<{ event: any }> = ({ event }) => {
  if (event.Exhort === '') {
    return (
      <Text style={defaultText}>
        <Text style={{ fontWeight: 'bold' }}>
          There will be no Memorial service at the Toronto East Hall.
        </Text>
        {event['Holidays and Special Events'] ? (
          <Text>{event['Holidays and Special Events']}</Text>
        ) : null}
      </Text>
    )
  }

  return (
    <Text style={defaultText}>
      <Text>{'Presiding: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Preside}</Text>
      <br />
      <Text>{'Exhorting: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Exhort}</Text>
      <br />
      <Text>{'Keyboardist: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Organist}</Text>
      <br />
      <Text>{'Steward: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Steward}</Text>
      <br />
      <Text>{'Doorkeeper: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Doorkeeper}</Text>
      <br />
      <br />
      {event.Collection ? (
        <Text style={{ fontWeight: 'bold' }}>
          <Text>{'Second Collection is for '}</Text>
          <Text>{event.Collection}</Text>
        </Text>
      ) : (
        <Text>No Second Collection.</Text>
      )}
      <Lunch lunch={event.Lunch} />
    </Text>
  )
}

const Hymns: React.FC<{ event: any }> = ({ event }) => {
  return (
    <Text style={defaultText}>
      <Text style={{ fontWeight: 'bold' }}>Hymns</Text>
      <br />
      <Text>{'Opening: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event['Hymn-opening']}</Text>
      <br />
      <Text>{'Exhortation: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event['Hymn-exhortation']}</Text>
      <br />
      <Text>{'Memorial: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event['Hymn-memorial']}</Text>
      <br />
      <Text>{'Closing: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event['Hymn-closing']}</Text>
      <br />
    </Text>
  )
}

const BibleClassProgram: React.FC<{ event: any }> = ({ event }) => {
  if (event.Topic === '') {
    return (
      <Text style={defaultText}>
        <Text style={{ fontWeight: 'bold' }}>There is No Bible Class Tonight.</Text>
      </Text>
    )
  }
  return (
    <Text style={defaultText}>
      <Text>{'Presiding: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Presider}</Text>
      <br />
      <Text>{'Leading: '}</Text>
      <Text style={{ fontWeight: 'bold' }}>{event.Speaker}</Text>
      <br />
      <Text style={{ fontWeight: 'bold' }}>{event.Topic}</Text>
    </Text>
  )
}

export default Newsletter
