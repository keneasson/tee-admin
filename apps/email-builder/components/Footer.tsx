import { defaultText, footer, footerLink, footerText } from '../styles'
import { Link, Section, Text } from '@react-email/components'
import React from 'react'
import { useEmailIdentity } from './email-identity'
import type { EmailIdentity } from '@my/app/types/brand-profile'

/**
 * Footer identity defaults to the {@link EmailIdentityProvider} context.
 * Callers rendering from an App Router server route — where the `'use client'`
 * provider can't be used as an element — can pass `identity` directly instead.
 */
export const Footer = ({ identity: identityProp }: { identity?: EmailIdentity } = {}) => {
  const contextIdentity = useEmailIdentity()
  const identity = identityProp ?? contextIdentity
  return (
    <Section style={footer}>
      <Text style={defaultText}>
        To change your email preferences or unsubscribe please follow this link:
      </Text>
      <Link href="{{amazonSESUnsubscribeUrl}}" style={footerLink}>
        {'Unsubscribe & Email Preferences'}
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
