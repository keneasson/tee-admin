import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components'
import React from 'react'
import { container, defaultText, globalCss, header, main } from '../styles'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import {
  PREVIEW_IDENTITY,
  SpeakerEmailFooter,
  buttonLink,
  greetingFor,
  type SpeakerTitle,
  inviteTypeNoun,
  type SpeakerInviteType,
} from '../components/SpeakerInviteParts'

/**
 * Tells the speaker who asked for a swap that it did not happen
 * (docs/SPEAKER_INVITATIONS.md §7.5): the other speaker declined, or the
 * request expired. Nothing changed; their own booking stands.
 * SERVER-SAFE: plain props only.
 */

export type SpeakerSwapOutcomeKind = 'declined' | 'expired'

export interface SpeakerSwapOutcomeProps {
  outcome: SpeakerSwapOutcomeKind
  inviteType: SpeakerInviteType
  /** The speaker who asked (the recipient of this email). */
  requesterName: string
  /** From the requester's recorded gender (§9b). Absent = not recorded. */
  greetingTitle?: SpeakerTitle
  /** The other speaker, already redacted for the recipient's tier. */
  otherSpeakerName: string
  ecclesiaName: string
  /** The requester's own date — unchanged. */
  requesterDateDisplay: string
  /** The date they asked for. */
  requestedDateDisplay: string
  /** Manage page for the requester's own booking. */
  manageUrl?: string
  emailPreferencesUrl: string
  echadHubUrl?: string
  identity?: EmailIdentity
}

export function speakerSwapOutcomeSubject(outcome: SpeakerSwapOutcomeKind, inviteType: SpeakerInviteType): string {
  const noun = inviteTypeNoun(inviteType)
  return outcome === 'declined'
    ? `Your ${noun} swap request was declined`
    : `Your ${noun} swap request expired`
}

const SpeakerSwapOutcome = ({
  outcome,
  inviteType,
  requesterName,
  greetingTitle,
  otherSpeakerName,
  ecclesiaName,
  requesterDateDisplay,
  requestedDateDisplay,
  manageUrl,
  emailPreferencesUrl,
  echadHubUrl,
  identity,
}: SpeakerSwapOutcomeProps) => {
  const subject = speakerSwapOutcomeSubject(outcome, inviteType)
  const lead =
    outcome === 'declined'
      ? `${otherSpeakerName} is not able to trade ${requestedDateDisplay} with you.`
      : `${otherSpeakerName} did not answer your request to trade for ${requestedDateDisplay} in time, so it has lapsed.`
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{ecclesiaName}</Heading>
          <Text style={defaultText}>{`Your ${inviteTypeNoun(inviteType)} swap request`}</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{greetingFor(requesterName, greetingTitle)}</Text>
          <Text style={defaultText}>{lead}</Text>
          <Text style={defaultText}>
            {'Nothing has changed: you are still booked for '}
            <strong>{requesterDateDisplay}</strong>
            {'.'}
          </Text>
          {manageUrl ? (
            <Section style={{ margin: '0 0 12px 0' }}>
              <Link href={manageUrl} style={buttonLink}>
                Manage your appointment
              </Link>
            </Section>
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

SpeakerSwapOutcome.PreviewProps = {
  outcome: 'declined',
  inviteType: 'memorial',
  requesterName: 'Sample Speaker',
  greetingTitle: 'Brother',
  otherSpeakerName: 'Other',
  ecclesiaName: 'Example Ecclesia',
  requesterDateDisplay: 'Sunday, March 1, 2026 at 11:00am',
  requestedDateDisplay: 'Sunday, March 8, 2026 at 11:00am',
  manageUrl: 'https://tee-admin.com/invite/example',
  emailPreferencesUrl: 'https://tee-admin.com/email-preferences',
  identity: PREVIEW_IDENTITY,
} satisfies SpeakerSwapOutcomeProps

export default SpeakerSwapOutcome
