import { defaultText, footer, footerLink, footerText } from '../styles'
import { Link, Section, Text } from '@react-email/components'
import React from 'react'

export const Footer = () => {
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
        Toronto East Christadelphians
        <br />
        975 Cosburn Avenue
        <br />
        Toronto, On M4C 2W8
        <br />
        Canada
      </Text>
    </Section>
  )
}
