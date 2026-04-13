import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
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
} from '../styles'
import React from 'react'
import { Footer } from '../components/Footer'
import { AutoLinkText } from '../components/AutoLinkText'

export type MeetingEmailProps = {
  // Header
  ownerName?: string
  title?: string

  // Schedule
  date?: string
  time?: string

  // Online meeting (conditional — hide entire section if not provided)
  zoomLink?: string
  meetingId?: string
  passcode?: string
  dialIn?: string

  // In-person location (conditional — hide if not provided)
  locationName?: string
  locationAddress?: string

  // Documents (conditional — hide section if empty/undefined)
  documents?: Array<{ title: string; url: string }>

  // Note (conditional — yellow banner)
  note?: string
}

const defaultProps: MeetingEmailProps = {
  ownerName: 'Toronto East Christadelphians',
  title: 'Business Meeting',
  date: 'April 15, 2026',
  time: '7:30 PM',
  zoomLink: 'https://us02web.zoom.us/j/example',
  meetingId: '000 0000 0000',
  passcode: '000000',
  documents: [
    { title: 'Meeting Agenda', url: 'https://example.com/agenda' },
    { title: 'Previous Minutes', url: 'https://example.com/minutes' },
  ],
}

const MeetingEmail: React.FC<MeetingEmailProps> = (props) => {
  const ownerName = props.ownerName || defaultProps.ownerName!
  const title = props.title || defaultProps.title!
  const date = props.date || defaultProps.date
  const time = props.time || defaultProps.time
  const zoomLink = props.zoomLink || defaultProps.zoomLink
  const meetingId = props.meetingId || defaultProps.meetingId
  const passcode = props.passcode || defaultProps.passcode
  const dialIn = props.dialIn || (zoomLink ? '1 647 374 4685' : undefined)
  const locationName = props.locationName
  const locationAddress = props.locationAddress
  const documents = props.documents || defaultProps.documents
  const note = props.note

  const hasZoomSection = !!(zoomLink || meetingId)
  const hasLocationSection = !!(locationName || locationAddress)
  const hasDocuments = !!(documents && documents.length > 0)
  const hasScheduleInfo = !!(date || time)

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{title} Details</Preview>
      <Body style={main}>
        {/* Header */}
        <Section style={header}>
          <Heading>{ownerName}</Heading>
          <Text style={defaultText}>{title}</Text>
          <Text style={defaultText}>All arrangements are subject to God&apos;s will.</Text>
        </Section>

        {/* Optional Note Section */}
        {note && note.trim() ? (
          <Section style={{
            backgroundColor: '#fff3cd',
            padding: '16px',
            marginTop: '20px',
            marginBottom: '20px',
            borderRadius: '4px',
          }}>
            <Text style={{
              ...defaultText,
              margin: '0 0 8px 0',
              fontWeight: 'bold',
            }}>
              Note:
            </Text>
            <Text style={{
              ...defaultText,
              margin: '0',
              whiteSpace: 'pre-wrap',
            }}>
              <AutoLinkText text={note} />
            </Text>
          </Section>
        ) : null}

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {/* Meeting details intro */}
          {hasScheduleInfo ? (
            <Section>
              <Text style={defaultText}>
                Here are the details for tonight&apos;s {title}
                {time ? ` at ${time}` : ''}
                {date ? ` on ${date}` : ''}
              </Text>
            </Section>
          ) : null}

          {/* Zoom Section */}
          {hasZoomSection ? (
            <Section>
              <Heading style={{ ...defaultText, fontSize: '18px', marginTop: '20px' }}>
                Join the Meeting
              </Heading>
              {zoomLink ? (
                <Text style={defaultText}>
                  <strong>Zoom Link:</strong>
                  <br />
                  <Link href={zoomLink} style={link}>
                    Click to join Zoom
                  </Link>
                </Text>
              ) : null}
              <Text style={defaultText}>
                {meetingId ? (
                  <>
                    <strong>Meeting ID:</strong> {meetingId}
                    <br />
                  </>
                ) : null}
                {passcode ? (
                  <>
                    <strong>Passcode:</strong> {passcode}
                    <br />
                  </>
                ) : null}
                {dialIn ? (
                  <>
                    <strong>Dial-in:</strong> {dialIn}
                  </>
                ) : null}
              </Text>
            </Section>
          ) : null}

          {/* In-person Location Section */}
          {hasLocationSection ? (
            <>
              {hasZoomSection ? <hr /> : null}
              <Section>
                <Heading style={{ ...defaultText, fontSize: '18px', marginTop: '20px' }}>
                  Meeting Location
                </Heading>
                <Text style={defaultText}>
                  {locationName ? (
                    <>
                      <strong>{locationName}</strong>
                      <br />
                    </>
                  ) : null}
                  {locationAddress ? locationAddress : null}
                </Text>
              </Section>
            </>
          ) : null}

          {/* Documents Section */}
          {hasDocuments ? (
            <>
              <hr />
              <Section>
                <Heading style={{ ...defaultText, fontSize: '18px', marginTop: '20px' }}>
                  Meeting Documents
                </Heading>
                <Text style={defaultText}>
                  {documents!.map((doc, index) => (
                    <React.Fragment key={index}>
                      {index > 0 ? (
                        <>
                          <br />
                          <br />
                        </>
                      ) : null}
                      <Link href={doc.url} style={link}>
                        {doc.title}
                      </Link>
                    </React.Fragment>
                  ))}
                </Text>
              </Section>
            </>
          ) : null}
        </Container>

        <Container>
          <Text>&nbsp;</Text>
        </Container>
        <Footer />
      </Body>
    </Html>
  )
}

export default MeetingEmail
