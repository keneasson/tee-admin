import { defaultText, footer, footerLink, footerText } from '../styles'
import { Link, Section, Text } from '@react-email/components'
import React from 'react'
import { useEmailIdentity } from './email-identity'

export const Footer = () => {
  const identity = useEmailIdentity()
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
