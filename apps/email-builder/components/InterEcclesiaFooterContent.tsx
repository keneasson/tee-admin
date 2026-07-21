import { defaultText, footer, footerText } from '../styles'
import { Button, Section, Text } from '@react-email/components'
import React from 'react'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { DEFAULT_EMAIL_IDENTITY } from './FooterContent'

/**
 * Pure, presentational inter-ecclesia footer. Identity is a plain PROP (no React
 * context / hook) so this renders from any server context — including App Router
 * server routes — mirroring {@link FooterContent} / {@link EmailBrandLinkContent}.
 * The hook-based {@link InterEcclesiaFooter} is retired in favour of this.
 */
export interface InterEcclesiaFooterContentProps {
  /**
   * Token-based URL for updating ecclesia contact info
   * (/ecclesia-contact?token=xxx). Defaults to the placeholder replaced at send time.
   */
  updateContactUrl?: string
  /** Brand identity for the "From" block. Defaults to Toronto East. */
  identity?: EmailIdentity
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

export const InterEcclesiaFooterContent: React.FC<InterEcclesiaFooterContentProps> = ({
  updateContactUrl = '{{ecclesiaUpdateUrl}}',
  identity = DEFAULT_EMAIL_IDENTITY,
}) => {
  return (
    <Section style={footer}>
      <Text style={defaultText}>To update your ecclesia's contact information:</Text>
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
