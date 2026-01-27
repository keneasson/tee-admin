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
  header,
  link,
  main,
} from '../styles'
import React from 'react'
import { Footer } from '../components/Footer'
import { AutoLinkText } from '../components/AutoLinkText'

interface LocationInfo {
  name: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  onlineMeeting?: {
    platform?: string
    link?: string
    meetingId?: string
    password?: string
  }
}

export interface FuneralEmailProps {
  title?: string
  deceased?: {
    title?: 'Brother' | 'Sister' | 'Mr.' | 'Mrs.' | 'Ms.' | ''
    firstName: string
    lastName: string
  }
  ecclesia?: string // The ecclesia the deceased belonged to
  aboutDeceased?: string
  deceasedPhoto?: {
    url: string
  }
  serviceDate?: string | Date
  serviceTime?: string
  location?: LocationInfo
  // Visitation (formerly viewing)
  visitationDate?: string | Date
  visitationEndDate?: string | Date
  visitationTime?: string // Legacy: single time string
  visitationSameLocation?: boolean // Default true - visitation at same location as service
  visitationLocation?: LocationInfo
  // Legacy field names (backward compatibility)
  viewingDate?: string | Date
  viewingTime?: string
  viewingLocation?: LocationInfo
  // Graveside service
  hasGravesideService?: boolean
  gravesideDate?: string | Date
  gravesideTime?: string
  gravesideLocation?: LocationInfo
  // Timezone
  eventTimezone?: string // IANA timezone (e.g., 'America/Toronto')
  note?: string
  eventUrl?: string
  obituaryUrl?: string // URL to external obituary (e.g., funeral home website)
}

// Mock data for preview
const mockFuneralData: FuneralEmailProps = {
  title: 'In Loving Memory of Brother Robert Anderson',
  deceased: {
    title: 'Brother',
    firstName: 'Robert',
    lastName: 'Anderson',
  },
  ecclesia: 'Brampton Christadelphian Ecclesia',
  aboutDeceased: `Brother Robert Anderson fell asleep in the Lord on December 18, 2024, at the age of 82. He was baptized in 1965 and served faithfully as a brother at Toronto East for nearly 60 years.

Robert was known for his deep love of scripture, his gentle spirit, and his unwavering commitment to the Truth. He served in many capacities over the years, including as a Sunday School teacher, recording brother, and always as a willing helper wherever needed.

He is survived by his wife of 55 years, Sister Mary Anderson, their children David (Sarah), Elizabeth (John), and Michael (Rebecca), and eight grandchildren.

"Blessed are the dead which die in the Lord from henceforth: Yea, saith the Spirit, that they may rest from their labours; and their works do follow them." - Revelation 14:13`,
  deceasedPhoto: {
    url: 'https://placehold.co/200x250/e8e8e8/666666?text=Photo',
  },
  serviceDate: new Date('2024-12-28T19:00:00.000Z'), // 2pm Toronto time in UTC
  location: {
    name: 'Toronto North Christadelphian Ecclesia',
    address: '123 Church Street',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5V 2K1',
    onlineMeeting: {
      platform: 'Zoom',
      link: 'https://zoom.us/j/123456789',
      meetingId: '123 456 789',
      password: 'memorial',
    },
  },
  visitationDate: new Date('2024-12-27T23:00:00.000Z'), // 6pm Toronto time in UTC
  visitationEndDate: new Date('2024-12-28T01:00:00.000Z'), // 8pm Toronto time in UTC
  visitationSameLocation: false,
  visitationLocation: {
    name: 'Smith Funeral Home',
    address: '456 Memorial Drive',
    city: 'Toronto',
    province: 'ON',
  },
  hasGravesideService: true,
  gravesideDate: new Date('2024-12-28T21:00:00.000Z'), // 4pm Toronto time in UTC
  gravesideLocation: {
    name: 'Mount Pleasant Cemetery',
    address: '375 Mount Pleasant Road',
    city: 'Toronto',
    province: 'ON',
  },
  eventTimezone: 'America/Toronto',
  eventUrl: 'https://tee-admin.com/events/f-001',
  obituaryUrl: 'https://www.smithfuneralhome.com/obituary/robert-anderson',
}

const DEFAULT_TIMEZONE = 'America/Toronto'

// Map IANA timezone to city name for display
const TIMEZONE_CITY_NAMES: Record<string, string> = {
  'America/Toronto': 'Toronto',
  'America/Vancouver': 'Vancouver',
  'America/Edmonton': 'Edmonton',
  'America/Winnipeg': 'Winnipeg',
  'America/Halifax': 'Halifax',
  'America/St_Johns': "St. John's",
}

function getTimezoneCityName(timezone: string): string {
  return TIMEZONE_CITY_NAMES[timezone] || timezone.split('/').pop()?.replace(/_/g, ' ') || timezone
}

// Check if date string is date-only (no time component)
function isDateOnly(dateString: string | Date | undefined): boolean {
  if (!dateString) return false
  if (dateString instanceof Date) return false
  return typeof dateString === 'string' && !dateString.includes('T')
}

function formatDate(date: string | Date | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  })
}

function formatTime(date: string | Date | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).toLowerCase().replace(' ', '')
}

function formatTimeRange(
  startDate: string | Date | undefined,
  endDate: string | Date | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (!startDate) return ''
  const startTime = formatTime(startDate, timezone)
  if (!endDate) return startTime
  const endTime = formatTime(endDate, timezone)
  return `${startTime} - ${endTime}`
}

const sectionHeader = {
  fontSize: '18px',
  fontWeight: '600' as const,
  color: '#1a365d',
  marginBottom: '12px',
  marginTop: '24px',
}

const locationBox = {
  backgroundColor: '#ffffff',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  marginBottom: '16px',
}

const locationName = {
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#2d3748',
  margin: '0 0 8px 0',
}

const locationAddress = {
  fontSize: '14px',
  color: '#4a5568',
  margin: '0',
  lineHeight: '1.5',
}

const funeralHeader = {
  backgroundColor: '#2d3748',
  textAlign: 'center' as const,
  padding: '24px',
  color: 'white',
}

// Use mock data only for preview (when no props provided)
const FuneralEmail: React.FC<FuneralEmailProps> = (props) => {
  // Check if this is a preview (no real data passed)
  const isPreview = !props.deceased && !props.title && !props.aboutDeceased

  const title = props.title ?? (isPreview ? mockFuneralData.title : undefined)
  const deceased = props.deceased ?? (isPreview ? mockFuneralData.deceased : undefined)
  const ecclesia = props.ecclesia ?? (isPreview ? mockFuneralData.ecclesia : undefined)
  const aboutDeceased = props.aboutDeceased ?? (isPreview ? mockFuneralData.aboutDeceased : undefined)
  const deceasedPhoto = props.deceasedPhoto ?? (isPreview ? mockFuneralData.deceasedPhoto : undefined)
  const serviceDate = props.serviceDate ?? (isPreview ? mockFuneralData.serviceDate : undefined)
  const serviceTime = props.serviceTime // Legacy: explicit time string
  const location = props.location ?? (isPreview ? mockFuneralData.location : undefined)

  // Visitation (with backward compatibility for viewingDate/viewingTime/viewingLocation)
  const visitationDate = props.visitationDate ?? props.viewingDate ?? (isPreview ? mockFuneralData.visitationDate : undefined)
  const visitationEndDate = props.visitationEndDate ?? (isPreview ? mockFuneralData.visitationEndDate : undefined)
  const visitationTime = props.visitationTime ?? props.viewingTime // Legacy: explicit time string
  const visitationSameLocation = props.visitationSameLocation ?? (isPreview ? mockFuneralData.visitationSameLocation : true)
  const visitationLocation = props.visitationLocation ?? props.viewingLocation ?? (isPreview ? mockFuneralData.visitationLocation : undefined)

  // Graveside service
  const hasGravesideService = props.hasGravesideService ?? (isPreview ? mockFuneralData.hasGravesideService : false)
  const gravesideDate = props.gravesideDate ?? (isPreview ? mockFuneralData.gravesideDate : undefined)
  const gravesideTime = props.gravesideTime // Legacy: explicit time string
  const gravesideLocation = props.gravesideLocation ?? (isPreview ? mockFuneralData.gravesideLocation : undefined)

  // Timezone
  const eventTimezone = props.eventTimezone ?? (isPreview ? mockFuneralData.eventTimezone : DEFAULT_TIMEZONE) ?? DEFAULT_TIMEZONE
  const timezoneCityName = getTimezoneCityName(eventTimezone)

  const note = props.note
  const eventUrl = props.eventUrl ?? (isPreview ? mockFuneralData.eventUrl : undefined)
  const obituaryUrl = props.obituaryUrl ?? (isPreview ? mockFuneralData.obituaryUrl : undefined)

  const deceasedTitle = deceased?.title || ''
  const deceasedName = deceased
    ? `${deceasedTitle} ${deceased.firstName || ''} ${deceased.lastName || ''}`.trim()
    : 'Our Beloved Brother/Sister'

  // Format dates and times using timezone
  const formattedServiceDate = formatDate(serviceDate, eventTimezone)
  const formattedServiceTime = serviceTime || (serviceDate && !isDateOnly(serviceDate) ? formatTime(serviceDate, eventTimezone) : '')
  const formattedVisitationDate = formatDate(visitationDate, eventTimezone)
  const formattedVisitationTime = visitationTime || (visitationDate && !isDateOnly(visitationDate)
    ? formatTimeRange(visitationDate, visitationEndDate, eventTimezone)
    : '')
  const formattedGravesideDate = formatDate(gravesideDate, eventTimezone)
  const formattedGravesideTime = gravesideTime || (gravesideDate && !isDateOnly(gravesideDate) ? formatTime(gravesideDate, eventTimezone) : '')

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>Memorial Service for {deceasedName}</Preview>
      <Body style={main}>
        {/* Header */}
        <Section style={funeralHeader}>
          <Text style={{ fontSize: '14px', margin: '0 0 8px 0', color: '#e2e8f0' }}>
            Toronto East Christadelphians
          </Text>
          <Heading style={{ color: 'white', margin: '0 0 8px 0', fontSize: '28px' }}>
            {title || `In Loving Memory of ${deceasedName}`}
          </Heading>
        </Section>

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

        {/* Obituary Link (if provided) */}
        {obituaryUrl && (
          <Container style={container}>
            <Section style={{ marginTop: '20px' }}>
              <Text style={{ ...defaultText, margin: '0' }}>
                <strong>Obituary:</strong>{' '}
                <Link href={obituaryUrl} style={{ color: '#2b6cb0', textDecoration: 'underline' }}>
                  {obituaryUrl}
                </Link>
              </Text>
            </Section>
          </Container>
        )}

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          {/* About the Deceased Section - no header, just photo and text */}
          {(aboutDeceased || deceasedPhoto) && (
            <Section>
              {deceasedPhoto?.url ? (
                <Row>
                  <Column style={{ width: '160px', verticalAlign: 'top', paddingRight: '20px' }}>
                    <Img
                      src={deceasedPhoto.url}
                      alt={`Photo of ${deceasedName}`}
                      width={150}
                      style={{
                        borderRadius: '8px',
                        maxWidth: '150px',
                        height: 'auto',
                      }}
                    />
                  </Column>
                  {aboutDeceased && (
                    <Column style={{ verticalAlign: 'top' }}>
                      <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        <AutoLinkText text={aboutDeceased} />
                      </Text>
                    </Column>
                  )}
                </Row>
              ) : aboutDeceased ? (
                <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                  <AutoLinkText text={aboutDeceased} />
                </Text>
              ) : null}
            </Section>
          )}

          {/* Timezone Notice */}
          <Section style={{ marginBottom: '16px' }}>
            <Text style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: '0' }}>
              All times are {timezoneCityName} time
            </Text>
          </Section>

          {/* Visitation Details (if applicable) - shown BEFORE service */}
          {(formattedVisitationDate || (!visitationSameLocation && visitationLocation)) && (
            <Section>
              <Text style={sectionHeader}>Visitation</Text>
              <Section style={locationBox}>
                {formattedVisitationDate && (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
                    <strong>{formattedVisitationDate}</strong>
                    {formattedVisitationTime && `, ${formattedVisitationTime}`}
                  </Text>
                )}
                {/* Only show visitation location if different from service */}
                {!visitationSameLocation && visitationLocation && (
                  <>
                    <Text style={locationName}>{visitationLocation.name}</Text>
                    {visitationLocation.address && (
                      <Text style={locationAddress}>
                        {visitationLocation.address}
                        <br />
                        {[visitationLocation.city, visitationLocation.province]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    )}
                  </>
                )}
                {/* If same location, just note it */}
                {visitationSameLocation && location && (
                  <Text style={{ ...defaultText, margin: '0', fontStyle: 'italic', color: '#666' }}>
                    Same location as service
                  </Text>
                )}
              </Section>
            </Section>
          )}

          {/* Service Details */}
          {(formattedServiceDate || location) && (
            <Section>
              <Text style={sectionHeader}>Service</Text>
              <Section style={locationBox}>
                {formattedServiceDate && (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
                    <strong>{formattedServiceDate}</strong>
                    {formattedServiceTime && ` at ${formattedServiceTime}`}
                  </Text>
                )}
                {location && (
                  <>
                    <Text style={{ ...defaultText, margin: '0 0 4px 0', fontWeight: '600', color: '#1a365d' }}>
                      In person
                    </Text>
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
                {/* Online Meeting Info */}
                {location?.onlineMeeting && (
                  <Section style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                    <Text style={{ ...defaultText, margin: '0 0 4px 0', fontWeight: '600', color: '#1a365d' }}>
                      Stream online
                    </Text>
                    {location.onlineMeeting.link && (
                      <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
                        <Link href={location.onlineMeeting.link} style={{ color: '#2b6cb0' }}>
                          {location.onlineMeeting.link}
                        </Link>
                      </Text>
                    )}
                    {location.onlineMeeting.meetingId && (
                      <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
                        Meeting ID: {location.onlineMeeting.meetingId}
                      </Text>
                    )}
                    {location.onlineMeeting.password && (
                      <Text style={{ ...defaultText, margin: '0' }}>
                        Password: {location.onlineMeeting.password}
                      </Text>
                    )}
                  </Section>
                )}
              </Section>
            </Section>
          )}

          {/* Graveside Service (if applicable) */}
          {hasGravesideService && (formattedGravesideDate || gravesideLocation) && (
            <Section>
              <Text style={sectionHeader}>Graveside Service</Text>
              <Section style={locationBox}>
                {formattedGravesideDate && (
                  <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
                    <strong>{formattedGravesideDate}</strong>
                    {formattedGravesideTime && ` at ${formattedGravesideTime}`}
                  </Text>
                )}
                {gravesideLocation && (
                  <>
                    <Text style={locationName}>{gravesideLocation.name}</Text>
                    {gravesideLocation.address && (
                      <Text style={locationAddress}>
                        {gravesideLocation.address}
                        <br />
                        {[gravesideLocation.city, gravesideLocation.province]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    )}
                  </>
                )}
              </Section>
            </Section>
          )}

          {/* View Full Details Link */}
          {eventUrl && (
            <Section style={{ textAlign: 'center', marginTop: '32px', marginBottom: '24px' }}>
              <Link href={eventUrl} style={link}>
                View Full Details
              </Link>
            </Section>
          )}

          {/* Condolences */}
          <Section style={{
            backgroundColor: '#f7fafc',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center',
            marginTop: '24px',
          }}>
            <Text style={{ ...defaultText, margin: '0', fontStyle: 'italic', color: '#4a5568' }}>
              "Blessed are they that mourn: for they shall be comforted."
              <br />
              <span style={{ fontSize: '14px' }}>— Matthew 5:4</span>
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

export default FuneralEmail
