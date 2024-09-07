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
  footer,
  footerText,
  header,
  info,
  link,
  main,
  program,
} from '../styles'
import * as React from 'react'
import type { NextSundaySchoolProps, SundaySchoolType } from 'app/types'
import { ProgramsTypes } from 'app/types'

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

export const SundaySchool: React.FC<NextSundaySchoolProps> = ({ events }) => {
  const sundaySchoolEvents = events || mockEvents
  console.log('SundaySchool', { mockEvents, sundaySchoolEvents })
  return (
    <Html lang="en">
      <Head />
      <Preview>Sunday School Reminder</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Sunday School</Heading>
          <Text style={defaultText}>2023/2024 News and Reminders</Text>
        </Section>

        <Container style={container}>
          <Section style={program}>
            <Text style={defaultText}>
              Please join us for Sunday School at the Toronto East Hall.
            </Text>
          </Section>
          <Row>
            {sundaySchoolEvents[0] && <SundaySchoolProgram event={sundaySchoolEvents[0]} />}
            {sundaySchoolEvents[1] && <SundaySchoolProgram event={sundaySchoolEvents[1]} />}
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
              <br />
              <strong>10:20</strong> The kids will be invited to congregate around the Piano for a
              closing hymn and prayer.
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
        <Section style={footer}>
          <Text style={footerText}>
            <strong>Our address is:</strong>
            <br />
            Toronto East Christadelphians
            <br />
            975 Cosburn Avenue
            <br />
            Toronto, On M4C 2W8
            <br />
            Canada
          </Text>
        </Section>
      </Body>
    </Html>
  )
}

type EventProps = {
  event: SundaySchoolType | undefined
}

const SundaySchoolProgram = ({ event }: EventProps) => {
  console.log('event', event)
  if (!event) {
    return (
      <Column style={columnAlignTop}>
        <Text style={defaultText}>
          <strong>Sunday School is in recess</strong>
        </Text>
      </Column>
    )
  }
  if (event.Refreshments) {
    return (
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
    )
  } else {
    return (
      <Column style={columnAlignTop}>
        <Text style={defaultText}>
          <strong>{event.Date.toString()}</strong>
          <br />
          {event['Holidays and Special Events']}
        </Text>
      </Column>
    )
  }
}
