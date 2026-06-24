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
import { AutoLinkText } from '../components/AutoLinkText'
import { AttendOptions } from '../components/AttendOptions'

const mockEvents: BibleClassType[] = [
  {
    Key: ProgramsTypes.bibleClass,
    Presider: 'Presiding Brother',
    Speaker: 'Speaking Brother',
    Topic: 'Topic',
    Date: 'Feb 25, 2024',
  },
]

// Helper to check if a Bible class event is "no class"
const isNoClass = (event: BibleClassType): boolean => {
  // No class if Speaker is empty OR Topic contains "no class" (case insensitive)
  return !event.Speaker || event.Topic.toLowerCase().includes('no class')
}

const BibleClass: React.FC<NextBibleClassProps> = ({ events, note }) => {
  const bibleClassEvents = events || mockEvents
  const currentEvent = bibleClassEvents[0]
  const nextEvent = bibleClassEvents[1]
  // Override precedence: 'cancelled' forces no-class; 'active' forces the class to
  // show; otherwise fall back to the Speaker/Topic heuristic.
  const isCancelled = currentEvent?.overrideStatus === 'cancelled'
  const isForcedActive = currentEvent?.overrideStatus === 'active'
  const hasNoClass = isCancelled || (!isForcedActive && !!currentEvent && isNoClass(currentEvent))
  // Find the next actual class (skipping any "no class" entries)
  const nextActualClass = hasNoClass && nextEvent && !isNoClass(nextEvent) ? nextEvent : undefined

  // Joint Bible Class logic
  const isJoint = !!currentEvent?.Host
  const hasInPerson = !!currentEvent?.InPerson
  const hasCustomZoom = !!(currentEvent?.ZoomURL || currentEvent?.MeetingID)
  // Show default Toronto East Zoom when: not joint, OR joint without InPerson and without custom Zoom
  const showDefaultZoom = !isJoint || (!hasInPerson && !hasCustomZoom)
  // Show custom (host) Zoom when host provides Zoom details
  const showHostZoom = hasCustomZoom
  // Hide all Zoom only when InPerson is set but no custom Zoom
  const hideZoom = hasInPerson && !hasCustomZoom
  // Per-occurrence attend-options supersede the hardcoded in-person + Zoom blocks
  const hasAttendOptions = !!currentEvent?.attendOptions && currentEvent.attendOptions.length > 0

  const headingText = isJoint
    ? (currentEvent.MetaData || `Special Joint Bible Class with ${currentEvent.Host}`)
    : 'Toronto East Bible Class'

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{hasNoClass ? 'No Bible Class Tonight' : (isJoint ? headingText : 'Bible Class Tonight')}</Preview>
      <Body style={main}>
        {/* Joint Bible Class — prominent banner header */}
        {isJoint ? (
          <Section style={{
            backgroundColor: '#1565C0',
            padding: '24px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              color: '#ffffff',
              fontSize: '11px',
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
              fontWeight: 'bold',
              margin: '0 0 8px 0',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              Special Notice
            </Text>
            <Heading style={{
              color: '#ffffff',
              fontSize: '22px',
              fontWeight: 'bold',
              margin: '0 0 8px 0',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              {headingText}
            </Heading>
            <Text style={{
              color: '#ffffffCC',
              fontSize: '14px',
              margin: '0',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}>
              {currentEvent.Date?.toString()} at 7:30pm{hasInPerson ? ' — In Person & Zoom' : ' — on Zoom'}
            </Text>
          </Section>
        ) : (
          <Section style={header}>
            <Heading>{headingText}</Heading>
          </Section>
        )}

        {/* Optional Note Section */}
        {note && note.trim() ? (
          <Section style={{
            backgroundColor: '#fff3cd',
            padding: '16px',
            marginTop: '20px',
            marginBottom: '20px',
            borderRadius: '4px'
          }}>
            <Text style={{
              ...defaultText,
              margin: '0 0 8px 0',
              fontWeight: 'bold'
            }}>
              Note:
            </Text>
            <Text style={{
              ...defaultText,
              margin: '0',
              whiteSpace: 'pre-wrap'
            }}>
              <AutoLinkText text={note} />
            </Text>
          </Section>
        ) : null}

        <Container style={container} className="container">
          {hasNoClass ? (
            <>
              <Section style={program}>
                <Text style={{ ...defaultText, fontWeight: 'bold', fontSize: '18px' }}>
                  {currentEvent?.overrideMessage || 'There is no scheduled Bible class tonight.'}
                </Text>
                {currentEvent?.overrideNote ? (
                  <Text style={defaultText}>{currentEvent.overrideNote}</Text>
                ) : null}
              </Section>
              {nextActualClass ? (
                <Section style={{ marginTop: '24px' }}>
                  <Text style={defaultText}>
                    <strong>The next scheduled Bible Class will be:</strong>
                    <br />
                    {nextActualClass.Date.toString()} at 7:30pm
                    <br />
                    Led by Brother {nextActualClass.Speaker}
                    {nextActualClass.Topic ? (
                      <>
                        <br />
                        <em>{nextActualClass.Topic}</em>
                      </>
                    ) : null}
                  </Text>
                </Section>
              ) : null}
            </>
          ) : (
            <>
              <Section style={program}>
                <Heading style={defaultText}>
                  {isJoint
                    ? `Please join us for a Special Joint Bible Class with ${currentEvent.Host}`
                    : 'Please join us on Zoom for our Weekly Bible Class'}
                  <br />
                  7:30pm EST.
                </Heading>
              </Section>
              <Row>
                <Column>
                  {currentEvent ? <BibleClassProgram event={currentEvent} /> : null}
                </Column>
              </Row>
            </>
          )}
        </Container>

        {/* Per-occurrence "ways to attend" supersede the hardcoded blocks below */}
        {!hasNoClass && hasAttendOptions ? (
          <Container style={container} className="container">
            <AttendOptions options={currentEvent?.attendOptions} />
          </Container>
        ) : null}

        {/* In-Person Location Section */}
        {!hasNoClass && !hasAttendOptions && hasInPerson ? (
          <Container style={container} className="container">
            <Section style={{
              backgroundColor: '#e8f5e9',
              padding: '16px',
              borderRadius: '6px',
              marginBottom: '8px',
              borderLeft: '4px solid #2e7d32',
            }}>
              <Text style={{ ...defaultText, fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0' }}>
                📍 In Person{currentEvent.Host ? ` at ${currentEvent.Host}` : ''}
                {currentEvent.resolvedVenue ? ` — ${currentEvent.resolvedVenue}` : ''}
              </Text>
              <Text style={{ ...defaultText, margin: '0' }}>
                {currentEvent.resolvedAddress || currentEvent.InPerson}
              </Text>
              {currentEvent.resolvedMapUrl ? (
                <Text style={{ ...defaultText, margin: '8px 0 0 0' }}>
                  <Link href={currentEvent.resolvedMapUrl} style={{ ...link, fontWeight: '600' }}>
                    View on Google Maps →
                  </Link>
                </Text>
              ) : null}
            </Section>
          </Container>
        ) : null}

        {/* Host Zoom Section (custom Zoom from host ecclesia) */}
        {!hasNoClass && !hasAttendOptions && showHostZoom ? (
          <Container style={container} className="container zoom-info">
            <Section style={{
              backgroundColor: '#e3f2fd',
              padding: '12px 16px',
              borderRadius: '6px',
              marginBottom: '12px',
              borderLeft: '4px solid #1565C0',
            }}>
              <Text style={{ ...defaultText, margin: '0', fontWeight: 'bold' }}>
                {hasInPerson ? 'Also available on' : 'Using'} {currentEvent.Host}&apos;s Zoom
              </Text>
            </Section>
            <Text style={defaultText}>
              {currentEvent.ZoomURL ? (
                <>
                  <Link href={currentEvent.ZoomURL} style={{ ...link, fontWeight: '600' }}>
                    Click to join Zoom
                  </Link>
                  <br />
                </>
              ) : null}
              {currentEvent.MeetingID ? (
                <>
                  Meeting ID: {currentEvent.MeetingID}
                  <br />
                </>
              ) : null}
              {currentEvent.MeetingPwd ? (
                <>
                  Password: {currentEvent.MeetingPwd}
                </>
              ) : null}
            </Text>
          </Container>
        ) : null}

        {/* Default Toronto East Zoom Section */}
        {!hasNoClass && !hasAttendOptions && !hideZoom && showDefaultZoom && !showHostZoom ? (
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
        ) : null}
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
  // This component is only rendered when there IS a class (no-class is handled at parent level)
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
