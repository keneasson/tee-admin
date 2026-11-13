import { Link, Section, Text } from '@react-email/components'
import {
  INVITE_TYPE_LABEL,
  INVITE_TYPE_PHRASE,
  type SpeakerInviteType,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import React from 'react'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { defaultText, footer, footerLink, footerText, link } from '../styles'

/**
 * Pieces shared by the four Speaker Invitation emails
 * (docs/SPEAKER_INVITATIONS.md §8). SERVER-SAFE: everything is a plain prop,
 * no context and no `'use client'` import, so these render from an App Router
 * server route. The footer is the same email-scoped 1:1 footer as
 * ExhorterHeadsUp: these sends do no `{{emailPreferencesUrl}}` substitution, so
 * a REAL preferences URL comes in as a prop.
 */

/** What the speaker is invited to do. Stored on the invite as data (§3). */
export type { SpeakerInviteType }

/** "An invitation to {phrase} at {Ecclesia}". Labels are declared once in speaker-invite-types. */
export function inviteTypeVerbPhrase(type: SpeakerInviteType): string {
  return INVITE_TYPE_PHRASE[type]
}

/** The appointment as a noun: "Memorial exhortation", "Bible Class", "Lecture". */
export function inviteTypeNoun(type: SpeakerInviteType): string {
  return INVITE_TYPE_LABEL[type]
}

/** One way to attend online (same shape as the heads-up's attend options). */
export interface SpeakerOnlineMeeting {
  label: string
  url?: string
  meetingId?: string
  password?: string
  dialInNumber?: string
}

const ECHAD_HUB_URL = 'https://echadhub.org'

/** A link drawn as a button. A plain anchor, so every client renders it. */
export const buttonLink = {
  ...link,
  display: 'inline-block',
  padding: '12px 20px',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
}

/** The primary call to action: filled. */
export const primaryButtonLink = {
  ...buttonLink,
  color: '#ffffff',
  backgroundColor: '#003da9',
}

/** A title the reader's record carries (§9b). Absent = not recorded. */
export type SpeakerTitle = 'Brother' | 'Sister'

/**
 * The greeting (§9b): "Dear Brother {Surname}," / "Dear Sister {Surname},"
 * when the reader's gender is recorded, else "Dear {first name},". Never guessed.
 */
export function greetingFor(name?: string, title?: SpeakerTitle): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  const last = parts.length > 1 ? parts[parts.length - 1] : undefined
  if (title && last) return `Dear ${title} ${last},`
  if (parts[0]) return `Dear ${parts[0]},`
  return title ? `Dear ${title},` : 'Hello,'
}

/** "Love in Jesus name", then the name on its own line. Verbatim from the heads-up. */
export const SignOff = ({ name }: { name?: string }) => (
  <>
    <Text style={{ ...defaultText, margin: '16px 0 0 0' }}>Love in Jesus name</Text>
    <Text style={{ ...defaultText, margin: '0' }}>{name?.trim() || 'The Ecclesial Recorder'}</Text>
  </>
)

export const OnlineMeetingBlock = ({ option }: { option: SpeakerOnlineMeeting }) => (
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

function productNameFromHomeUrl(homeUrl?: string): string {
  const host = (homeUrl ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase()
  if (host.startsWith('echadhub')) return 'Echad Hub'
  return 'TEE-Admin'
}

function mapsUrlFor(line: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(line)}`
}

export interface SpeakerEmailFooterProps {
  emailPreferencesUrl: string
  echadHubUrl?: string
  identity?: EmailIdentity
}

/** Spacer + the email-scoped 1:1 footer, as in ExhorterHeadsUp. */
export const SpeakerEmailFooter = ({
  emailPreferencesUrl,
  echadHubUrl = ECHAD_HUB_URL,
  identity,
}: SpeakerEmailFooterProps) => (
  <>
    <Section style={{ height: '24px', lineHeight: '24px', fontSize: '1px' }}>&nbsp;</Section>
    <Section style={footer}>
      <Text style={footerText}>
        <Link href={identity?.homeUrl ?? 'https://tee-admin.com'} style={footerLink}>
          {productNameFromHomeUrl(identity?.homeUrl)}
        </Link>
        {' — powered by '}
        <Link href={echadHubUrl} style={footerLink}>
          Echad Hub
        </Link>
        {', a Christadelphian Initiative'}
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
          {/* Explicit links stop Gmail half-linkifying the address in its own colour. */}
          {(identity.addressLines ?? []).map((lineText, i) => (
            <React.Fragment key={i}>
              <br />
              <Link href={mapsUrlFor(lineText)} style={footerLink}>
                {lineText}
              </Link>
            </React.Fragment>
          ))}
        </Text>
      ) : null}
    </Section>
  </>
)

/** Placeholder brand identity for PreviewProps only. */
export const PREVIEW_IDENTITY: EmailIdentity = {
  name: 'Example Ecclesia',
  addressLines: ['123 Example Street', 'Example City, ON A1A 1A1', 'Canada'],
  homeUrl: 'https://tee-admin.com',
  homeLabel: 'Example Ecclesia',
}
