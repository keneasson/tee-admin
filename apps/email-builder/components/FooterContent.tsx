import { defaultText, footer, footerLink, footerText } from '../styles'
import { Link, Section, Text } from '@react-email/components'
import React from 'react'
import type { EmailIdentity } from '@my/app/types/brand-profile'

/**
 * Default footer identity (Toronto East). Lives in this server-safe module — NOT
 * in the `'use client'` email-identity module — so it can be imported and used
 * from App Router server routes without creating a client reference.
 */
export const DEFAULT_EMAIL_IDENTITY: EmailIdentity = {
  name: 'Toronto East Christadelphians',
  addressLines: ['975 Cosburn Avenue', 'Toronto, On M4C 2W8', 'Canada'],
  homeUrl: 'https://tee-admin.com',
  homeLabel: 'Toronto East Christadelphians',
}

/**
 * Pure, presentational email footer. Identity is a plain prop — no React
 * context / hook — so this renders from any server context. The hook-based
 * {@link Footer} wraps this for templates that take identity from the
 * EmailIdentityProvider context.
 */
export const FooterContent = ({
  identity = DEFAULT_EMAIL_IDENTITY,
}: {
  identity?: EmailIdentity
}) => {
  return (
    <Section style={footer}>
      <Text style={defaultText}>
        To change your email preferences or unsubscribe please follow this link:
      </Text>
      {/* Recipient-scoped self-serve page (#75). {{emailPreferencesUrl}} is
          replaced per recipient at send time with a tokenized link to
          /email-preferences; it shows only the public topics — never the full
          SES topic list the hosted page exposed. */}
      <Link href="{{emailPreferencesUrl}}" style={footerLink}>
        {'Manage Email Preferences'}
      </Link>

      <Text style={footerText}>
        <strong>Our address is:</strong>
        <br />
        {identity.name}
        {(identity.addressLines ?? []).map((line, i) => (
          <React.Fragment key={i}>
            <br />
            {line}
          </React.Fragment>
        ))}
      </Text>
    </Section>
  )
}
