import { footer, footerText } from '../styles'
import { Section, Text } from '@react-email/components'
import React from 'react'

export const Footer = () => {
  return (
    <Section style={footer}>
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
