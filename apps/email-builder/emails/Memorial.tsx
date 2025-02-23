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

function getDateFormatted(date: Date | string): string {
  if (typeof date === 'string') {
    const when = new Date(date)
    return when.toDateString()
  }
  return date.toDateString()
}

const MemorialService: React.FC<NextMemorialServiceProps> = ({ events }) => {
  const sundaysDateString = getNextDayOfTheWeek('sun').toDateString()
  const sundayEvents = events || mockEvents

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Sunday Recap and Connection Info.</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Christiadelphians</Heading>
          <Text style={defaultText}>{sundaysDateString}</Text>
          <text>{'All arrangements are subject to God’s will.'}</text>
        </Section>

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

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {sundayEvents[0] !== undefined && (
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
            </>
          )}
          {sundayEvents[0] && (
            <Section style={program}>
              <Heading style={defaultText}>Memorial Service at 11:00am</Heading>
              <Row>
                <Column>
                  <Row align="left" width={'49%'} className="deviceWidth">
                    <Column style={columnAlignTop}>
                      {MemorialServiceProgram(sundayEvents[0])}
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
          )}
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
          {sundayEvents[0]?.YouTube !== undefined && (
            <>
              <Heading style={defaultText}>Join us on YouTube</Heading>
              <Text style={defaultText}>
                <Link href={sundayEvents[0].YouTube} style={link}>
                  Click to join on YouTube
                </Link>
              </Text>
            </>
          )}
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
            <Heading style={defaultText}>
              Arrangements for {getDateFormatted(sundayEvents[1].Date)}
            </Heading>
            <Row>
              <Column style={columnAlignTop}>{MemorialServiceProgram(sundayEvents[1])}</Column>
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
    )
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

export default MemorialService
