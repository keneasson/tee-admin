import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import React from 'react'
import {
  container,
  defaultText,
  footer,
  footerLink,
  footerText,
  globalCss,
  header,
  link,
  main,
} from '../styles'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'

/**
 * Exhorter heads-up email (#124, slice A). A warm 1:1 reminder to whoever is
 * scheduled to give the exhortation at an upcoming memorial — reaching visiting
 * speakers across ecclesias via their resolved directory email.
 *
 * SERVER-SAFE: identity is a plain PROP (no EmailIdentityProvider context /
 * `'use client'` import), so this renders from an App Router server route. This
 * email is sent 1:1 via `sendEmail()` which does NOT do per-recipient token
 * substitution (that lives in the bulk `emailSend` path) — so the footer here
 * builds a REAL Email Preferences URL passed in as a prop, and does NOT use the
 * shared `FooterContent`'s `{{emailPreferencesUrl}}` token (which would ship as
 * a literal placeholder here). The shared FooterContent is intentionally left
 * untouched.
 */

/** One "way to attend" the memorial (Zoom / stream / in-person online meeting). */
export interface ExhorterHeadsUpAttendOption {
  label: string
  url?: string
  meetingId?: string
  password?: string
  platform?: string
  dialInNumber?: string
}

export interface ExhorterHeadsUpProps {
  /** Exhorter's first name for the greeting. */
  firstName: string
  /** Host ecclesia public name, e.g. "Toronto East Christadelphians". */
  hostEcclesiaName: string
  /** Pre-formatted date, e.g. "Sunday, February 1, 2026". */
  dateDisplay: string
  /** Pre-formatted time, e.g. "11:00am". */
  timeDisplay: string
  /** True when the speaker is visiting (non-member / different ecclesia). */
  visiting: boolean
  /** Ways to attend — from the per-occurrence override, else the default Zoom. */
  attendOptions: ExhorterHeadsUpAttendOption[]
  /** Real (resolved) Email Preferences URL for this recipient. */
  emailPreferencesUrl: string
  /** Echad Hub URL for the footer "powered by" line. */
  echadHubUrl?: string
  /** Brand identity for the header/footer address — passed as a prop. */
  identity?: EmailIdentity
}

const ECHAD_HUB_URL = 'https://echadhub.org'

const AttendOptionBlock = ({ option }: { option: ExhorterHeadsUpAttendOption }) => {
  return (
    <Section style={{ marginBottom: '12px' }}>
      <Text style={{ ...defaultText, fontWeight: 'bold', margin: '0 0 4px 0' }}>{option.label}</Text>
      {option.url ? (
        <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
          <Link href={option.url} style={link}>
            Click to join
          </Link>
        </Text>
      ) : null}
      {option.meetingId ? (
        <Text style={{ ...defaultText, margin: '0' }}>{`Meeting ID: ${option.meetingId}`}</Text>
      ) : null}
      {option.password ? (
        <Text style={{ ...defaultText, margin: '0' }}>{`Password: ${option.password}`}</Text>
      ) : null}
      {option.dialInNumber ? (
        <Text style={{ ...defaultText, margin: '0' }}>{`Join by phone: ${option.dialInNumber}`}</Text>
      ) : null}
    </Section>
  )
}

const ExhorterHeadsUp: React.FC<ExhorterHeadsUpProps> = ({
  firstName,
  hostEcclesiaName,
  dateDisplay,
  timeDisplay,
  visiting,
  attendOptions,
  emailPreferencesUrl,
  echadHubUrl = ECHAD_HUB_URL,
  identity,
}) => {
  const greetingName = firstName?.trim() ? firstName.trim() : 'Brother'

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{`You're scheduled to exhort at ${hostEcclesiaName} on ${dateDisplay}.`}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{hostEcclesiaName}</Heading>
          <Text style={defaultText}>A note about your upcoming exhortation</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{`Dear ${greetingName},`}</Text>
          <Text style={defaultText}>
            {`You're scheduled to give the exhortation at ${hostEcclesiaName} on `}
            <strong>{dateDisplay}</strong>
            {' at '}
            <strong>{timeDisplay}</strong>
            {'. Thank you for serving — we look forward to hearing from you.'}
          </Text>

          {visiting ? (
            <Text style={defaultText}>
              <strong>Lunch is provided — please plan to stay and share it with us.</strong>
            </Text>
          ) : null}
        </Container>

        <Container style={container} className="container">
          <Heading style={defaultText}>Ways to attend</Heading>
          <Text style={defaultText}>
            For any who cannot be with us in person, here are the ways to join:
          </Text>
          {attendOptions.length > 0 ? (
            attendOptions.map((option, i) => <AttendOptionBlock key={i} option={option} />)
          ) : (
            <Text style={defaultText}>Attendance details will follow.</Text>
          )}
        </Container>

        <Container style={container} className="container">
          <Heading style={defaultText}>What to expect</Heading>
          <Text style={defaultText}>
            The week of your exhortation, we&apos;ll send a follow-up email to request your theme,
            readings, and hymn preferences so we can prepare the service with you.
          </Text>
        </Container>

        {/* Custom, email-scoped footer. Deliberately NOT the shared FooterContent:
            this 1:1 send does no {{emailPreferencesUrl}} token substitution, so we
            render a REAL preferences link here instead. */}
        <Section style={footer}>
          <Text style={footerText}>
            {'TEE-Admin — powered by '}
            <Link href={echadHubUrl} style={footerLink}>
              Echad Hub
            </Link>
            {', and Christadelphian Initiative'}
          </Text>
          <Text style={footerText}>
            <Link href={emailPreferencesUrl} style={footerLink}>
              Email Preferences
            </Link>
          </Text>
          {identity?.name ? (
            <Text style={footerText}>
              <strong>Our address is:</strong>
              <br />
              {identity.name}
              {(identity.addressLines ?? []).map((lineText, i) => (
                <React.Fragment key={i}>
                  <br />
                  {lineText}
                </React.Fragment>
              ))}
            </Text>
          ) : null}
        </Section>
      </Body>
    </Html>
  )
}

export default ExhorterHeadsUp
