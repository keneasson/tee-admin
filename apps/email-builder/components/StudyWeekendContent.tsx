import { Link, Section, Text } from '@react-email/components'
import { defaultText } from '../styles'
import React from 'react'

export interface StudyWeekendContentProps {
  title?: string
  theme: string
  startDate?: Date | null
  endDate?: Date | null
  location?: {
    name?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
  } | null
  speakers?: Array<{ firstName?: string; lastName?: string }> | null
  description?: string | null
  registration?: {
    required?: boolean
    url?: string
  } | null
  eventUrl?: string
}

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return 'TBD'
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export const StudyWeekendContent: React.FC<StudyWeekendContentProps> = ({
  title,
  theme,
  startDate,
  endDate,
  location,
  speakers,
  description,
  registration,
  eventUrl,
}) => {
  const speakerNames = speakers
    ?.map((s) => `${s.firstName || ''} ${s.lastName || ''}`.trim())
    .filter(Boolean)
    .join(', ')

  return (
    <Section style={{ padding: '20px 0' }}>
      {/* Event Title - smaller than theme to let theme stand out */}
      {title ? (
        <Text style={{ ...defaultText, color: '#1a365d', margin: '0 0 12px 0', fontSize: '20px', fontWeight: '600' }}>
          {title}
        </Text>
      ) : null}

      {/* Theme - primary emphasis */}
      <Text style={{ ...defaultText, color: '#1a365d', margin: '0 0 16px 0', fontSize: '24px', fontWeight: '600' }}>
        {theme}
      </Text>

      {/* Speakers - with spacing around */}
      {speakerNames ? (
        <Text style={{ ...defaultText, margin: '0 0 24px 0' }}>
          <strong>Speaker{speakers && speakers.length > 1 ? 's' : ''}:</strong> {speakerNames}
        </Text>
      ) : null}

      {/* Date Range */}
      {startDate ? (
        <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
          <strong>When:</strong>{' '}
          {endDate && endDate.getTime() !== startDate.getTime()
            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
            : formatDate(startDate)}
        </Text>
      ) : null}

      {/* Location with full address */}
      {location?.name ? (
        <Text style={{ ...defaultText, margin: '0 0 8px 0' }}>
          <strong>Where:</strong> {location.name}
          {location.address ? (
            <>
              <br />
              {location.address}
            </>
          ) : null}
          {location.city || location.province || location.postalCode ? (
            <>
              <br />
              {location.city}
              {location.city && location.province ? ', ' : ''}
              {location.province}
              {(location.city || location.province) && location.postalCode ? ' ' : ''}
              {location.postalCode}
            </>
          ) : null}
          {location.country ? (
            <>
              <br />
              {location.country}
            </>
          ) : null}
        </Text>
      ) : null}

      {/* Description */}
      {description ? (
        <Section style={{ margin: '16px 0', padding: '16px', backgroundColor: '#f7fafc', borderRadius: '4px' }}>
          <Text style={{ ...defaultText, margin: '0', lineHeight: '1.6' }}>
            {description}
          </Text>
        </Section>
      ) : null}

      {/* Registration */}
      {registration?.required ? (
        <Text style={{ ...defaultText, margin: '16px 0 8px 0', color: '#c53030' }}>
          <strong>Registration Required</strong>
        </Text>
      ) : null}

      {registration?.url ? (
        <Text style={{ ...defaultText, margin: '8px 0' }}>
          <Link href={registration.url} style={{ color: '#2b6cb0', textDecoration: 'underline' }}>
            Register Here
          </Link>
        </Text>
      ) : null}

      {/* Event URL */}
      {eventUrl ? (
        <Text style={{ ...defaultText, margin: '16px 0 0 0' }}>
          <Link href={eventUrl} style={{ color: '#2b6cb0', textDecoration: 'underline' }}>
            View full details
          </Link>
        </Text>
      ) : null}
    </Section>
  )
}
