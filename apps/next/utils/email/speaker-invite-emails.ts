import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { speakerInviteRepository } from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import { sendRecipientRepository } from '@my/app/provider/dynamodb/repositories/send-recipient-repository'
import type { TenantConfig } from '@my/app/config/tenants'
import {
  INVITE_TYPE_SLOT,
  type ShortNotice,
  type SpeakerInviteRecord,
  type SpeakerInviteType,
  type SpeakerSwapRecord,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { sendEmail } from './sesClient'
import { generateEcclesiaToken, generateEmailPreferencesUrl } from './ecclesia-token'
import { EMAIL_TRACKING_CONFIG_SET } from './exhorter-heads-up'
import {
  renderSpeakerConfirmation,
  renderSpeakerInvitation,
  renderSpeakerInviterNotice,
  renderSpeakerSwapOutcome,
  renderSpeakerSwapRequest,
  type RenderedSpeakerEmail,
} from './speaker-invite-render'
import {
  appointmentPlace,
  baseUrlFor,
  dateDisplay,
  googleCalendarUrlFor,
  icsSequence,
  onlineMeetingsFor,
  tenantForEcclesia,
  timeDisplay,
  timezoneDisplay,
  whenDisplay,
} from '../speaker-invites/appointment'
import { loadSlotDetails, type SlotDetail } from '../speaker-invites/slots'

/**
 * Email seam for speaker invitations (spec §8). The service calls these AFTER
 * its database writes commit; a failure here never rolls a booking back — the
 * service logs it and records `email_failed` in the invite's history.
 *
 * Sending follows the exhorter heads-up pattern:
 *   - an idempotency claim (`SPEAKER_EMAIL#{inviteId}#{event}#{sequence}`)
 *     taken BEFORE the send and released if the send fails;
 *   - SES configuration set `tee-email-tracking` + a `Campaign` tag, so the
 *     bounce/open webhook attributes events back to this invite;
 *   - one recipient row via `sendRecipientRepository.snapshotRoster`.
 * From = the brand's canonical `communications@` sender (one per brand).
 * Reply-To = the inviter, so replies reach whoever is coordinating.
 */

/** The appointment an email is about. Lecture bookings live on the invite only. */
export interface SpeakerBookingDetails {
  ecclesia: string
  type: SpeakerInviteType
  date: string // YYYY-MM-DD
  time: string // HH:mm local ('' if the schedule has no time)
  tz: string // IANA
  personId: string
  inviteId?: string
}

export interface ConfirmationOptions {
  /** This booking's date's entry, when a swap was accepted within 24h (§7.6). */
  shortNotice?: ShortNotice
  /** Why the confirmation is (re)sent. */
  reason?: 'accepted' | 'changed' | 'swapped'
  /** The date it moved from (change). */
  previousDate?: string
  /** The swap that produced this booking (keys the claim when there is no invite). */
  swapId?: string
}

export type InviterNoticeEvent = 'accepted' | 'changed' | 'cancelled'

export interface InviterNoticeOptions {
  previousDate?: string
  /** The Sheet still lists the speaker on `date`: ask the RB to remove it. */
  sheetReminder?: { name: string; date: string }
  /** The speaker's own reason, given when they cancelled. */
  reason?: string
}

export type SwapOutcome = 'declined' | 'expired'

const SENDER_LOCAL_PART = 'communications'
const REASON_TAG = 'speaker-invite'

export const speakerInviteCampaignId = (inviteId: string) => `speaker-invite-${inviteId}`
export const speakerSwapCampaignId = (swapId: string) => `speaker-swap-${swapId}`

function fromFor(tenant: TenantConfig): string {
  return `"${tenant.senderDisplayName}" <${SENDER_LOCAL_PART}@${tenant.senderDomain}>`
}

function fullName(p: Pick<PersonRecord, 'firstName' | 'lastName' | 'displayName'> | null | undefined): string {
  if (!p) return ''
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.displayName || ''
}

async function person(personId: string): Promise<PersonRecord | null> {
  return personRepository.getById(personId).catch(() => null)
}

interface Delivery {
  /** null = no claim (test sends). */
  claimKey: string | null
  event: string
  to: string
  rendered: RenderedSpeakerEmail
  tenant: TenantConfig
  replyTo?: string | null
  campaignId: string
  ecclesia?: string
}

/** Claim → send → snapshot; release the claim if the send fails. False = already sent. */
async function deliver(d: Delivery): Promise<boolean> {
  if (d.claimKey) {
    const claimed = await speakerInviteRepository.claimEmail(d.claimKey, { sentTo: d.to, event: d.event })
    if (!claimed) return false
  }
  try {
    await sendEmail({
      to: d.to,
      subject: d.rendered.subject,
      body: d.rendered.html,
      textBody: d.rendered.text,
      tenant: d.tenant,
      from: fromFor(d.tenant),
      ...(d.replyTo ? { replyTo: d.replyTo } : {}),
      configurationSetName: EMAIL_TRACKING_CONFIG_SET,
      emailTags: [
        { Name: 'Reason', Value: REASON_TAG },
        // Must be named `Campaign`: the SES webhook reads `mail.tags.Campaign`.
        { Name: 'Campaign', Value: d.campaignId },
      ],
    })
  } catch (err) {
    if (d.claimKey) await speakerInviteRepository.releaseEmail(d.claimKey)
    throw err
  }
  try {
    await sendRecipientRepository.snapshotRoster(d.campaignId, [
      { email: d.to, status: 'sent', ...(d.ecclesia ? { ecclesia: d.ecclesia } : {}) },
    ])
  } catch (err) {
    console.error('[speaker-invites] could not record the recipient row:', err)
  }
  return true
}

/** Link builder for one recipient's token. */
function linker(base: string, token: string) {
  const t = encodeURIComponent(token)
  return {
    invite: (inviteId: string, suffix = '') => `${base}/invite/${inviteId}?token=${t}${suffix}`,
    swap: (swapId: string, suffix = '') => `${base}/invite/swap/${swapId}?token=${t}${suffix}`,
    ics: (inviteId: string) => `${base}/api/invite/${inviteId}/ics?token=${t}`,
  }
}

async function slotFor(b: Pick<SpeakerBookingDetails, 'ecclesia' | 'type' | 'date'>): Promise<SlotDetail | undefined> {
  if (!INVITE_TYPE_SLOT[b.type]) return undefined
  try {
    const { slots } = await loadSlotDetails(b.ecclesia, b.type, b.date, b.date)
    return slots.find((s) => s.date === b.date)
  } catch (err) {
    console.error('[speaker-invites] could not load the slot for the email:', err)
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Invitation
// ---------------------------------------------------------------------------

export interface InvitationOptions {
  /**
   * TEST send: render and send ONLY to this address (the signed-in inviter),
   * subject prefixed "[TEST]", no claim. The links carry a token for this
   * address, never the invitee's, so a test copy can't act as the invitee.
   */
  testTo?: string
  /** Display name for an invitee who is not (yet) a PersonRecord (test sends). */
  inviteeName?: string
}

export async function sendInvitationEmail(invite: SpeakerInviteRecord, options: InvitationOptions = {}): Promise<void> {
  const tenant = tenantForEcclesia(invite.ecclesia)
  const base = baseUrlFor(tenant)
  const test = !!options.testTo
  const to = options.testTo ?? invite.inviteeEmail
  const [invitee, inviter, place] = await Promise.all([
    invite.inviteePersonId ? person(invite.inviteePersonId) : Promise.resolve(null),
    person(invite.inviterPersonId),
    appointmentPlace(invite.ecclesia),
  ])

  const token = await generateEcclesiaToken(to)
  const links = linker(base, token)
  const rendered = await renderSpeakerInvitation({
    inviteType: invite.type,
    inviteeName: options.inviteeName || fullName(invitee) || invite.inviteeEmail,
    ecclesiaName: place.ecclesiaName,
    dateOptions: invite.offeredDates.map((d) => ({
      label: whenDisplay(d),
      url: links.invite(invite.inviteId, `&date=${d.date}`),
    })),
    ...(invite.note ? { note: invite.note } : {}),
    ...(invite.otherDatesWindow ? { otherDatesUrl: links.invite(invite.inviteId, '#other-dates') } : {}),
    inviterName: fullName(inviter),
    emailPreferencesUrl: await generateEmailPreferencesUrl(to, base),
    tenant,
  })

  await deliver({
    claimKey: test ? null : `${invite.inviteId}#invitation#${icsSequence(invite)}`,
    event: test ? 'invitation-test' : 'invitation',
    to,
    rendered: test ? { ...rendered, subject: `[TEST] ${rendered.subject}` } : rendered,
    tenant,
    replyTo: inviter?.primaryEmail,
    campaignId: speakerInviteCampaignId(invite.inviteId),
    ecclesia: invite.ecclesia,
  })
}

// ---------------------------------------------------------------------------
// Confirmation / cancellation (the same template, different variant)
// ---------------------------------------------------------------------------

async function sendAppointmentEmail(
  variant: 'confirmed' | 'changed' | 'cancelled',
  invite: SpeakerInviteRecord | null,
  booking: SpeakerBookingDetails,
  options: ConfirmationOptions
): Promise<void> {
  const tenant = tenantForEcclesia(booking.ecclesia)
  const base = baseUrlFor(tenant)
  const [speaker, inviter, place, slot] = await Promise.all([
    person(booking.personId),
    invite ? person(invite.inviterPersonId) : Promise.resolve(null),
    appointmentPlace(booking.ecclesia),
    variant === 'cancelled' ? Promise.resolve(undefined) : slotFor(booking),
  ])
  const to = speaker?.primaryEmail || (invite?.inviteePersonId === booking.personId ? invite.inviteeEmail : '')
  if (!to) throw new Error(`speaker ${booking.personId} has no email`)

  const token = await generateEcclesiaToken(to)
  const links = linker(base, token)
  const when = { type: booking.type, date: booking.date, time: booking.time, tz: booking.tz }
  const inviteId = invite?.inviteId

  const rendered = await renderSpeakerConfirmation({
    variant,
    inviteType: booking.type,
    speakerName: fullName(speaker),
    ecclesiaName: place.ecclesiaName,
    dateDisplay: dateDisplay(booking.date),
    timeDisplay: timeDisplay(booking.time),
    timezoneDisplay: timezoneDisplay(booking.tz),
    ...(place.hallName ? { hallName: place.hallName } : {}),
    ...(place.address ? { address: place.address } : {}),
    ...(options.previousDate ? { previousDateDisplay: dateDisplay(options.previousDate) } : {}),
    ...(variant !== 'cancelled' ? { onlineMeetings: onlineMeetingsFor(booking.type, booking.ecclesia, slot) } : {}),
    ...(variant !== 'cancelled' ? { googleCalendarUrl: googleCalendarUrlFor(when, place) } : {}),
    ...(inviteId ? { icsUrl: links.ics(inviteId), manageUrl: links.invite(inviteId) } : {}),
    ...(options.shortNotice
      ? {
          shortNotice: {
            counterpartRole: options.shortNotice.counterpartRole,
            ...(options.shortNotice.counterpartName ? { counterpartName: options.shortNotice.counterpartName } : {}),
          },
        }
      : {}),
    ...(inviter ? { inviterName: fullName(inviter) } : {}),
    emailPreferencesUrl: await generateEmailPreferencesUrl(to, base),
    tenant,
  })

  const event = variant === 'cancelled' ? 'cancellation' : 'confirmation'
  const claimKey = invite
    ? `${invite.inviteId}#${event}#${icsSequence(invite)}`
    : `swap#${options.swapId ?? booking.date}#${event}#${booking.personId}`
  await deliver({
    claimKey,
    event,
    to,
    rendered,
    tenant,
    replyTo: inviter?.primaryEmail,
    campaignId: invite ? speakerInviteCampaignId(invite.inviteId) : speakerSwapCampaignId(options.swapId ?? booking.date),
    ecclesia: booking.ecclesia,
  })
}

/**
 * `invite` is null for a speaker whose booking came from the Sheet and who
 * received a date through a swap (no invite of their own): no manage or .ics link.
 */
export async function sendConfirmationEmail(
  invite: SpeakerInviteRecord | null,
  booking: SpeakerBookingDetails,
  options: ConfirmationOptions = {}
): Promise<void> {
  const variant = (options.reason ?? 'accepted') === 'accepted' ? 'confirmed' : 'changed'
  await sendAppointmentEmail(variant, invite, booking, options)
}

/** Its .ics link serves METHOD:CANCEL (same UID) because the invite is cancelled. */
export async function sendCancellationEmail(invite: SpeakerInviteRecord, booking: SpeakerBookingDetails): Promise<void> {
  await sendAppointmentEmail('cancelled', invite, booking, {})
}

// ---------------------------------------------------------------------------
// Swaps
// ---------------------------------------------------------------------------

function instantDisplay(iso: string, tz: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export async function sendSwapRequestEmail(swap: SpeakerSwapRecord): Promise<void> {
  const tenant = tenantForEcclesia(swap.ecclesia)
  const base = baseUrlFor(tenant)
  const [target, requester, place] = await Promise.all([
    person(swap.target.personId),
    person(swap.requester.personId),
    appointmentPlace(swap.ecclesia),
  ])
  const to = target?.primaryEmail
  if (!to) throw new Error(`swap target ${swap.target.personId} has no email`)

  const token = await generateEcclesiaToken(to)
  const links = linker(base, token)
  const rendered = await renderSpeakerSwapRequest({
    inviteType: swap.type,
    recipientName: fullName(target) || swap.target.name,
    requesterName: fullName(requester) || swap.requester.name,
    ecclesiaName: place.ecclesiaName,
    requesterDateDisplay: whenDisplay(swap.requester),
    recipientDateDisplay: whenDisplay(swap.target),
    ...(swap.note ? { note: swap.note } : {}),
    // The page shows the request; its buttons POST. `action` only preselects.
    acceptUrl: links.swap(swap.swapId, '&action=accept'),
    declineUrl: links.swap(swap.swapId, '&action=decline'),
    expiresDisplay: instantDisplay(swap.expiresAt, swap.target.tz),
    emailPreferencesUrl: await generateEmailPreferencesUrl(to, base),
    tenant,
  })

  await deliver({
    claimKey: `${swap.swapId}#swap-request`,
    event: 'swap-request',
    to,
    rendered,
    tenant,
    // The swap is between the two speakers (the RB is not involved, §7.7).
    replyTo: requester?.primaryEmail,
    campaignId: speakerSwapCampaignId(swap.swapId),
    ecclesia: swap.ecclesia,
  })
}

/** Tells the requester their swap request was declined or expired (§7.5). Nothing changed. */
export async function sendSwapOutcomeEmail(swap: SpeakerSwapRecord, outcome: SwapOutcome): Promise<void> {
  const tenant = tenantForEcclesia(swap.ecclesia)
  const base = baseUrlFor(tenant)
  const [requester, place] = await Promise.all([person(swap.requester.personId), appointmentPlace(swap.ecclesia)])
  const to = requester?.primaryEmail
  if (!to) throw new Error(`swap requester ${swap.requester.personId} has no email`)

  const token = await generateEcclesiaToken(to)
  const links = linker(base, token)
  const rendered = await renderSpeakerSwapOutcome({
    outcome,
    inviteType: swap.type,
    requesterName: fullName(requester) || swap.requester.name,
    // First name only: the other speaker's full name is not this reader's to see.
    otherSpeakerName: swap.target.name.split(/\s+/)[0] || 'The other speaker',
    ecclesiaName: place.ecclesiaName,
    requesterDateDisplay: whenDisplay(swap.requester),
    requestedDateDisplay: whenDisplay(swap.target),
    ...(swap.requester.inviteId ? { manageUrl: links.invite(swap.requester.inviteId) } : {}),
    emailPreferencesUrl: await generateEmailPreferencesUrl(to, base),
    tenant,
  })

  await deliver({
    claimKey: `${swap.swapId}#swap-outcome`,
    event: `swap-${outcome}`,
    to,
    rendered,
    tenant,
    campaignId: speakerSwapCampaignId(swap.swapId),
    ecclesia: swap.ecclesia,
  })
}

// ---------------------------------------------------------------------------
// Inviter notice
// ---------------------------------------------------------------------------

export async function sendInviterNotice(
  invite: SpeakerInviteRecord,
  event: InviterNoticeEvent,
  options: InviterNoticeOptions = {}
): Promise<void> {
  const tenant = tenantForEcclesia(invite.ecclesia)
  const base = baseUrlFor(tenant)
  const [inviter, speaker, place] = await Promise.all([
    person(invite.inviterPersonId),
    person(invite.inviteePersonId),
    appointmentPlace(invite.ecclesia),
  ])
  const to = inviter?.primaryEmail
  if (!to) throw new Error(`inviter ${invite.inviterPersonId} has no email`)

  // Accepted/changed: the booked date. Cancelled: the released date, or (an
  // invitation declined before accepting) the dates that were offered.
  const date = invite.acceptedDate
  const dateText = date ? dateDisplay(date) : invite.offeredDates.map((d) => dateDisplay(d.date)).join(', ')
  const rendered = await renderSpeakerInviterNotice({
    kind: event,
    inviteType: invite.type,
    inviterName: inviter?.firstName ?? '',
    speakerName: fullName(speaker) || invite.inviteeEmail,
    ecclesiaName: place.ecclesiaName,
    dateDisplay: dateText,
    ...(date && invite.acceptedTime ? { timeDisplay: timeDisplay(invite.acceptedTime) } : {}),
    ...(options.previousDate ? { previousDateDisplay: dateDisplay(options.previousDate) } : {}),
    adminUrl: `${base}/admin/speaker-invites`,
    ...(options.sheetReminder
      ? { sheetReminder: { name: options.sheetReminder.name, dateDisplay: dateDisplay(options.sheetReminder.date) } }
      : {}),
    ...(options.reason ? { speakerNote: options.reason } : {}),
    emailPreferencesUrl: await generateEmailPreferencesUrl(to, base),
    tenant,
  })

  await deliver({
    claimKey: `${invite.inviteId}#inviter-${event}#${icsSequence(invite)}`,
    event: `inviter-${event}`,
    to,
    rendered,
    tenant,
    // A reply to the notice reaches the speaker.
    replyTo: speaker?.primaryEmail || invite.inviteeEmail,
    campaignId: speakerInviteCampaignId(invite.inviteId),
    ecclesia: invite.ecclesia,
  })
}
