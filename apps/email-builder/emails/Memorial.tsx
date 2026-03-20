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
import {
  columnAlignTop,
  container,
  defaultText,
  globalCss,
  header,
  link,
  main,
  weatherNotice,
  weatherNoticeText,
  program,
} from '../styles'
import React from 'react'
import type { MemorialServiceType, NextMemorialServiceProps, SundaySchoolType } from '@my/app/types'
import { ProgramsTypes } from '@my/app/types'
import type { Event } from '@my/app/types/events'
import { Footer } from '../components/Footer'
import { AutoLinkText } from '../components/AutoLinkText'
import { ReplacementEventCard, findReplacementEvent } from '../components/ReplacementEventCard'

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
const mockEvents: SundayEvents[] = [
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
    Activities: 'WEATHER NOTICE',
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
]

function formatDateToronto(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })
}

/**
 * Parse a date string from the events data and format it consistently.
 * The data comes as " Jan 4, 2026" (with leading space) or "Jan 4, 2026" format.
 * We parse it and reformat to ensure consistent display.
 */
function formatEventDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return ''

  // If it's already a formatted string like " Jan 4, 2026", clean it up and add weekday
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim()
    // Parse the date string and create a Date object at noon to avoid timezone issues
    const parsed = new Date(trimmed + ' 12:00:00')
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return trimmed // Return as-is if parsing fails
  }

  // If it's a Date object
  return formatDateToronto(dateStr)
}

const MemorialService: React.FC<NextMemorialServiceProps> = ({ events, note, upcomingEvents }) => {
  const sundayEvents = events || mockEvents

  // Use the actual dates from the events data instead of calculating them
  // This ensures we display the correct date regardless of server timezone
  const sundaysDateString = formatEventDate(sundayEvents[0]?.Date)
  const secondSundayDateString = formatEventDate(sundayEvents[1]?.Date)

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Sunday Recap and Connection Info.</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Christadelphians</Heading>
          <Text style={defaultText}>{sundaysDateString}</Text>
          <Text style={defaultText}>All arrangements are subject to God&apos;s will.</Text>
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

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {sundayEvents[0] !== undefined && (() => {
            // Check if this Sunday has a replacement event (no service at hall + event title in Lunch)
            const hasReplacementEvent = !sundayEvents[0].Exhort && !sundayEvents[0].Preside &&
              sundayEvents[0].Lunch?.trim() &&
              findReplacementEvent(upcomingEvents || [], sundayEvents[0].Lunch.trim())

            if (hasReplacementEvent) {
              // Replacement event: skip Sunday School and Memorial headers, just show the event card
              return (
                <Section style={program}>
                  {MemorialServiceProgram(sundayEvents[0], upcomingEvents)}
                </Section>
              )
            }

            // Normal rendering: Sunday School + Memorial Service
            return (
              <>
                <Section style={program}>
                  <Heading style={defaultText}>Sunday School at 9:30am</Heading>
                  {sundayEvents[0].Refreshments ? (
                    <Text style={defaultText}>
                      {'Refreshments: '}
                      <strong>{sundayEvents[0].Refreshments}</strong>
                    </Text>
                  ) : (
                    <Text style={defaultText}>{'No Sunday school this week!'}</Text>
                  )}
                </Section>
                <hr />
                <Section style={program}>
                  <Heading style={defaultText}>Memorial Service at 11:00am</Heading>
                  <Row>
                    <Column>
                      <Row align="left" width={'49%'} className="deviceWidth">
                        <Column style={columnAlignTop}>
                          {MemorialServiceProgram(sundayEvents[0], upcomingEvents)}
                        </Column>
                      </Row>

                      <Row align="left" width={'49%'} className="deviceWidth">
                        <Column style={columnAlignTop}>
                          <Text style={defaultText}>
                            <strong>Hymns</strong>
                            <br />
                            {'Opening: '}
                            <strong>{sundayEvents[0]['Hymn-opening']}</strong>
                            <br />
                            {'Exhortation: '}
                            <strong>{sundayEvents[0]['Hymn-exhortation']}</strong>
                            <br />
                            {'Memorial: '}
                            <strong>{sundayEvents[0]['Hymn-memorial']}</strong>
                            <br />
                            {'Closing: '}
                            <strong>{sundayEvents[0]['Hymn-closing']}</strong>
                            <br />
                          </Text>
                        </Column>
                      </Row>
                    </Column>
                  </Row>
                </Section>
              </>
            )
          })()}
          <hr />
        </Container>
        <Container style={container} className="container zoom-info">
          <Heading style={defaultText}>Join us on Zoom</Heading>
          <Text style={defaultText}>
            <Link
              href="https://us04web.zoom.us/j/586952386?pwd=Z2svVG0zTmNlTWx2MTFoMlZIaDZLQT09"
              style={link}
            >
              Click to join Zoom
            </Link>
          </Text>
          <Text style={defaultText}>
            <br />
            Meeting ID: 586 952 386
            <br />
            Password: 036110
          </Text>
          <Text style={defaultText}>
            Join by phone
            <br />
            +1 647 374 4685 Canada (Toronto)
            <br />
            +1 647 558 0588 Canada (Toronto)
          </Text>
          <hr />
        </Container>
        <Container style={container} className="container youtube-info">
          {sundayEvents[0]?.YouTube ? (
            <>
              <Heading style={defaultText}>Join us on YouTube</Heading>
              <Text style={defaultText}>
                <Link href={sundayEvents[0].YouTube} style={link}>
                  {sundayEvents[0].YouTube}
                </Link>
              </Text>
            </>
          ) : null}
          <Text style={defaultText}>Visit the Toronto East Christadelphians YouTube channel:</Text>
          <Text style={defaultText}>
            <Link href="https://www.youtube.com/channel/UCyJamaI5mQImCF8hWE7Yp-w" style={link}>
              YouTube Channel
            </Link>
          </Text>
        </Container>
        <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
        {(sundayEvents[1]?.Exhort || sundayEvents[1]?.['Holidays and Special Events']) && (
          <Container style={container} className="container youtube-info">
            <Heading style={defaultText}>Arrangements for {secondSundayDateString}</Heading>
            <Row>
              <Column style={columnAlignTop}>{MemorialServiceProgram(sundayEvents[1], upcomingEvents)}</Column>
            </Row>
          </Container>
        )}
        <Container>
          <Text>&nbsp;</Text>
        </Container>
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
      <br />
      <strong>{lunch}</strong>
    </>
  )
}

const Parking = () => {
  return (
    <Section style={weatherNotice}>
      <Container style={weatherNotice}>
        <Text style={weatherNoticeText}>
          <strong>Parking at the Hall:</strong>
          <br /> The parking lot will fit about 5 cars.
          <br />
          There is plenty of parking 400 meters down Haldon Ave. (across from the Hall) in the
          Taylor Creek Park Public parking. The lot has been mostly cleared of snow.
          <br />
          If needed, please coordinate rides from the parking lot; Bro. Jim Perks has offered to
          coordinate this.
        </Text>
      </Container>
    </Section>
  )
}

const MemorialServiceProgram = (event: SundayEvents, upcomingEvents?: Event[]) => {
  // No service at hall: Both Exhort AND Preside are blank
  const noServiceAtHall = !event.Exhort && !event.Preside

  if (noServiceAtHall) {
    // If Lunch contains an event title, find the matching event and render it inline
    const eventTitle = event.Lunch?.trim()
    const replacementEvent = eventTitle ? findReplacementEvent(upcomingEvents || [], eventTitle) : undefined
    const explanation = event.Activities || event['Holidays and Special Events']

    if (replacementEvent) {
      return <ReplacementEventCard event={replacementEvent} explanation={explanation} />
    }

    // Fallback: no matching event found, show simple "no service" message
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

export default MemorialService
