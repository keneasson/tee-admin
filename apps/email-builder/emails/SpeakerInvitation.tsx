import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'
import React from 'react'
import { container, defaultText, globalCss, header, link, main } from '../styles'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import {
  PREVIEW_IDENTITY,
  SignOff,
  SpeakerEmailFooter,
  buttonLink,
  greetingFor,
  inviteTypeVerbPhrase,
  type SpeakerInviteType,
} from '../components/SpeakerInviteParts'

/**
 * Speaker invitation (docs/SPEAKER_INVITATIONS.md §8.1).
 * "An invitation to {exhort at the Memorial | lead Bible Class | give a Lecture} at {Ecclesia}".
 *
 * Each date button is a LINK to the invite page with that date selected; the
 * page's Confirm button (a POST) does the accepting. Clicking here changes
 * nothing, so link scanners cannot accept. SERVER-SAFE: plain props only.
 */

export interface SpeakerInvitationDateOption {
  /** Pre-formatted, e.g. "Sunday, March 1, 2026 at 11:00am". */
  label: string
  /** `/invite/{inviteId}?token=…&date=YYYY-MM-DD` */
  url: string
}

export interface SpeakerInvitationProps {
  inviteType: SpeakerInviteType
  /** Invitee's full name for "Dear Brother {name}". */
  inviteeName: string
  /** Ecclesia SHORT name, e.g. "Toronto East". */
  ecclesiaName: string
  /** 1–3 offered dates. Anything past 3 is not rendered. */
  dateOptions: SpeakerInvitationDateOption[]
  /** Optional personal note from the inviter. */
  note?: string
  /** "View other open dates" link, when the inviter enabled it. */
  otherDatesUrl?: string
  /** Inviter's full name for the sign-off. */
  inviterName: string
  emailPreferencesUrl: string
  echadHubUrl?: string
  identity?: EmailIdentity
}

export function speakerInvitationSubject(type: SpeakerInviteType, ecclesiaName: string): string {
  return `An invitation to ${inviteTypeVerbPhrase(type)} at ${ecclesiaName}`
}

const SpeakerInvitation = ({
  inviteType,
  inviteeName,
  ecclesiaName,
  dateOptions = [],
  note,
  otherDatesUrl,
  inviterName,
  emailPreferencesUrl,
  echadHubUrl,
  identity,
}: SpeakerInvitationProps) => {
  const options = dateOptions.slice(0, 3)
  const single = options.length === 1
  const phrase = inviteTypeVerbPhrase(inviteType)

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{`Would you be able to ${phrase} at ${ecclesiaName}?`}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{ecclesiaName}</Heading>
          <Text style={defaultText}>{speakerInvitationSubject(inviteType, ecclesiaName)}</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{greetingFor(inviteeName)}</Text>
          <Text style={defaultText}>
            {'We would love to have you '}
            <strong>{phrase}</strong>
            {' at '}
            <strong>{ecclesiaName}</strong>
            {single ? '. Would this date suit you?' : '. Would one of these dates suit you?'}
          </Text>
          {note?.trim() ? <Text style={defaultText}>{note.trim()}</Text> : null}
        </Container>

        <Container style={container} className="container">
          {options.map((option, i) => (
            <Section key={i} style={{ margin: '0 0 12px 0' }}>
              <Link href={option.url} style={buttonLink}>
                {option.label}
              </Link>
            </Section>
          ))}
          <Text style={{ ...defaultText, fontSize: '14px' }}>
            {single
              ? 'The button opens a page where you can confirm the date.'
              : 'Each button opens a page where you can confirm that date.'}
          </Text>
          {otherDatesUrl ? (
            <Text style={defaultText}>
              {'None of these work? '}
              <Link href={otherDatesUrl} style={link}>
                View other open dates
              </Link>
            </Text>
          ) : null}
        </Container>

        <Container style={container} className="container">
          <Text style={defaultText}>
            If you have any questions, or none of the dates suit, please reply to this email.
          </Text>
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

SpeakerInvitation.PreviewProps = {
  inviteType: 'memorial',
  inviteeName: 'Sample Speaker',
  ecclesiaName: 'Example Ecclesia',
  dateOptions: [
    { label: 'Sunday, March 1, 2026 at 11:00am', url: 'https://tee-admin.com/invite/example?date=2026-03-01' },
    { label: 'Sunday, March 8, 2026 at 11:00am', url: 'https://tee-admin.com/invite/example?date=2026-03-08' },
    { label: 'Sunday, March 15, 2026 at 11:00am', url: 'https://tee-admin.com/invite/example?date=2026-03-15' },
  ],
  note: 'It has been too long since we heard from you. We hope one of these works.',
  otherDatesUrl: 'https://tee-admin.com/invite/example?view=open-dates',
  inviterName: 'Recording Brother Example',
  emailPreferencesUrl: 'https://tee-admin.com/email-preferences',
  identity: PREVIEW_IDENTITY,
} satisfies SpeakerInvitationProps

export default SpeakerInvitation
