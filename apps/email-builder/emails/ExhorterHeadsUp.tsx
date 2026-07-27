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
 *
 * Content values (short ecclesia name, hall address, Recording Brother
 * signature, lunch style, ways-to-attend) are resolved SERVER-SIDE from the
 * ecclesia directory + the memorial row and passed as plain props — this
 * template renders them, it does not derive them.
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

/** How the fellowship lunch (if any) is provided — drives the invite wording. */
export type ExhorterHeadsUpLunch = 'potluck' | 'provided' | 'generic'

export interface ExhorterHeadsUpProps {
  /** Exhorter's full name for the formal "Dear Brother {name}" greeting. */
  exhorterName: string
  /** Host ecclesia SHORT name, e.g. "Toronto East" (Christadelphians trimmed). */
  hostEcclesiaName: string
  /** Full street address of the meeting hall, e.g. "975 Cosburn Ave., …". */
  address?: string
  /** Pre-formatted date, e.g. "Sunday, February 1, 2026". */
  dateDisplay: string
  /** Pre-formatted time, e.g. "11:00am". */
  timeDisplay: string
  /**
   * Ways to attend online — from the per-occurrence override, else the host's
   * default meeting. Shown "just in case" the exhorter can't attend in person;
   * omitted entirely when empty (no digital option for this meeting).
   */
  attendOptions: ExhorterHeadsUpAttendOption[]
  /** Fellowship lunch style for this occasion, or undefined for no lunch line. */
  lunchType?: ExhorterHeadsUpLunch
  /** Recording Brother's full name for the signature (host ecclesia). */
  signatoryName?: string
  /** Real (resolved) Email Preferences URL for this recipient. */
  emailPreferencesUrl: string
  /** Echad Hub URL for the footer "powered by" line. */
  echadHubUrl?: string
  /** Brand identity for the header/footer address — passed as a prop. */
  identity?: EmailIdentity
}

const ECHAD_HUB_URL = 'https://echadhub.org'

function lunchSentence(lunchType?: ExhorterHeadsUpLunch): string | null {
  switch (lunchType) {
    case 'potluck':
      return "You're warmly invited to stay for a potluck fellowship lunch at the hall following the Memorial Service."
    case 'provided':
      return "You're warmly invited to stay for lunch and fellowship following the Memorial Service — lunch will be provided."
    case 'generic':
      return "You're warmly invited to stay for lunch and fellowship following the Memorial Service."
    default:
      return null
  }
}

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
  exhorterName,
  hostEcclesiaName,
  address,
  dateDisplay,
  timeDisplay,
  attendOptions,
  lunchType,
  signatoryName,
  emailPreferencesUrl,
  echadHubUrl = ECHAD_HUB_URL,
  identity,
}) => {
  const trimmedName = exhorterName?.trim() ?? ''
  const greeting = trimmedName ? `Dear Brother ${trimmedName},` : 'Dear Brother,'
  const lunchLine = lunchSentence(lunchType)
  const hasDigital = attendOptions.length > 0

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{`We're looking forward to your exhortation at ${hostEcclesiaName} on ${dateDisplay}.`}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{hostEcclesiaName}</Heading>
          <Text style={defaultText}>A note about your upcoming exhortation</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{greeting}</Text>
          <Text style={defaultText}>
            {`We're looking forward to your exhortation at ${hostEcclesiaName} on `}
            <strong>{dateDisplay}</strong>
            {' at '}
            <strong>{timeDisplay}</strong>
            {'.'}
          </Text>
        </Container>

        <Container style={container} className="container">
          <Heading style={defaultText}>Ways to attend</Heading>
          <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
            <strong>In person:</strong>
          </Text>
          {address ? (
            <Text style={{ ...defaultText, margin: '0 0 12px 0' }}>{`We're located at: ${address}`}</Text>
          ) : null}
          {hasDigital ? (
            <>
              <Text style={defaultText}>If you can&apos;t be with us in person, please join:</Text>
              {attendOptions.map((option, i) => (
                <AttendOptionBlock key={i} option={option} />
              ))}
            </>
          ) : null}
        </Container>

        <Container style={container} className="container">
          <Heading style={defaultText}>What&apos;s next</Heading>
          <Text style={defaultText}>
            The week of your exhortation, we&apos;ll send a follow-up email to request your theme,
            readings, and hymn preferences so we can prepare the service with you.
          </Text>
        </Container>

        {lunchLine ? (
          <Container style={container} className="container">
            <Text style={defaultText}>{lunchLine}</Text>
          </Container>
        ) : null}

        <Container style={container} className="container">
          <Text style={defaultText}>
            In the event you&apos;re unable to join us, please reply to this email and let us know at
            your earliest convenience.
          </Text>
          <Text style={{ ...defaultText, margin: '16px 0 0 0' }}>With love in the LORD,</Text>
          <Text style={{ ...defaultText, margin: '0' }}>
            {signatoryName?.trim() ? (
              <>
                <strong>{`Brother ${signatoryName.trim()}`}</strong>
                <br />
                Ecclesial Recorder
              </>
            ) : (
              'The Ecclesial Recorder'
            )}
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
