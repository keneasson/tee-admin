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
  container,
  defaultText,
  globalCss,
  header,
  link,
  main,
  program,
  specialNoteContainer,
  specialNotice,
} from '../styles'
import React from 'react'
import type { BibleClassType, NextBibleClassProps } from '@my/app/types'
import { ProgramsTypes } from '@my/app/types'
import { Footer } from '../components/Footer'

const mockEvents: BibleClassType[] = [
  {
    Key: ProgramsTypes.bibleClass,
    Presider: 'Presiding Brother',
    Speaker: 'Speaking Brother',
    Topic: 'Topic',
    Date: 'Feb 25, 2024',
  },
]

const BibleClass: React.FC<NextBibleClassProps> = ({ events }) => {
  const bibleClassEvents = events || mockEvents
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Bible Class Tonight</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>Toronto East Bible Class</Heading>
        </Section>
        <Container style={container} className="container">
          <SpecialNotice />
          <Section style={program}>
            <Heading style={defaultText}>
              Please join us on Zoom for our Weekly Bible Class
              <br />
              7:30pm EST.
            </Heading>
          </Section>
          <Row>
            <Column>
              {bibleClassEvents[0] && <BibleClassProgram event={bibleClassEvents[0]} />}
            </Column>
          </Row>
        </Container>
        <Container style={container} className="container zoom-info">
          <Text style={defaultText}>
            <Link
              href="https://us02web.zoom.us/j/932385033?pwd=R1VOR3NDOTk1cXN2ZzFOdW14SnhxZz09"
              style={link}
            >
              Click to join Zoom
            </Link>
            <br />
            Meeting ID: 932 385 033
            <br />
            Password: 456345
          </Text>
          <Text style={defaultText}>
            Join by phone
            <br />
            +1 647 374 4685 Canada (Toronto)
            <br />
            +1 647 558 0588 Canada (Toronto)
          </Text>
        </Container>
        <Footer />
      </Body>
    </Html>
  )
}

const SpecialNotice = () => {
  return (
    <Container style={specialNoteContainer}>
      <Section style={specialNotice}>
        <Heading style={defaultText}>
          Special Note about Sunday! We plan to have the Service In Person.
        </Heading>
        <Text style={defaultText}>
          Bro. Andrew and Sis. Donna are planning to attend in person, and Lunch will be provided at
          the hall!
          <br />
          Please contact Sis. Pauline if you will bring an entrée. Salads and deserts are welcome.
        </Text>
      </Section>
    </Container>
  )
}

type EventProps = {
  event: BibleClassType
}
const BibleClassProgram = ({ event }: EventProps) => {
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

export default BibleClass
