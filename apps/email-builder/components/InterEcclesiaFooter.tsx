import { defaultText, footer, footerText } from '../styles'
import { Button, Section, Text } from '@react-email/components'
import React from 'react'
import { useEmailIdentity } from './email-identity'

export interface InterEcclesiaFooterProps {
  /**
   * Token-based URL for updating ecclesia contact info
   * Format: /ecclesia-contact?token=xxx
   * If not provided, uses placeholder that will be replaced at send time
   */
  updateContactUrl?: string
}

const primaryButton = {
  backgroundColor: '#3b82f6',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontWeight: '600' as const,
  fontSize: '14px',
  textDecoration: 'none',
  display: 'inline-block',
  textAlign: 'center' as const,
}

export const InterEcclesiaFooter: React.FC<InterEcclesiaFooterProps> = ({
  updateContactUrl = '{{ecclesiaUpdateUrl}}',
}) => {
  const identity = useEmailIdentity()
  return (
    <Section style={footer}>
      <Text style={defaultText}>
        To update your ecclesia's contact information:
      </Text>
      <Button href={updateContactUrl} style={primaryButton}>
        Update Contact Info
      </Button>

      <Text style={{ ...footerText, marginTop: '16px' }}>
        You are receiving this email as a contact for your ecclesia.
        <br />
        Please share relevant announcements with your ecclesia members.
      </Text>

      <Text style={footerText}>
        <strong>From:</strong>
        <br />
        {identity.name}
        {(identity.addressLines ?? []).map((line, i) => (
          <React.Fragment key={i}>
            <br />
            {line}
          </React.Fragment>
        ))}
      </Text>

      <Text style={{ ...footerText, marginTop: '16px', fontSize: '12px', color: '#a0aec0' }}>
        Reply directly to this email to contact the sender.
      </Text>
    </Section>
  )
}
