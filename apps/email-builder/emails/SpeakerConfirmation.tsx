import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'
import React from 'react'
import { container, defaultText, globalCss, header, link, main } from '../styles'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import {
  OnlineMeetingBlock,
  PREVIEW_IDENTITY,
  SignOff,
  SpeakerEmailFooter,
  greetingFor,
  inviteTypeNoun,
  primaryButtonLink,
  type SpeakerInviteType,
  type SpeakerOnlineMeeting,
} from '../components/SpeakerInviteParts'

/**
 * Speaker confirmation (docs/SPEAKER_INVITATIONS.md §8.2). Sent on accept
 * (`confirmed`), on a date change or accepted swap (`changed`), and on cancel
 * (`cancelled`, whose .ics link is the METHOD:CANCEL file with the same UID).
 * The calendar URLs are built server-side and passed in. SERVER-SAFE.
 */

export type SpeakerConfirmationVariant = 'confirmed' | 'changed' | 'cancelled'

/**
 * §7.6: a swap accepted within 24 hours of either appointment. The counterpart
 * comes from the swapped role (Exhort → Presiding, Preside → Exhorting,
 * Bible Class Speaker → Host). The name is already redacted for the reader's tier.
 */
export interface SpeakerShortNotice {
  counterpartRole: 'Presiding' | 'Exhorting' | 'Host'
  counterpartName?: string
}

export interface SpeakerConfirmationProps {
  variant: SpeakerConfirmationVariant
  inviteType: SpeakerInviteType
  /** Speaker's full name for "Dear Brother {name}". */
  speakerName: string
  /** Ecclesia SHORT name. */
  ecclesiaName: string
  /** e.g. "Sunday, March 1, 2026". */
  dateDisplay: string
  /** e.g. "11:00am". */
  timeDisplay: string
  /** e.g. "Eastern Time (Toronto)". */
  timezoneDisplay: string
  /** e.g. "Example Christadelphian Hall". */
  hallName?: string
  /** Full street address. */
  address?: string
  /** For `changed`: the date it moved from, e.g. "Sunday, March 8, 2026". */
  previousDateDisplay?: string
  onlineMeetings?: SpeakerOnlineMeeting[]
  /** Omit for `cancelled`. */
  googleCalendarUrl?: string
  /** Hosted .ics (PUBLISH, or CANCEL for `cancelled`). */
  icsUrl?: string
  /** "If for any reason you need to change your appointment, click here". */
  manageUrl?: string
  shortNotice?: SpeakerShortNotice
  /** Inviter's full name for the sign-off. */
  inviterName?: string
  emailPreferencesUrl: string
  echadHubUrl?: string
  identity?: EmailIdentity
}

export function speakerConfirmationSubject(
  variant: SpeakerConfirmationVariant,
  inviteType: SpeakerInviteType,
  ecclesiaName: string,
  dateDisplay: string
): string {
  const what = `${inviteTypeNoun(inviteType)} at ${ecclesiaName} on ${dateDisplay}`
  switch (variant) {
    case 'confirmed':
      return `Confirmed: ${what}`
    case 'changed':
      return `Updated: ${what}`
    case 'cancelled':
      return `Cancelled: ${what}`
  }
}

/** "Please inform the Presiding brother (Name) of this change". */
export function shortNoticeSentence(notice: SpeakerShortNotice): string {
  const name = notice.counterpartName?.trim()
  const who = notice.counterpartRole === 'Host' ? 'the host' : `the ${notice.counterpartRole} brother`
  return `Please inform ${who}${name ? ` (${name})` : ''} of this change`
}

const callout = {
  border: '2px solid #bc6401',
  backgroundColor: '#fff6e8',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '0 0 16px 0',
}

const SpeakerConfirmation = ({
  variant,
  inviteType,
  speakerName,
  ecclesiaName,
  dateDisplay,
  timeDisplay,
  timezoneDisplay,
  hallName,
  address,
  previousDateDisplay,
  onlineMeetings = [],
  googleCalendarUrl,
  icsUrl,
  manageUrl,
  shortNotice,
  inviterName,
  emailPreferencesUrl,
  echadHubUrl,
  identity,
}: SpeakerConfirmationProps) => {
  const cancelled = variant === 'cancelled'
  const noun = inviteTypeNoun(inviteType)
  const subject = speakerConfirmationSubject(variant, inviteType, ecclesiaName, dateDisplay)
  const location = [hallName, address].filter((s) => Boolean(s?.trim()))

  let lead: React.ReactNode
  if (variant === 'confirmed') {
    lead = (
      <>
        {'Thank you! Your '}
        <strong>{noun}</strong>
        {' at '}
        <strong>{ecclesiaName}</strong>
        {' is confirmed.'}
      </>
    )
  } else if (variant === 'changed') {
    lead = (
      <>
        {'Your '}
        <strong>{noun}</strong>
        {' at '}
        <strong>{ecclesiaName}</strong>
        {previousDateDisplay ? ` has moved from ${previousDateDisplay}. Here are the new details.` : ' has changed. Here are the new details.'}
      </>
    )
  } else {
    lead = (
      <>
        {'Your '}
        <strong>{noun}</strong>
        {' at '}
        <strong>{ecclesiaName}</strong>
        {' on '}
        <strong>{dateDisplay}</strong>
        {' has been cancelled.'}
      </>
    )
  }

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{ecclesiaName}</Heading>
          <Text style={defaultText}>{subject}</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{greetingFor(speakerName)}</Text>
          <Text style={defaultText}>{lead}</Text>
          {shortNotice ? (
            <Section style={callout}>
              <Text style={{ ...defaultText, fontWeight: 'bold', margin: '0' }}>
                {shortNoticeSentence(shortNotice)}
              </Text>
            </Section>
          ) : null}
        </Container>

        {cancelled ? null : (
          <Container style={container} className="container">
            <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
              <strong>Date:</strong> {dateDisplay}
            </Text>
            <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
              <strong>Time:</strong> {`${timeDisplay} ${timezoneDisplay}`}
            </Text>
            {location.length > 0 ? (
              <Text style={{ ...defaultText, margin: '0 0 4px 0' }}>
                <strong>Where:</strong> {location.join(', ')}
              </Text>
            ) : null}
          </Container>
        )}

        {!cancelled && onlineMeetings.length > 0 ? (
          <Container style={container} className="container">
            <Text style={defaultText}>If you can&apos;t be with us in person, you can join online:</Text>
            {onlineMeetings.map((option, i) => (
              <OnlineMeetingBlock key={i} option={option} />
            ))}
          </Container>
        ) : null}

        <Container style={container} className="container">
          {!cancelled && googleCalendarUrl ? (
            <Section style={{ margin: '8px 0 12px 0' }}>
              <Link href={googleCalendarUrl} style={primaryButtonLink}>
                Add to Google Calendar
              </Link>
            </Section>
          ) : null}
          {icsUrl ? (
            <Text style={defaultText}>
              <Link href={icsUrl} style={link}>
                {cancelled ? 'Download the cancellation (.ics) to remove it from your calendar' : 'Download calendar file (.ics)'}
              </Link>
              {cancelled ? null : ' for Apple Calendar or Outlook'}
            </Text>
          ) : null}
          {!cancelled && manageUrl ? (
            <Text style={defaultText}>
              {'If for any reason you need to change your appointment, '}
              <Link href={manageUrl} style={link}>
                click here
              </Link>
            </Text>
          ) : null}
          <SignOff name={inviterName} />
        </Container>

        <SpeakerEmailFooter
          emailPreferencesUrl={emailPreferencesUrl}
          echadHubUrl={echadHubUrl}
          identity={identity}
        />
      </Body>
    </Html>
  )
}

const PREVIEW_BASE = {
  variant: 'confirmed',
  inviteType: 'memorial',
  speakerName: 'Sample Speaker',
  ecclesiaName: 'Example Ecclesia',
  dateDisplay: 'Sunday, March 1, 2026',
  timeDisplay: '11:00am',
  timezoneDisplay: 'Eastern Time (Toronto)',
  hallName: 'Example Christadelphian Hall',
  address: '123 Example Street, Example City, ON A1A 1A1, Canada',
  onlineMeetings: [{ label: 'Example Zoom', url: 'https://zoom.example.com/j/000', meetingId: '000 000 000' }],
  googleCalendarUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Example',
  icsUrl: 'https://tee-admin.com/api/speaker-invites/example/ics',
  manageUrl: 'https://tee-admin.com/invite/example',
  inviterName: 'Recording Brother Example',
  emailPreferencesUrl: 'https://tee-admin.com/email-preferences',
  identity: PREVIEW_IDENTITY,
} satisfies SpeakerConfirmationProps

SpeakerConfirmation.PreviewProps = PREVIEW_BASE

/** Extra preview states (the react-email preview shows `PreviewProps` only). */
export const SpeakerConfirmationPreviewVariants = {
  confirmed: PREVIEW_BASE,
  changedShortNotice: {
    ...PREVIEW_BASE,
    variant: 'changed',
    previousDateDisplay: 'Sunday, March 8, 2026',
    shortNotice: { counterpartRole: 'Presiding', counterpartName: 'Presiding Example' },
  },
  cancelled: { ...PREVIEW_BASE, variant: 'cancelled', googleCalendarUrl: undefined },
} satisfies Record<string, SpeakerConfirmationProps>

export default SpeakerConfirmation
