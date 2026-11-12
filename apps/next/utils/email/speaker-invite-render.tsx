import React from 'react'
import { render } from '@react-email/render'
import SpeakerInvitation, {
  speakerInvitationSubject,
  type SpeakerInvitationProps,
} from 'email-builder/emails/SpeakerInvitation'
import SpeakerConfirmation, {
  speakerConfirmationSubject,
  type SpeakerConfirmationProps,
} from 'email-builder/emails/SpeakerConfirmation'
import SpeakerSwapRequest, {
  speakerSwapRequestSubject,
  type SpeakerSwapRequestProps,
} from 'email-builder/emails/SpeakerSwapRequest'
import SpeakerSwapOutcome, {
  speakerSwapOutcomeSubject,
  type SpeakerSwapOutcomeProps,
} from 'email-builder/emails/SpeakerSwapOutcome'
import SpeakerInviterNotice, {
  speakerInviterNoticeSubject,
  type SpeakerInviterNoticeProps,
} from 'email-builder/emails/SpeakerInviterNotice'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import { resolveTenantFromEnv, type TenantConfig } from '@my/app/config/tenants'
import { emailIdentityFromProfile } from '@my/app/types/brand-profile'
import { resolveBrandProfile } from './resolve-brand-profile'

/**
 * Server-safe renders for the four Speaker Invitation emails
 * (docs/SPEAKER_INVITATIONS.md §8). Mirrors exhorter-heads-up-render.tsx: the
 * tenant brand identity is injected as a PROP (never the client
 * EmailIdentityProvider), so these run from App Router server routes. Each
 * returns `{ html, text, subject }`. Sending is NOT done here.
 */

export type { SpeakerInviteType, SpeakerOnlineMeeting } from 'email-builder/components/SpeakerInviteParts'
export type {
  SpeakerInvitationDateOption,
} from 'email-builder/emails/SpeakerInvitation'
export type {
  SpeakerConfirmationVariant,
  SpeakerShortNotice,
} from 'email-builder/emails/SpeakerConfirmation'
export type { SpeakerInviterNoticeKind } from 'email-builder/emails/SpeakerInviterNotice'
export type { SpeakerSwapOutcomeKind } from 'email-builder/emails/SpeakerSwapOutcome'

export interface RenderedSpeakerEmail {
  html: string
  text: string
  subject: string
}

/** Brand props are resolved here from the tenant; callers pass content only. */
type WithTenant<P> = Omit<P, 'identity' | 'echadHubUrl'> & { tenant?: TenantConfig }

export type RenderSpeakerInvitationInput = WithTenant<SpeakerInvitationProps>
export type RenderSpeakerConfirmationInput = WithTenant<SpeakerConfirmationProps>
export type RenderSpeakerSwapRequestInput = WithTenant<SpeakerSwapRequestProps>
export type RenderSpeakerInviterNoticeInput = WithTenant<SpeakerInviterNoticeProps>
export type RenderSpeakerSwapOutcomeInput = WithTenant<SpeakerSwapOutcomeProps>

async function identityFor(tenant?: TenantConfig): Promise<EmailIdentity> {
  const t = tenant ?? resolveTenantFromEnv()
  return {
    ...emailIdentityFromProfile(await resolveBrandProfile({ tenant: t })),
    homeUrl: `https://${t.senderDomain}`,
    homeLabel: t.publicName,
  }
}

async function renderBoth(element: React.ReactElement, subject: string): Promise<RenderedSpeakerEmail> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })])
  return { html, text, subject }
}

export async function renderSpeakerInvitation(
  input: RenderSpeakerInvitationInput
): Promise<RenderedSpeakerEmail> {
  const { tenant, ...props } = input
  const identity = await identityFor(tenant)
  return renderBoth(
    <SpeakerInvitation {...props} identity={identity} />,
    speakerInvitationSubject(props.inviteType, props.ecclesiaName)
  )
}

export async function renderSpeakerConfirmation(
  input: RenderSpeakerConfirmationInput
): Promise<RenderedSpeakerEmail> {
  const { tenant, ...props } = input
  const identity = await identityFor(tenant)
  return renderBoth(
    <SpeakerConfirmation {...props} identity={identity} />,
    speakerConfirmationSubject(props.variant, props.inviteType, props.ecclesiaName, props.dateDisplay)
  )
}

export async function renderSpeakerSwapRequest(
  input: RenderSpeakerSwapRequestInput
): Promise<RenderedSpeakerEmail> {
  const { tenant, ...props } = input
  const identity = await identityFor(tenant)
  return renderBoth(
    <SpeakerSwapRequest {...props} identity={identity} />,
    speakerSwapRequestSubject(props.requesterName, props.inviteType)
  )
}

export async function renderSpeakerInviterNotice(
  input: RenderSpeakerInviterNoticeInput
): Promise<RenderedSpeakerEmail> {
  const { tenant, ...props } = input
  const identity = await identityFor(tenant)
  return renderBoth(
    <SpeakerInviterNotice {...props} identity={identity} />,
    speakerInviterNoticeSubject(props.kind, props.speakerName, props.inviteType, props.dateDisplay)
  )
}

export async function renderSpeakerSwapOutcome(
  input: RenderSpeakerSwapOutcomeInput
): Promise<RenderedSpeakerEmail> {
  const { tenant, ...props } = input
  const identity = await identityFor(tenant)
  return renderBoth(
    <SpeakerSwapOutcome {...props} identity={identity} />,
    speakerSwapOutcomeSubject(props.outcome, props.inviteType)
  )
}
