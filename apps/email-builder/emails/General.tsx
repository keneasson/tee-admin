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
import { FooterContent } from '../components/FooterContent'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import { AutoLinkText } from '../components/AutoLinkText'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import type { EmailIdentity } from '@my/app/types/brand-profile'


// A flyer/attachment as passed from the event editor. Kept loose (all optional)
// so a general event with no documents — or an unexpected shape — renders safely.
export interface GeneralEmailDocument {
  documentType?: string
  originalName?: string
  fileUrl?: string
  thumbnailUrl?: string
  mimeType?: string
}

export interface GeneralEmailProps {
  title?: string
  /** Free-form, multi-line event description — auto-linked. */
  description?: string
  /** Event start (ISO string or Date). Date + time range are derived from this. */
  startDate?: string | Date
  /** Event end (ISO string or Date) — used for the closing time of the range. */
  endDate?: string | Date
  location?: {
    name?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    mapsUrl?: string
  }
  /** Attached documents (e.g. a flyer PDF). First usable upload is linked. */
  documents?: GeneralEmailDocument[]
  hostingEcclesia?: string | { name: string }
  /** The ecclesia sending this email — defaults to HOME_ECCLESIA. Multi-tenant: pass the sender's ecclesia. */
  senderEcclesia?: string
  note?: string
  eventUrl?: string
  /** Brand identity for footer/header — passed as a prop (not the client EmailIdentityProvider) so this renders from an App Router server route. */
  identity?: EmailIdentity
}

// Mock data for preview. NOTE: the date + time range are DERIVED from the mock
// startDate/endDate (see formatDate/formatTime), never hardcoded — so no mock
// string can leak into a real send.
const mockGeneralData: GeneralEmailProps = {
  title: 'Praise Fest',
  description: `Bring a lawn chair and enjoy a FREE fun family Sunday in the park with live Christian Music.

Everyone is welcome — invite your friends and family! More details at https://tee-admin.com/events`,
  startDate: new Date('2026-08-29T16:00:00.000Z'),
  endDate: new Date('2026-08-29T20:00:00.000Z'),
  location: {
    name: 'The Station, Collingwood Museum',
    address: '45 St. Paul St.',
    city: 'Collingwood',
    province: 'ON',
    postalCode: 'L9Y 3P1',
  },
  documents: [
    {
      documentType: 'upload',
      originalName: 'collingwood_praisfest_2026_pr.pdf',
      fileUrl: 'https://tee-admin.com/example-flyer.pdf',
      mimeType: 'application/pdf',
    },
  ],
  hostingEcclesia: 'Toronto East Ecclesia',
  eventUrl: 'https://tee-admin.com/events/g-001',
}

const textColor = '#00102c'

function formatDate(date: string | Date | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })
}

// Time is derived from the SAME start/end dates (Toronto time), so the email
// matches the newsletter/details. It must never fall back to a mock string.
function formatTime(date: string | Date | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Toronto',
  })
}

// Build "Saturday, August 29, 2026 · 12:00 PM – 4:00 PM" from the actual dates.
// Falls back gracefully when the end date (or its time) is missing.
function formatDateTimeRange(
  start: string | Date | undefined,
  end: string | Date | undefined
): string {
  const dateStr = formatDate(start)
  const startTime = formatTime(start)
  const endTime = formatTime(end)
  if (!dateStr) return ''
  const timeRange = startTime && endTime
    ? `${startTime} – ${endTime}`
    : startTime || endTime || ''
  return timeRange ? `${dateStr} · ${timeRange}` : dateStr
}

// Choose the first attachment we can present as a "flyer" link.
function pickFlyer(documents: GeneralEmailProps['documents']): GeneralEmailDocument | undefined {
  if (!documents?.length) return undefined
  return documents.find((doc) => doc?.fileUrl)
}

const GeneralEmail: React.FC<GeneralEmailProps> = ({
  title = mockGeneralData.title,
  description = mockGeneralData.description,
  startDate = mockGeneralData.startDate,
  endDate = mockGeneralData.endDate,
  location = mockGeneralData.location,
  documents = mockGeneralData.documents,
  hostingEcclesia,
  senderEcclesia,
  note,
  eventUrl = mockGeneralData.eventUrl,
  identity,
}) => {
  const eventTitle = title || 'Event Announcement'
  const dateTimeRange = formatDateTimeRange(startDate, endDate)
  const flyer = pickFlyer(documents)

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
  const hasLocation = !!(location && location.name)

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{eventTitle}</Preview>
      <Body style={main}>
        {/* Header — same light blue as Newsletter/Memorial */}
        <Section style={header}>
          <Text style={{ fontSize: '13px', margin: '0', color: textColor, paddingTop: '16px' }}>
            Toronto East Christadelphians
          </Text>
          <Heading style={{ color: textColor, margin: '8px 0', fontSize: '28px', fontWeight: '600' }}>
            {eventTitle}
          </Heading>
          <Text style={{ fontSize: '16px', margin: '4px 0 12px', color: textColor }}>
            You're invited!
          </Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={container}>
          {/* If hosting ecclesia is NOT the home ecclesia, announce who is sharing the news */}
          {!isHomeEcclesia && ecclesiaName ? (
            <Section style={{ marginTop: '24px', textAlign: 'center' }}>
              <Text style={{ ...defaultText, margin: '0', fontSize: '16px', color: textColor }}>
                Shared by the <strong>{ecclesiaName}</strong>
              </Text>
            </Section>
          ) : null}

          {/* Event Details — date/time + location */}
          {(dateTimeRange || hasLocation) ? (
            <Section style={{ marginTop: '24px' }}>
              <Text style={{ fontSize: '18px', fontWeight: '600', color: textColor, marginBottom: '12px', marginTop: '0' }}>
                Event Details
              </Text>
              <Section style={{ padding: '16px 0' }}>
                {dateTimeRange ? (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0', color: textColor }}>
                    <strong>{dateTimeRange}</strong>
                  </Text>
                ) : null}
                {hasLocation ? (
                  <>
                    <Text style={{ fontSize: '16px', fontWeight: '600', color: textColor, margin: '0 0 4px 0' }}>
                      {location?.name}
                    </Text>
                    {location?.address ? (
                      <Text style={{ fontSize: '14px', color: textColor, margin: '0', lineHeight: '1.5' }}>
                        {location.address}
                        <br />
                        {[location.city, location.province, location.postalCode]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    ) : null}
                    {location?.mapsUrl ? (
                      <Text style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
                        <Link href={location.mapsUrl} style={{ color: '#003da9', textDecoration: 'underline' }}>
                          Get Directions
                        </Link>
                      </Text>
                    ) : null}
                  </>
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

          {/* Event description */}
          {description && description.trim() ? (
            <Section style={{ marginTop: '20px' }}>
              <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6', color: textColor }}>
                <AutoLinkText text={description} />
              </Text>
            </Section>
          ) : null}

          {/* Flyer — link (and thumbnail if available) to an attached document */}
          {flyer?.fileUrl ? (
            <Section style={{ marginTop: '20px', textAlign: 'center' }}>
              {flyer.thumbnailUrl ? (
                <Link href={flyer.fileUrl}>
                  <Img
                    src={flyer.thumbnailUrl}
                    alt={flyer.originalName || 'Event flyer'}
                    width={220}
                    style={{
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      margin: '0 auto 12px',
                      maxWidth: '100%',
                    }}
                  />
                </Link>
              ) : null}
              <Text style={{ margin: '0', fontSize: '15px' }}>
                <Link href={flyer.fileUrl} style={link}>
                  View the flyer (PDF)
                </Link>
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
                View event details
              </Link>
            </Section>
          ) : null}

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

export default GeneralEmail
