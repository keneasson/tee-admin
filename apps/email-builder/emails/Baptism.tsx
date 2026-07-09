import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
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
import { EmailBrandLink } from '../components/EmailBrandLink'
import { AutoLinkText } from '../components/AutoLinkText'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'


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
    mapsUrl?: string
  }
  onlineMeeting?: {
    link: string
    platform?: string
  }
  hostingEcclesia?: string | { name: string }
  /** Optional event description — shown after Service Details if provided */
  description?: string
  /** The ecclesia sending this email — defaults to HOME_ECCLESIA. Multi-tenant: pass the sender's ecclesia. */
  senderEcclesia?: string
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
  aboutCandidate: `Sarah has been attending Toronto East for the past two years and has diligently studied the scriptures during this time. She comes from a background in health sciences and has found great meaning in the Bible's message of hope and redemption.

We rejoice with Sarah and pray that the Lord will guide and strengthen her as she begins her walk in the Truth.`,
  baptismDate: new Date('2024-12-29T11:00:00'),
  baptismTime: '11:00 AM (during Memorial Service)',
  location: {
    name: 'Toronto East Christadelphian Ecclesia',
    address: '975 Cosburn Avenue',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M4C 2W8',
  },
  hostingEcclesia: 'Toronto East Ecclesia',
  eventUrl: 'https://tee-admin.com/events/b-001',
}

const textColor = '#00102c'

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

const BaptismEmail: React.FC<BaptismEmailProps> = ({
  title = mockBaptismData.title,
  candidate = mockBaptismData.candidate,
  aboutCandidate = mockBaptismData.aboutCandidate,
  candidatePhoto,
  baptismDate = mockBaptismData.baptismDate,
  baptismTime = mockBaptismData.baptismTime,
  location = mockBaptismData.location,
  onlineMeeting,
  hostingEcclesia,
  description,
  senderEcclesia,
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

  // Determine if hosting ecclesia is the same as the sender (home) ecclesia
  // Multi-tenant ready: senderEcclesia prop overrides HOME_ECCLESIA default
  const homeEcclesiaName = senderEcclesia || HOME_ECCLESIA.canonicalName
  const isHomeEcclesia = !ecclesiaName || HOME_ECCLESIA.isHomeEcclesia(ecclesiaName) ||
    ecclesiaName.toLowerCase().trim() === homeEcclesiaName.toLowerCase().trim()

  // Check if location name already identifies the hosting ecclesia (avoid redundant "Hosted by:")
  const locationImpliesHost = location?.name
    ? location.name.toLowerCase().includes(ecclesiaName.toLowerCase()) ||
      ecclesiaName.toLowerCase().includes(location.name.replace(/\s*Hall\s*$/i, '').toLowerCase())
    : false

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Baptism of {candidateName} — Rejoice with the angels in heaven!</Preview>
      <Body style={main}>
        {/* Header — same light blue as Newsletter/Memorial */}
        <Section style={header}>
          <Text style={{ fontSize: '13px', margin: '0', color: textColor, paddingTop: '16px' }}>
            Toronto East Christadelphians
          </Text>
          <Heading style={{ color: textColor, margin: '8px 0', fontSize: '28px', fontWeight: '600' }}>
            {title || 'Baptism Announcement'}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '4px 0 12px', color: textColor }}>
            Rejoice with the angels in heaven!
          </Text>
          <EmailBrandLink />
        </Section>

        <Container style={container}>
          {/* Announcement Banner — "After a good confession of Faith" */}
          <Section style={{
            padding: '24px 20px',
            marginTop: '24px',
            borderRadius: '8px',
            textAlign: 'center',
            border: '2px solid #c5d9fd',
          }}>
            {/* If hosting ecclesia is NOT the home ecclesia, announce who is sharing the news */}
            {!isHomeEcclesia ? (
              <Text style={{
                ...defaultText,
                margin: '0 0 12px 0',
                fontSize: '18px',
                color: textColor,
              }}>
                The <strong>{ecclesiaName}</strong> is happy to announce that
              </Text>
            ) : null}
            <Text style={{
              ...defaultText,
              margin: '0',
              fontSize: '18px',
              color: textColor,
            }}>
              After a good confession of Faith,
            </Text>
            <Text style={{
              ...defaultText,
              margin: '8px 0',
              fontSize: '24px',
              fontWeight: 'bold',
              color: textColor,
            }}>
              {candidateName}
            </Text>
            <Text style={{
              ...defaultText,
              margin: '0',
              fontSize: '18px',
              color: textColor,
            }}>
              will be baptized into the saving name of our Lord Jesus Christ.
            </Text>
          </Section>

          {/* About the candidate — no heading, just the text */}
          {aboutCandidate ? (
            <Section style={{ marginTop: '24px' }}>
              {candidatePhoto?.url ? (
                <Img
                  src={candidatePhoto.url}
                  alt={`Photo of ${candidateName}`}
                  width={140}
                  height={175}
                  style={{
                    borderRadius: '8px',
                    objectFit: 'cover',
                    float: 'left',
                    marginRight: '20px',
                    marginBottom: '8px',
                  }}
                />
              ) : null}
              <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: textColor }}>
                <AutoLinkText text={aboutCandidate} />
              </Text>
            </Section>
          ) : null}

          {/* Service Details */}
          {(formattedDate || location) ? (
            <Section style={{ marginTop: '24px' }}>
              <Text style={{ fontSize: '18px', fontWeight: '600', color: textColor, marginBottom: '12px', marginTop: '0' }}>
                Service Details
              </Text>
              <Section style={{
                padding: '16px 0',
              }}>
                {formattedDate ? (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0', color: textColor }}>
                    <strong>{formattedDate}</strong>
                    {baptismTime ? <><br /><AutoLinkText text={baptismTime} /></> : null}
                  </Text>
                ) : null}
                {location ? (
                  <>
                    <Text style={{ fontSize: '16px', fontWeight: '600', color: textColor, margin: '0 0 4px 0' }}>
                      {location.name}
                    </Text>
                    {location.address ? (
                      <Text style={{ fontSize: '14px', color: textColor, margin: '0', lineHeight: '1.5' }}>
                        {location.address}
                        <br />
                        {[location.city, location.province, location.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    ) : null}
                    {location.mapsUrl ? (
                      <Text style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                        <Link href={location.mapsUrl} style={{ color: '#003da9', textDecoration: 'underline' }}>
                          Get Directions
                        </Link>
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {/* Online meeting / stream link */}
                {onlineMeeting?.link ? (
                  <Text style={{ ...defaultText, margin: '12px 0 0 0', fontSize: '14px', color: textColor }}>
                    Watch online:<br />
                    <Link href={onlineMeeting.link} style={link}>
                      {onlineMeeting.link}
                    </Link>
                  </Text>
                ) : null}
                {/* Only show "Hosted by" if the location name doesn't already imply the host */}
                {ecclesiaName && !locationImpliesHost ? (
                  <Text style={{ ...defaultText, margin: '12px 0 0 0', fontSize: '14px', color: textColor }}>
                    Hosted by: {ecclesiaName}
                  </Text>
                ) : null}
              </Section>
            </Section>
          ) : null}

          {/* Event description — if provided */}
          {description && description.trim() ? (
            <Section style={{ marginTop: '20px' }}>
              <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: textColor }}>
                <AutoLinkText text={description} />
              </Text>
            </Section>
          ) : null}

          {/* Optional Note */}
          {note && note.trim() ? (
            <Section style={{
              padding: '16px',
              marginTop: '20px',
              borderRadius: '4px',
              backgroundColor: '#f8fafc',
            }}>
              <Text style={{ ...defaultText, margin: '0 0 8px 0', fontWeight: 'bold', color: textColor }}>
                Note:
              </Text>
              <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', color: textColor }}>
                <AutoLinkText text={note} />
              </Text>
            </Section>
          ) : null}

          {/* View on Website */}
          {eventUrl ? (
            <Section style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link href={eventUrl} style={link}>
                View on our Website
              </Link>
            </Section>
          ) : null}

          {/* Scripture */}
          <Section style={{
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            marginTop: '24px',
          }}>
            <Text style={{ ...defaultText, margin: '0', fontStyle: 'italic', color: textColor }}>
              "I say unto you, that likewise joy shall be in heaven over one sinner that repenteth,
              <br />
              more than over ninety and nine just persons, which need no repentance."
              <br />
              <span style={{ fontSize: '14px' }}>— Luke 15:7</span>
            </Text>
          </Section>

          {/* All Welcome */}
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ ...defaultText, fontSize: '16px', color: textColor, fontWeight: '600' }}>
              All welcome.
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
