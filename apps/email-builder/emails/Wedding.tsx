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
import { FooterContent } from '../components/FooterContent'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import { AutoLinkText } from '../components/AutoLinkText'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import type { EmailIdentity } from '@my/app/types/brand-profile'


export interface WeddingEmailProps {
  title?: string
  couple?: {
    bride: {
      firstName: string
      lastName: string
    }
    groom: {
      firstName: string
      lastName: string
    }
  }
  ceremonyDate?: string | Date
  /** Rarely set — the editor has no explicit time field. Derived from ceremonyDate when absent. */
  ceremonyTime?: string
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
  /** Optional event description — shown after Ceremony Details if provided */
  description?: string
  /** The ecclesia sending this email — defaults to HOME_ECCLESIA. Multi-tenant: pass the sender's ecclesia. */
  senderEcclesia?: string
  note?: string
  eventUrl?: string
  /** Brand identity for footer/header — passed as a prop (not the client EmailIdentityProvider) so this renders from an App Router server route. */
  identity?: EmailIdentity
}

// Mock data for preview. NOTE: the ceremony time is DERIVED from ceremonyDate
// (see formatTime), never hardcoded — so no mock string can leak into a real send.
const mockWeddingData: WeddingEmailProps = {
  title: 'Wedding Announcement',
  couple: {
    bride: {
      firstName: 'Rebecca',
      lastName: 'Turner',
    },
    groom: {
      firstName: 'Daniel',
      lastName: 'Harper',
    },
  },
  ceremonyDate: new Date('2024-09-14T14:00:00'),
  location: {
    name: 'Toronto East Christadelphian Ecclesia',
    address: '975 Cosburn Avenue',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M4C 2W8',
  },
  hostingEcclesia: 'Toronto East Ecclesia',
  eventUrl: 'https://tee-admin.com/events/w-001',
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

// Time is derived from the SAME ceremonyDate as formatDate (Toronto time), so the
// email matches the newsletter/details. It must never fall back to a mock string.
function formatTime(date: string | Date | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Toronto',
  })
}

function fullName(person?: { firstName?: string; lastName?: string }): string {
  if (!person) return ''
  return `${person.firstName || ''} ${person.lastName || ''}`.trim()
}

const WeddingEmail: React.FC<WeddingEmailProps> = ({
  title = mockWeddingData.title,
  couple = mockWeddingData.couple,
  ceremonyDate = mockWeddingData.ceremonyDate,
  // No mock default — an unset ceremonyTime must derive from ceremonyDate below,
  // never leak a placeholder string.
  ceremonyTime,
  location = mockWeddingData.location,
  onlineMeeting,
  hostingEcclesia,
  description,
  senderEcclesia,
  note,
  eventUrl = mockWeddingData.eventUrl,
  identity,
}) => {
  const brideName = fullName(couple?.bride)
  const groomName = fullName(couple?.groom)
  const coupleName = brideName && groomName
    ? `${brideName} & ${groomName}`
    : brideName || groomName || 'The Happy Couple'

  const formattedDate = formatDate(ceremonyDate)
  // Prefer an explicit ceremonyTime (rare — the editor has no such field today);
  // otherwise derive it from ceremonyDate so it always matches the actual time.
  const formattedTime = ceremonyTime || formatTime(ceremonyDate)
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
      <Preview>Wedding of {coupleName} — Rejoice with us on this happy occasion!</Preview>
      <Body style={main}>
        {/* Header — same light blue as Newsletter/Memorial */}
        <Section style={header}>
          <Text style={{ fontSize: '13px', margin: '0', color: textColor, paddingTop: '16px' }}>
            Toronto East Christadelphians
          </Text>
          <Heading style={{ color: textColor, margin: '8px 0', fontSize: '28px', fontWeight: '600' }}>
            {title || 'Wedding Announcement'}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '4px 0 12px', color: textColor }}>
            Rejoice with us on this happy occasion!
          </Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={container}>
          {/* Announcement Banner */}
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
              With thankfulness to God,
            </Text>
            <Text style={{
              ...defaultText,
              margin: '8px 0',
              fontSize: '24px',
              fontWeight: 'bold',
              color: textColor,
            }}>
              {coupleName}
            </Text>
            <Text style={{
              ...defaultText,
              margin: '0',
              fontSize: '18px',
              color: textColor,
            }}>
              will be joined together in marriage.
            </Text>
          </Section>

          {/* Ceremony Details */}
          {(formattedDate || location) ? (
            <Section style={{ marginTop: '24px' }}>
              <Text style={{ fontSize: '18px', fontWeight: '600', color: textColor, marginBottom: '12px', marginTop: '0' }}>
                Ceremony Details
              </Text>
              <Section style={{
                padding: '16px 0',
              }}>
                {formattedDate ? (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0', color: textColor }}>
                    <strong>{formattedDate}</strong>
                    {formattedTime ? <><br />{formattedTime}</> : null}
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
              "What therefore God hath joined together,
              <br />
              let not man put asunder."
              <br />
              <span style={{ fontSize: '14px' }}>— Mark 10:9</span>
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
        <FooterContent identity={identity} />
      </Body>
    </Html>
  )
}

export default WeddingEmail
