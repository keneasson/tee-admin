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
  /**
   * True when the exhorter is coming from ANOTHER ecclesia.
   *
   * The greeting differs, because the same sentence reads wrong both ways. A
   * visiting brother is being welcomed somewhere — "having you join us… at
   * Toronto East" is the point. Telling a brother of the host ecclesia that he
   * will be joining us at his own meeting is odd; he is simply exhorting.
   */
  visiting?: boolean
  /** Fellowship lunch style for this occasion, or undefined for no lunch line. */
  lunchType?: ExhorterHeadsUpLunch
  /**
   * Sunday School times for that week, or undefined when there is no Sunday
   * School — derived from the `sundaySchool` schedule, never assumed. The
   * classes do not run every week (summer break, special occasions), and
   * telling a visiting speaker to arrive for a class that is not on would be
   * worse than saying nothing.
   */
  sundaySchool?: { startDisplay: string; endDisplay: string }
  /**
   * A freeform sentence for this occasion — "That Sunday is also our opening
   * for Sunday School", "we're combining with Toronto West", and so on.
   *
   * The first version of this email hardcoded one ecclesia's particular
   * arrangements into the template, which made it wrong for every other
   * occasion. There is nowhere to author this yet; the Schedule Editor will
   * fill it. Until then it stays empty and renders nothing.
   */
  note?: string
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
  visiting,
  lunchType,
  sundaySchool,
  note,
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
      <Preview>
        {visiting
          ? `We are looking forward to hearing you Exhort at ${hostEcclesiaName} on ${dateDisplay}.`
          : `We are looking forward to hearing you Exhort on ${dateDisplay}.`}
      </Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{hostEcclesiaName}</Heading>
          <Text style={defaultText}>A note about your upcoming exhortation</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{greeting}</Text>
          <Text style={defaultText}>
            {visiting ? (
              <>
                {'We are looking forward to having you join us and hearing you Exhort at '}
                <strong>{hostEcclesiaName}</strong>
                {' on '}
                <strong>{dateDisplay}</strong>
                {'!'}
              </>
            ) : (
              <>
                {'We are looking forward to hearing you Exhort on '}
                <strong>{dateDisplay}</strong>
                {'!'}
              </>
            )}
          </Text>
          {/* Occasion-specific sentence, authored per-Sunday. Empty today. */}
          {note?.trim() ? <Text style={defaultText}>{note.trim()}</Text> : null}
        </Container>

        {/* The order of the day. Sunday School only when it actually runs. */}
        <Container style={container} className="container">
          {sundaySchool ? (
            <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
              {`Our Sunday school (kids and teens classes) is from ${sundaySchool.startDisplay} to ${sundaySchool.endDisplay} followed by coffee and snacks.`}
            </Text>
          ) : null}
          <Text style={{ ...defaultText, margin: '0' }}>
            {'Memorial service is '}
            <strong>{timeDisplay}</strong>
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

        {/* Lunch BEFORE the theme/readings line, matching the email this was
            written from. Only when a lunch is actually on the schedule. */}
        {lunchLine ? (
          <Container style={container} className="container">
            <Text style={defaultText}>{lunchLine}</Text>
          </Container>
        ) : null}

        <Container style={container} className="container">
          <Text style={defaultText}>
            You&apos;ll receive an email shortly asking for a theme, and any readings or hymns you
            would like to have to support your exhortation.
          </Text>
        </Container>

        <Container style={container} className="container">
          <Text style={defaultText}>Looking forward to seeing you again.</Text>
          <Text style={defaultText}>
            If for any reason you&apos;re unable to be with us, please reply to this email to let us
            know as soon as you can.
          </Text>
          {/* The sign-off is verbatim: "Love in Jesus name", then the Recording
              Brother's name on its own. No title line — it is a note from a
              brother, not a memo from an office. */}
          <Text style={{ ...defaultText, margin: '16px 0 0 0' }}>Love in Jesus name</Text>
          <Text style={{ ...defaultText, margin: '0' }}>
            {signatoryName?.trim() || 'The Ecclesial Recorder'}
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
