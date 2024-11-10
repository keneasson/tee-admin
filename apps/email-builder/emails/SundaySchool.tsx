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
  info,
  link,
  main,
  program,
} from '../styles'
import React from 'react'
import type { NextSundaySchoolProps, SundaySchoolType } from '@my/app/types'
import { ProgramsTypes } from '@my/app/types'
import { Footer } from '../components/Footer'

const mockEvents: SundaySchoolType[] = [
  {
    Key: ProgramsTypes.sundaySchool,
    Date: 'Feb 25, 2024',
    Refreshments: 'Eassons',
  },
  {
    Key: ProgramsTypes.sundaySchool,
    Date: 'March 3, 2024',
    Refreshments: 'Currys',
  },
]

const SundaySchool: React.FC<NextSundaySchoolProps> = ({ events }) => {
  const sundaySchoolEvents = events || mockEvents

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Sunday School Reminder</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Sunday School</Heading>
          <Text style={defaultText}>2024/2025 News and Reminders</Text>
        </Section>

        <Container style={container} className="container">
          <Section style={program}>
            <Text style={defaultText}>
              Please join us for Sunday School at the Toronto East Hall.
            </Text>
          </Section>
          <Row>
            <Column>
              {sundaySchoolEvents[0] && <SundaySchoolProgram event={sundaySchoolEvents[0]} />}
              {sundaySchoolEvents[1] && <SundaySchoolProgram event={sundaySchoolEvents[1]} />}
            </Column>
          </Row>
          <Section style={info}>
            <Heading style={defaultText}>Refreshments Schedule</Heading>
            <Text style={defaultText}>
              To view the entire schedule for the Sunday School year, Visit the TEE Admin website -
              schedules section
            </Text>
            <Section>
              <Link href="http://www.tee-admin.com/schedule" style={link}>
                View online
              </Link>
            </Section>
          </Section>
          <Section>
            <Heading style={defaultText}>Class Format</Heading>

            <Text style={defaultText}>
              Children are asked to find their classroom by 9:30 am,
              <br />
              <strong>9:30</strong> Sunday School will be opened with a communal Prayer
            </Text>
          </Section>
          <Section>
            <Heading style={defaultText}>Newsletter</Heading>
            <Text style={defaultText}>
              If you know someone who would like to receive this newsletter, or if you would like to
              be removed from this newsletter, please let Bro. Ken Easson know. Unsubscribing using
              the link below, will remove you from all Toronto East Newsletters.
            </Text>
          </Section>
        </Container>
        <Footer />
      </Body>
    </Html>
  )
}

type EventProps = {
  event: SundaySchoolType | undefined
}

export const SundaySchoolProgram = ({ event }: EventProps) => {
  console.log('event', event)
  if (!event) {
    return (
      <Row align="left" width={'49%'} className="deviceWidth">
        <Column style={columnAlignTop}>
          <Text style={defaultText}>
            <strong>Sunday School is in recess</strong>
          </Text>
        </Column>
      </Row>
    )
  }
  if (event.Refreshments) {
    return (
      <Row align="left" width={'49%'} className="deviceWidth">
        <Column style={columnAlignTop}>
          <Text style={defaultText}>
            <strong>{event.Date.toString()}</strong>
            <br />
            Start time: 9:30 am
            <br />
            Refreshments: {event.Refreshments}
            {event['Holidays and Special Events'] && (
              <>
                <br />
                {event['Holidays and Special Events']}
              </>
            )}
          </Text>
        </Column>
      </Row>
    )
  } else {
    return (
      <Row align="left" width={'49%'} className="deviceWidth">
        <Column style={columnAlignTop}>
          <Text style={defaultText}>
            <strong>{event.Date.toString()}</strong>
            <br />
            {event['Holidays and Special Events']}
          </Text>
        </Column>
      </Row>
    )
  }
}

export default SundaySchool
