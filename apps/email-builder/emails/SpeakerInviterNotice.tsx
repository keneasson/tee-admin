import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'
import React from 'react'
import { container, defaultText, globalCss, header, link, main } from '../styles'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import {
  PREVIEW_IDENTITY,
  SpeakerEmailFooter,
  inviteTypeNoun,
  type SpeakerInviteType,
} from '../components/SpeakerInviteParts'

/**
 * Notice to the inviter (docs/SPEAKER_INVITATIONS.md §8.4): the speaker
 * accepted, changed date, or cancelled. Swaps send no notice (§7). The Google
 * Sheet is never written, so the notice reminds the RB to update it if they
 * keep one. SERVER-SAFE: plain props only.
 */

export type SpeakerInviterNoticeKind = 'accepted' | 'changed' | 'cancelled'

export interface SpeakerInviterNoticeProps {
  kind: SpeakerInviterNoticeKind
  inviteType: SpeakerInviteType
  /** Inviter's name for the greeting. */
  inviterName: string
  /** Speaker's full name. */
  speakerName: string
  ecclesiaName: string
  /** The date now booked (accepted/changed) or released (cancelled). */
  dateDisplay: string
  timeDisplay?: string
  /** For `changed`: the date it moved from. */
  previousDateDisplay?: string
  /** Link to the invites list / this invite in admin. */
  adminUrl?: string
  emailPreferencesUrl: string
  echadHubUrl?: string
  identity?: EmailIdentity
}

export function speakerInviterNoticeSubject(
  kind: SpeakerInviterNoticeKind,
  speakerName: string,
  inviteType: SpeakerInviteType,
  dateDisplay: string
): string {
  const noun = inviteTypeNoun(inviteType)
  switch (kind) {
    case 'accepted':
      return `${speakerName} accepted: ${noun} on ${dateDisplay}`
    case 'changed':
      return `${speakerName} changed date: ${noun} now on ${dateDisplay}`
    case 'cancelled':
      return `${speakerName} cancelled: ${noun} on ${dateDisplay}`
  }
}

const SpeakerInviterNotice = ({
  kind,
  inviteType,
  inviterName,
  speakerName,
  ecclesiaName,
  dateDisplay,
  timeDisplay,
  previousDateDisplay,
  adminUrl,
  emailPreferencesUrl,
  echadHubUrl,
  identity,
}: SpeakerInviterNoticeProps) => {
  const subject = speakerInviterNoticeSubject(kind, speakerName, inviteType, dateDisplay)
  const noun = inviteTypeNoun(inviteType)
  const when = timeDisplay ? `${dateDisplay} at ${timeDisplay}` : dateDisplay
  const first = inviterName?.trim()

  let body: string
  if (kind === 'accepted') {
    body = `${speakerName} accepted your invitation and is booked for the ${noun} on ${when}.`
  } else if (kind === 'changed') {
    body = previousDateDisplay
      ? `${speakerName} moved the ${noun} from ${previousDateDisplay} to ${when}.`
      : `${speakerName} moved the ${noun} to ${when}.`
  } else {
    body = `${speakerName} cancelled the ${noun} on ${when}. That date is open again.`
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
          <Text style={defaultText}>Speaker invitation update</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{first ? `Dear ${first},` : 'Hello,'}</Text>
          <Text style={defaultText}>{body}</Text>
          <Text style={defaultText}>
            The website schedule and newsletter already show this. If you keep a Google Sheet for
            the schedule, please update it too.
          </Text>
          {adminUrl ? (
            <Text style={defaultText}>
              <Link href={adminUrl} style={link}>
                View your speaker invitations
              </Link>
            </Text>
          ) : null}
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

SpeakerInviterNotice.PreviewProps = {
  kind: 'changed',
  inviteType: 'bible_class',
  inviterName: 'Recording Brother Example',
  speakerName: 'Sample Speaker',
  ecclesiaName: 'Example Ecclesia',
  dateDisplay: 'Wednesday, March 11, 2026',
  timeDisplay: '7:30pm',
  previousDateDisplay: 'Wednesday, March 4, 2026',
  adminUrl: 'https://tee-admin.com/admin/speaker-invites',
  emailPreferencesUrl: 'https://tee-admin.com/email-preferences',
  identity: PREVIEW_IDENTITY,
} satisfies SpeakerInviterNoticeProps

export default SpeakerInviterNotice
