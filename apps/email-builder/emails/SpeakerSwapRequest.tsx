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
  primaryButtonLink,
  type SpeakerInviteType,
} from '../components/SpeakerInviteParts'

/**
 * Swap request to the other speaker (docs/SPEAKER_INVITATIONS.md §7.3):
 * "{Name} asks to trade {their date} for your {date}".
 *
 * Accept and Decline are LINKS to the swap page (`/invite/swap/{swapId}?token=…`);
 * the page's POST does the action, so a link scanner cannot accept a swap.
 * SERVER-SAFE: plain props only.
 */

export interface SpeakerSwapRequestProps {
  inviteType: SpeakerInviteType
  /** The speaker receiving this request. */
  recipientName: string
  /** From the recipient's recorded gender (§9b). Absent = not recorded. */
  greetingTitle?: SpeakerTitle
  /** The speaker asking, already redacted for the recipient's tier. */
  requesterName: string
  ecclesiaName: string
  /** The requester's current date — what the recipient would take. */
  requesterDateDisplay: string
  /** The recipient's current date — what the requester wants. */
  recipientDateDisplay: string
  /** Optional note from the requester. */
  note?: string
  acceptUrl: string
  declineUrl: string
  /** e.g. "Saturday, February 28, 2026". The request lapses after this. */
  expiresDisplay?: string
  emailPreferencesUrl: string
  echadHubUrl?: string
  identity?: EmailIdentity
}

export function speakerSwapRequestSubject(requesterName: string, inviteType: SpeakerInviteType): string {
  return `${requesterName} asks to trade ${inviteTypeNoun(inviteType)} dates with you`
}

const SpeakerSwapRequest = ({
  inviteType,
  recipientName,
  greetingTitle,
  requesterName,
  ecclesiaName,
  requesterDateDisplay,
  recipientDateDisplay,
  note,
  acceptUrl,
  declineUrl,
  expiresDisplay,
  emailPreferencesUrl,
  echadHubUrl,
  identity,
}: SpeakerSwapRequestProps) => {
  const headline = `${requesterName} asks to trade ${requesterDateDisplay} for your ${recipientDateDisplay}`
  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{headline}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{ecclesiaName}</Heading>
          <Text style={defaultText}>{`A request to trade ${inviteTypeNoun(inviteType)} dates`}</Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <Text style={defaultText}>{greetingFor(recipientName, greetingTitle)}</Text>
          <Text style={defaultText}>
            <strong>{requesterName}</strong>
            {' asks to trade '}
            <strong>{requesterDateDisplay}</strong>
            {' for your '}
            <strong>{recipientDateDisplay}</strong>
            {` (${inviteTypeNoun(inviteType)} at ${ecclesiaName}).`}
          </Text>
          {note?.trim() ? (
            <Text style={{ ...defaultText, fontStyle: 'italic' }}>{`"${note.trim()}"`}</Text>
          ) : null}
          <Text style={defaultText}>
            {`If you accept, you will speak on ${requesterDateDisplay} instead, and you will both get updated confirmations. If you decline, nothing changes.`}
          </Text>
        </Container>

        <Container style={container} className="container">
          <Section style={{ margin: '0 0 12px 0' }}>
            <Link href={acceptUrl} style={primaryButtonLink}>
              Accept the trade
            </Link>
          </Section>
          <Section style={{ margin: '0 0 12px 0' }}>
            <Link href={declineUrl} style={buttonLink}>
              Decline
            </Link>
          </Section>
          <Text style={{ ...defaultText, fontSize: '14px' }}>
            {expiresDisplay
              ? `Each button opens a page where you can confirm. This request lapses after ${expiresDisplay}.`
              : 'Each button opens a page where you can confirm.'}
          </Text>
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

SpeakerSwapRequest.PreviewProps = {
  inviteType: 'memorial',
  recipientName: 'Sample Speaker',
  greetingTitle: 'Brother',
  requesterName: 'Other Speaker',
  ecclesiaName: 'Example Ecclesia',
  requesterDateDisplay: 'Sunday, March 1, 2026',
  recipientDateDisplay: 'Sunday, March 8, 2026',
  note: 'A family commitment came up on the 1st. Would the 8th work for you?',
  acceptUrl: 'https://tee-admin.com/invite/swap/example?action=accept',
  declineUrl: 'https://tee-admin.com/invite/swap/example?action=decline',
  expiresDisplay: 'Saturday, February 28, 2026',
  emailPreferencesUrl: 'https://tee-admin.com/email-preferences',
  identity: PREVIEW_IDENTITY,
} satisfies SpeakerSwapRequestProps

export default SpeakerSwapRequest
