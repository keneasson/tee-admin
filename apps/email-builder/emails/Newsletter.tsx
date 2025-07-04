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

const Newsletter: React.FC<NextNewsletterProps> = ({ events }) => {
  const todaysDate = new Date().toDateString()
  const allEvents = events || mockEvents

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Toronto East Christadelphian Ecclesia's Newsletter</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Newsletter</Heading>
          <Text style={defaultText}>{todaysDate}</Text>
          <text>
            {
              'This email is intended for Christadelphians and friends, whether we meet in person or on Zoom.'
            }
            <br />
            {'All plans are subject to God’s will.'}
          </text>
        </Section>
        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {allEvents[0] && allEvents?.[0].Key === ProgramsTypes.memorial && (
            <>
              <Heading style={defaultText}>
                Arrangements for {getDateFormatted(allEvents[0].Date)}
              </Heading>
              <Section style={program}>
                <Heading style={defaultText}>Sunday School at 9:30am</Heading>
                {allEvents[0].Refreshments ? (
                  <Text style={defaultText}>
                    {'Refreshments: '}
                    <strong>{allEvents[0].Refreshments}</strong>
                  </Text>
                ) : (
                  <Text style={defaultText}>{'No Sunday school this week!'}</Text>
                )}
              </Section>
              <hr style={{ borderWidth: '0', background: '#333', color: '#333', height: '1px' }} />
            </>
          )}
          {allEvents[0] && allEvents?.[0].Key === ProgramsTypes.memorial && (
            <Section style={program}>
              <Heading style={defaultText}>Memorial Service at 11:00am</Heading>
              <Row>
                <Column>
                  <Row align="left" width={'49%'} className="deviceWidth">
                    <Column style={columnAlignTop}>{MemorialServiceProgram(allEvents[0])}</Column>
                  </Row>

                  <Row align="left" width={'49%'} className="deviceWidth">
                    <Column style={columnAlignTop}>{Hymns(allEvents[0])}</Column>
                  </Row>
                </Column>
              </Row>
            </Section>
          )}
          {allEvents[1] && allEvents[1].Key === ProgramsTypes.bibleClass && (
            <Section style={program}>
              <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
              <Heading style={defaultText}>
                Bible Class for {getDateFormatted(allEvents[1].Date)} at 7:30pm - on Zoom
              </Heading>
              <Row>
                <Column style={columnAlignTop}>{BibleClassProgram(allEvents[1])}</Column>
              </Row>
            </Section>
          )}
        </Container>
        {(allEvents[2] || allEvents[3]) && (
          <Container style={container} className="container">
            <hr style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }} />
            <Heading style={defaultText}>
              Arrangements for {getDateFormatted(allEvents[2].Date)}
            </Heading>
            {allEvents[2] && allEvents[2].Key === ProgramsTypes.memorial && (
              <>
                <Section style={program}>
                  <Heading style={defaultText}>Sunday School at 9:30am</Heading>
                  {allEvents[2].Refreshments ? (
                    <Text style={defaultText}>
                      {'Refreshments: '}
                      <strong>{allEvents[2].Refreshments}</strong>
                    </Text>
                  ) : (
                    <Text style={defaultText}>{'No Sunday school this week!'}</Text>
                  )}
                </Section>
                <hr
                  style={{ borderWidth: '0', background: '#333', color: '#333', height: '1px' }}
                />
              </>
            )}
            <Heading style={defaultText}>Memorial Service at 11:00am</Heading>
            <Row>
              <Column style={columnAlignTop}>{MemorialServiceProgram(allEvents[2])}</Column>
            </Row>
            {allEvents[3] && allEvents[3].Key === ProgramsTypes.bibleClass && (
              <Section style={program}>
                <hr
                  style={{ borderWidth: '0', background: '#000', color: '#000', height: '2px' }}
                />
                <Heading style={defaultText}>
                  Bible Class for {getDateFormatted(allEvents[3].Date)} at 7:30pm - on Zoom
                </Heading>
                <Row>
                  <Column style={columnAlignTop}>{BibleClassProgram(allEvents[3])}</Column>
                </Row>
              </Section>
            )}
          </Container>
        )}

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
  return (
    <Text style={defaultText}>
      <strong>Hymns</strong>
      <br />
      {'Opening: '}
      <strong>{event['Hymn-opening']}</strong>
      <br />
      {'Exhortation: '}
      <strong>{event['Hymn-exhortation']}</strong>
      <br />
      {'Memorial: '}
      <strong>{event['Hymn-memorial']}</strong>
      <br />
      {'Closing: '}
      <strong>{event['Hymn-closing']}</strong>
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
