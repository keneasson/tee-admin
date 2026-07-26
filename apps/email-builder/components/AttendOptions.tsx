import { Section, Text, Link } from '@react-email/components'
import type { AttendOption } from '@my/app/types'

/**
 * Email "Ways to attend" list for a single service occurrence (Phase 2 of
 * per-occurrence overrides). When present, supersedes the hardcoded single-Zoom
 * block in the email templates.
 */

const baseText = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  lineHeight: '24px',
  color: '#333333',
  margin: '0 0 4px 0',
} as const

const optionBox = {
  borderLeft: '4px solid #1565C0',
  paddingLeft: '12px',
  marginBottom: '12px',
} as const

export const AttendOptions = ({ options }: { options?: AttendOption[] }) => {
  if (!options || options.length === 0) return null

  return (
    <Section>
      <Text style={{ ...baseText, fontWeight: 'bold' }}>Ways to attend:</Text>
      {options.map((opt) => (
        <Section key={opt.id} style={optionBox}>
          <Text style={{ ...baseText, fontWeight: 'bold' }}>
            {opt.label}
            {opt.hostEcclesia ? ` — ${opt.hostEcclesia}` : ''}
          </Text>

          {opt.mode === 'in_person' ? (
            <>
              {opt.address ? <Text style={baseText}>{opt.address}</Text> : null}
              {opt.mapsUrl ? (
                <Text style={baseText}>
                  <Link href={opt.mapsUrl}>View on Google Maps</Link>
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {opt.url ? (
                <Text style={baseText}>
                  <Link href={opt.url}>
                    {opt.mode === 'stream' ? 'Watch the stream' : 'Join online'}
                  </Link>
                </Text>
              ) : null}
              {opt.meetingId ? <Text style={baseText}>Meeting ID: {opt.meetingId}</Text> : null}
              {opt.password ? <Text style={baseText}>Passcode: {opt.password}</Text> : null}
              {opt.dialInNumber ? <Text style={baseText}>Dial-in: {opt.dialInNumber}</Text> : null}
            </>
          )}
        </Section>
      ))}
    </Section>
  )
}
