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
    Exhort: 'Exorting Brother',
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
]

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
        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {sundayEvents[0] !== undefined && (
            <>
              <Section style={program}>
                <Heading style={defaultText}>Sunday School at 9:30am</Heading>
                <Text style={defaultText}>
                  {'Refreshments: '}
                  <strong>{sundayEvents[0].Refreshments}</strong>
                </Text>
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
        </Container>
        <hr />
        <Container style={container} className="container youtube-info">
          {sundayEvents[0]?.YouTube !== undefined && (
            <>
              <Heading style={defaultText}>Join us on YouTube</Heading>
              <Text style={defaultText}>
                <Link href={sundayEvents[0].YouTube} style={link}>
                  Click to join YouTube
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
          <hr />
        </Container>
        <Container>
          <Text style={defaultText}>
            To unsubscribe please contact the Recording Brother at teerecbro@gmail.com
            <br />
          </Text>
        </Container>

        <Footer />
      </Body>
    </Html>
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
      <strong>
        {'Second Collection is for '}
        {event.Collection}
      </strong>
    </Text>
  )
}

export default MemorialService
