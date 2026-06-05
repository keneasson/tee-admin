/**
 * ReplacementEventCard - Renders an event inline within the Sunday schedule section
 * when services are cancelled and replaced by a special event (e.g., Baptism at another ecclesia).
 *
 * Used by both Newsletter and Memorial (recap) email templates.
 *
 * Trigger: In the Google Sheet, leave Exhort + Preside blank (triggers noServiceAtHall),
 * then put the exact Event title in the "Lunch" column to match against upcoming events.
 */
import React from 'react'
import { Column, Link, Row, Text } from '@react-email/components'
import type { Event, LocationInfo } from '@my/app/types/events'
import { getPlatformDisplayName } from '@my/app/types/events'
import { defaultText, link } from '../styles'
import { AutoLinkText } from './AutoLinkText'

/** Find an event by title (case-insensitive substring match) */
export function findReplacementEvent(
  upcomingEvents: Event[],
  eventTitle: string
): Event | undefined {
  if (!eventTitle || !upcomingEvents?.length) return undefined
  const needle = eventTitle.trim().toLowerCase()
  return upcomingEvents.find((e) => e.title?.toLowerCase().includes(needle))
}

/** Format a date for display in the email */
function formatDate(date: Date | string | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })
}

/** Get the primary date for an event based on its type */
function getEventDate(event: Event): string {
  if (event.type === 'baptism' && event.baptismDate) return formatDate(event.baptismDate)
  if (event.type === 'wedding' && event.ceremonyDate) return formatDate(event.ceremonyDate)
  if (event.type === 'funeral' && event.serviceDate) return formatDate(event.serviceDate)
  if (event.startDate) return formatDate(event.startDate)
  if (event.dateRange?.start) return formatDate(event.dateRange.start)
  return ''
}

/** Render location info */
function LocationDisplay({ location }: { location: LocationInfo }) {
  const name = location.name || location.placeName
  if (!name) return null

  return (
    <>
      <br />
      <br />
      <strong>Location:</strong>
      <br />
      {name}
      {location.address ? (
        <>
          <br />
          {location.address}
        </>
      ) : null}
      {(location.city || location.province) ? (
        <>
          <br />
          {[location.city, location.province, location.postalCode].filter(Boolean).join(', ')}
        </>
      ) : null}
      {location.mapsUrl ? (
        <>
          <br />
          <Link
            href={location.mapsUrl}
            style={{ color: '#2b6cb0', textDecoration: 'underline', fontSize: '14px' }}
          >
            Get Directions
          </Link>
        </>
      ) : null}
    </>
  )
}

/** Render online meeting info */
function OnlineMeetingDisplay({ meeting }: { meeting: LocationInfo['onlineMeeting'] }) {
  if (!meeting?.link) return null

  return (
    <>
      <br />
      <br />
      <strong>Join Online:</strong>
      <br />
      <Link href={meeting.link} style={{ color: '#2b6cb0', textDecoration: 'underline', fontSize: '14px' }}>
        {meeting.platform ? `Join via ${getPlatformDisplayName(meeting.platform)}` : 'Join Online'}
      </Link>
      {meeting.meetingId ? (
        <>
          <br />
          Meeting ID: {meeting.meetingId}
        </>
      ) : null}
      {meeting.password ? (
        <>
          <br />
          Password: {meeting.password}
        </>
      ) : null}
      {meeting.additionalInfo ? (
        <>
          <br />
          <em>{meeting.additionalInfo}</em>
        </>
      ) : null}
    </>
  )
}

interface ReplacementEventCardProps {
  event: Event
  explanation?: string
}

/**
 * Renders an event card inline within the Sunday schedule section.
 * Shows the "no service" message followed by the replacement event details.
 */
export const ReplacementEventCard: React.FC<ReplacementEventCardProps> = ({
  event,
  explanation,
}) => {
  const eventDate = getEventDate(event)
  const location = event.location
  const hostEcclesia = event.hostingEcclesia

  return (
    <>
      <Text style={defaultText}>
        <strong>There will be no IN PERSON Services at Toronto East, Zoom and YouTube will remain unchanged.</strong>
        {explanation ? (
          <>
            <br />
            <br />
            {explanation}
          </>
        ) : null}
      </Text>

      <Text style={{ ...defaultText, marginTop: '16px' }}>
        <Link
          href={`${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:4000'}/events/${event.id}`}
          style={{
            color: '#0066cc',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '18px',
          }}
        >
          {event.title}
        </Link>

        {/* Date omitted — already shown in "Arrangements for {date}" header */}

        {/* Hosting Ecclesia */}
        {hostEcclesia?.name ? (
          <>
            <br />
            <br />
            <strong>Hosted by:</strong> {hostEcclesia.name}
            {hostEcclesia.city ? `, ${hostEcclesia.city}` : ''}
          </>
        ) : null}

        {/* Baptism-specific: candidate info */}
        {event.type === 'baptism' && event.candidate ? (
          <>
            <br />
            <br />
            After a good confession of Faith,{' '}
            <strong>
              {`${event.candidate.firstName || ''} ${event.candidate.lastName || ''}`.trim()}
            </strong>{' '}
            will be baptized into the saving name of our Lord.
          </>
        ) : null}
      </Text>

      {/* Baptism candidate photo + about */}
      {event.type === 'baptism' && (event.aboutCandidate || event.candidatePhoto) ? (
        <Text style={{ ...defaultText, marginTop: '8px' }}>
          {event.candidatePhoto ? (
            <Row>
              <Column
                style={{
                  width: '140px',
                  verticalAlign: 'top',
                  paddingRight: '16px',
                }}
              >
                <img
                  src={event.candidatePhoto.url}
                  alt="Photo of the candidate"
                  style={{
                    width: '120px',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                />
              </Column>
              {event.aboutCandidate ? (
                <Column style={{ verticalAlign: 'top' }}>
                  <Text style={{ ...defaultText, margin: 0, whiteSpace: 'pre-wrap' }}>
                    <AutoLinkText text={event.aboutCandidate} />
                  </Text>
                </Column>
              ) : null}
            </Row>
          ) : event.aboutCandidate ? (
            <Text style={{ ...defaultText, margin: 0, whiteSpace: 'pre-wrap' }}>
              <AutoLinkText text={event.aboutCandidate} />
            </Text>
          ) : null}
        </Text>
      ) : null}

      {/* Description (for non-baptism events) */}
      {event.type !== 'baptism' && event.description ? (
        <Text style={{ ...defaultText, marginTop: '8px', whiteSpace: 'pre-wrap' }}>
          <AutoLinkText text={event.description} />
        </Text>
      ) : null}

      {/* Location */}
      {location ? (
        <Text style={{ ...defaultText, marginTop: '4px' }}>
          <LocationDisplay location={location} />
          {location.onlineMeeting ? (
            <OnlineMeetingDisplay meeting={location.onlineMeeting} />
          ) : null}
        </Text>
      ) : null}

      {/* Sections (for multi-section events like Fraternal Gatherings) */}
      {event.sections && event.sections.length > 0 ? (
        <>
          {event.sections.map((section) => (
            <Text key={section.id} style={{ ...defaultText, marginTop: '12px' }}>
              <strong>{section.title}</strong>
              {section.date ? (
                <>
                  <br />
                  {formatDate(section.date)}
                </>
              ) : null}
              {section.startTime ? (
                <>
                  {' '}
                  {section.startTime}
                  {section.endTime ? ` - ${section.endTime}` : ''}
                </>
              ) : null}
              {section.location?.name ? (
                <>
                  <br />
                  {section.location.name}
                  {section.location.address ? `, ${section.location.address}` : ''}
                </>
              ) : null}
              {section.items?.length > 0 ? (
                <>
                  {section.items.map((item, i) => (
                    <React.Fragment key={i}>
                      <br />
                      {item.time ? `${item.time} - ` : ''}
                      {item.title || item.activity || ''}
                      {item.speakers?.length ? (
                        <>
                          {' '}
                          ({item.speakers.map((s) => `${s.firstName} ${s.lastName}`).join(', ')})
                        </>
                      ) : null}
                    </React.Fragment>
                  ))}
                </>
              ) : null}
            </Text>
          ))}
        </>
      ) : null}

      {/* Registration info */}
      {event.registration?.required ? (
        <Text style={{ ...defaultText, marginTop: '8px' }}>
          <strong>Registration required</strong>
          {event.registration.registrationUrl ? (
            <>
              <br />
              <Link
                href={event.registration.registrationUrl}
                style={{ color: '#2b6cb0', textDecoration: 'underline' }}
              >
                {event.registration.registrationUrl}
              </Link>
            </>
          ) : null}
          {event.registration.deadline ? (
            <>
              <br />
              Deadline: {formatDate(event.registration.deadline)}
            </>
          ) : null}
        </Text>
      ) : null}
    </>
  )
}
