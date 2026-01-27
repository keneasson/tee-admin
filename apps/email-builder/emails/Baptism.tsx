import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
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
  link,
  main,
} from '../styles'
import React from 'react'
import { Footer } from '../components/Footer'
import { AutoLinkText } from '../components/AutoLinkText'

export interface BaptismEmailProps {
  title?: string
  candidate?: {
    firstName: string
    lastName: string
  }
  aboutCandidate?: string
  candidatePhoto?: {
    url: string
  }
  baptismDate?: string | Date
  baptismTime?: string
  location?: {
    name: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
  }
  hostingEcclesia?: string | { name: string }
  note?: string
  eventUrl?: string
}

// Mock data for preview
const mockBaptismData: BaptismEmailProps = {
  title: 'Baptism Announcement',
  candidate: {
    firstName: 'Sarah',
    lastName: 'Mitchell',
  },
  aboutCandidate: `Sister Sarah Mitchell made a good confession of faith and has requested baptism into the saving name of our Lord Jesus Christ.

Sarah has been attending Toronto East for the past two years and has diligently studied the scriptures during this time. She comes from a background in health sciences and has found great meaning in the Bible's message of hope and redemption.

We rejoice with Sarah and pray that the Lord will guide and strengthen her as she begins her walk in the Truth.`,
  candidatePhoto: {
    url: 'https://placehold.co/200x250/e8f5e9/2e7d32?text=Photo',
  },
  baptismDate: new Date('2024-12-29T11:00:00'),
  baptismTime: '11:00 AM (during Memorial Service)',
  location: {
    name: 'Toronto East Christadelphian Ecclesia',
    address: '975 Cosburn Avenue',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M4C 2W8',
  },
  hostingEcclesia: 'Toronto East Christadelphian Ecclesia',
  eventUrl: 'https://tee-admin.com/events/b-001',
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })
}

const sectionHeader = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#1a472a',
  marginBottom: '12px',
  marginTop: '24px',
}

const locationBox = {
  backgroundColor: '#f0fff4',
  padding: '16px',
  borderRadius: '8px',
  borderLeft: '4px solid #38a169',
  marginBottom: '16px',
}

const locationName = {
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#276749',
  margin: '0 0 8px 0',
}

const locationAddress = {
  fontSize: '14px',
  color: '#2f855a',
  margin: '0',
  lineHeight: '1.5',
}

const baptismHeader = {
  backgroundColor: '#276749',
  textAlign: 'center' as const,
  padding: '24px',
  color: 'white',
}

const BaptismEmail: React.FC<BaptismEmailProps> = ({
  title = mockBaptismData.title,
  candidate = mockBaptismData.candidate,
  aboutCandidate = mockBaptismData.aboutCandidate,
  candidatePhoto = mockBaptismData.candidatePhoto,
  baptismDate = mockBaptismData.baptismDate,
  baptismTime = mockBaptismData.baptismTime,
  location = mockBaptismData.location,
  hostingEcclesia = mockBaptismData.hostingEcclesia,
  note,
  eventUrl = mockBaptismData.eventUrl,
}) => {
  const candidateName = candidate
    ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
    : 'Our New Brother/Sister'

  const formattedDate = formatDate(baptismDate)
  const ecclesiaName = typeof hostingEcclesia === 'string'
    ? hostingEcclesia
    : hostingEcclesia?.name || ''

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Baptism of {candidateName} - Rejoice with us!</Preview>
      <Body style={main}>
        {/* Header */}
        <Section style={baptismHeader}>
          <Text style={{ fontSize: '14px', margin: '0 0 8px 0', color: '#c6f6d5' }}>
            Toronto East Christadelphians
          </Text>
          <Heading style={{ color: 'white', margin: '0 0 8px 0', fontSize: '28px' }}>
            {title || 'Baptism Announcement'}
          </Heading>
          <Text style={{ fontSize: '20px', margin: '0', color: '#c6f6d5' }}>
            Rejoice With Us!
          </Text>
        </Section>

        {/* Announcement Banner */}
        <Container style={container}>
          <Section style={{
            backgroundColor: '#f0fff4',
            padding: '20px',
            marginTop: '24px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '2px solid #68d391',
          }}>
            <Text style={{
              ...defaultText,
              margin: '0',
              fontSize: '18px',
              color: '#276749',
            }}>
              After a good confession of Faith,
            </Text>
            <Text style={{
              ...defaultText,
              margin: '8px 0',
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#1a472a',
            }}>
              {candidateName}
            </Text>
            <Text style={{
              ...defaultText,
              margin: '0',
              fontSize: '18px',
              color: '#276749',
            }}>
              will be baptized into the saving name of our Lord Jesus Christ.
            </Text>
          </Section>
        </Container>

        {/* Optional Note */}
        {note && note.trim() && (
          <Container style={container}>
            <Section style={{
              backgroundColor: '#fff3cd',
              padding: '16px',
              marginTop: '20px',
              borderRadius: '4px',
            }}>
              <Text style={{ ...defaultText, margin: '0 0 8px 0', fontWeight: 'bold' }}>
                Note:
              </Text>
              <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap' }}>
                <AutoLinkText text={note} />
              </Text>
            </Section>
          </Container>
        )}

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {/* About the Candidate Section */}
          {(aboutCandidate || candidatePhoto) && (
            <Section>
              <Text style={sectionHeader}>About {candidate?.firstName || 'the Candidate'}</Text>

              {candidatePhoto?.url ? (
                <Row>
                  <Column style={{ width: '160px', verticalAlign: 'top', paddingRight: '20px' }}>
                    <Img
                      src={candidatePhoto.url}
                      alt={`Photo of ${candidateName}`}
                      width={140}
                      height={175}
                      style={{
                        borderRadius: '8px',
                        objectFit: 'cover',
                      }}
                    />
                  </Column>
                  {aboutCandidate && (
                    <Column style={{ verticalAlign: 'top' }}>
                      <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        <AutoLinkText text={aboutCandidate} />
                      </Text>
                    </Column>
                  )}
                </Row>
              ) : aboutCandidate ? (
                <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  <AutoLinkText text={aboutCandidate} />
                </Text>
              ) : null}
            </Section>
          )}

          {/* Service Details */}
          {(formattedDate || location) && (
            <Section>
              <Text style={sectionHeader}>Service Details</Text>
              <Section style={locationBox}>
                {formattedDate && (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
                    <strong>{formattedDate}</strong>
                    {baptismTime && <><br />{baptismTime}</>}
                  </Text>
                )}
                {location && (
                  <>
                    <Text style={locationName}>{location.name}</Text>
                    {location.address && (
                      <Text style={locationAddress}>
                        {location.address}
                        <br />
                        {[location.city, location.province, location.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    )}
                  </>
                )}
                {ecclesiaName && ecclesiaName !== location?.name && (
                  <Text style={{ ...defaultText, margin: '12px 0 0 0', fontSize: '14px', color: '#4a5568' }}>
                    Hosted by: {ecclesiaName}
                  </Text>
                )}
              </Section>
            </Section>
          )}

          {/* View Full Details Link */}
          {eventUrl && (
            <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '24px' }}>
              <Link href={eventUrl} style={{
                ...link,
                backgroundColor: '#276749',
                borderColor: '#276749',
                color: 'white',
              }}>
                View Full Details
              </Link>
            </Section>
          )}

          {/* Scripture */}
          <Section style={{
            backgroundColor: '#f0fff4',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            marginTop: '24px',
          }}>
            <Text style={{ ...defaultText, margin: '0', fontStyle: 'italic', color: '#2f855a' }}>
              "I say unto you, that likewise joy shall be in heaven over one sinner that repenteth,
              <br />
              more than over ninety and nine just persons, which need no repentance."
              <br />
              <span style={{ fontSize: '14px' }}>— Luke 15:7</span>
            </Text>
          </Section>

          {/* All Welcome */}
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ ...defaultText, fontSize: '16px', color: '#276749', fontWeight: '600' }}>
              All are welcome to join us in celebrating this joyous occasion!
            </Text>
          </Section>
        </Container>

        <Container style={{ marginTop: '24px' }}>
          <Text>&nbsp;</Text>
        </Container>
        <Footer />
      </Body>
    </Html>
  )
}

export default BaptismEmail
