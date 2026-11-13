import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { speakerInviteRepository } from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import { firstNameOf } from '@my/app/utils/viewer-pii'
import { titleFor } from '@my/app/utils/speaker-eligibility'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import {
  INVITE_TYPE_SLOT,
  type AppointmentPlaceView,
  type InviteeInviteView,
  type ShortNotice,
  type Slot,
  type SpeakerInviteRecord,
  type SpeakerSwapRecord,
  type SwapView,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import type { Trust } from '../auth-trust'
import { loadSlotDetails } from './slots'
import { effectiveStatus, effectiveSwapStatus, inviteSlots } from './service'
import { appointmentPlace, googleCalendarUrlFor, onlineMeetingsFor } from './appointment'
import { speakerEmailFor } from './contact'

export type { InviteeInviteView, SwapView } from '@my/app/provider/dynamodb/speaker-invite-types'

/**
 * Response shapes for the invitee pages (spec §6 "Also"). Other speakers' names
 * follow the per-tier floor: FIRST NAME at `recognized` (the existing
 * `firstNameOf` helper), full name only when `authenticated`. The invitee's
 * own name and the inviter's contact are not redacted — they are the reader
 * and the person who wrote to them.
 */

export function nameForTier(name: string | undefined, trust: Trust): string | undefined {
  if (!name) return name
  return trust === 'authenticated' ? name : firstNameOf(name)
}

export function redactSlots(slots: Slot[], trust: Trust): Slot[] {
  return slots.map((s) => {
    // The other speaker's personId is not the reader's business.
    const { speakerPersonId: _id, ...rest } = s
    return s.speakerName ? { ...rest, speakerName: nameForTier(s.speakerName, trust) } : rest
  })
}

export function redactShortNotice(list: ShortNotice[] | undefined, trust: Trust): ShortNotice[] | undefined {
  return list?.map((n) => (n.counterpartName ? { ...n, counterpartName: nameForTier(n.counterpartName, trust) } : n))
}

async function contactOf(personId: string): Promise<{ name: string; email: string | null } | null> {
  const p = await personRepository.getById(personId).catch(() => null)
  if (!p) return null
  return { name: `${p.firstName} ${p.lastName}`.trim(), email: p.primaryEmail || null }
}

/**
 * Mark each FILLED slot `reachable` (its speaker resolves to a person with an
 * email) — computed BEFORE redaction drops the personId. One lookup per person.
 * A speaker with no primary of their own (a visitor on a household address,
 * §9a) is reachable through their booking's invite, when `ref` is given.
 */
export async function markReachable(
  slots: Slot[],
  ref?: Pick<SpeakerInviteRecord, 'ecclesia' | 'type'>
): Promise<Slot[]> {
  const cache = new Map<string, Promise<boolean>>()
  const hasOwnEmail = (personId: string) => {
    if (!cache.has(personId)) {
      cache.set(
        personId,
        personRepository
          .getById(personId)
          .then((p) => !!p?.primaryEmail)
          .catch(() => false)
      )
    }
    return cache.get(personId)!
  }
  const reachable = async (s: Slot, personId: string) => {
    if (await hasOwnEmail(personId)) return true
    if (!ref) return false
    const booking = await speakerInviteRepository.getBooking(ref.ecclesia, ref.type, s.date).catch(() => null)
    if (!booking?.inviteId || booking.personId !== personId) return false
    return !!(await speakerEmailFor(personId, booking.inviteId, null))
  }
  return Promise.all(
    slots.map(async (s) =>
      s.state === 'FILLED' ? { ...s, reachable: s.speakerPersonId ? await reachable(s, s.speakerPersonId) : false } : s
    )
  )
}

/** The accepted appointment's place + calendar links, from the same helpers as the confirmation email. */
async function appointmentExtras(
  invite: SpeakerInviteRecord
): Promise<{ place: AppointmentPlaceView; googleCalendarUrl: string }> {
  const date = invite.acceptedDate!
  const when = { type: invite.type, date, time: invite.acceptedTime ?? '', tz: invite.acceptedTz ?? DEFAULT_TIMEZONE }
  const [place, detail] = await Promise.all([
    appointmentPlace(invite.ecclesia),
    INVITE_TYPE_SLOT[invite.type]
      ? loadSlotDetails(invite.ecclesia, invite.type, date, date)
          .then((c) => c.slots.find((x) => x.date === date))
          .catch(() => undefined)
      : Promise.resolve(undefined),
  ])
  const onlineMeetings = onlineMeetingsFor(invite.type, invite.ecclesia, detail)
  return {
    place: {
      ...(place.hallName ? { hallName: place.hallName } : {}),
      ...(place.address ? { address: place.address } : {}),
      ...(onlineMeetings.length > 0 ? { onlineMeetings } : {}),
    },
    googleCalendarUrl: googleCalendarUrlFor(when, place),
  }
}

export async function inviteeInviteView(
  invite: SpeakerInviteRecord,
  trust: Trust,
  opts: { token?: string | null } = {}
): Promise<InviteeInviteView> {
  const status = effectiveStatus(invite)
  const [inviteePerson, inviter] = await Promise.all([
    personRepository.getById(invite.inviteePersonId).catch(() => null),
    contactOf(invite.inviterPersonId),
  ])
  const actionable = status === 'sent' || status === 'accepted'
  const live = actionable ? await inviteSlots(invite) : null
  const extras = status === 'accepted' && invite.acceptedDate ? await appointmentExtras(invite) : null
  // Same-origin path: the page's session/cookie applies; the token covers a fresh tab.
  const icsUrl = invite.acceptedDate
    ? `/api/invite/${invite.inviteId}/ics${opts.token ? `?token=${encodeURIComponent(opts.token)}` : ''}`
    : undefined
  return {
    inviteId: invite.inviteId,
    ecclesia: invite.ecclesia,
    type: invite.type,
    status,
    invitee: {
      firstName: inviteePerson?.firstName ?? '',
      lastName: inviteePerson?.lastName ?? '',
      ...(titleFor(inviteePerson) ? { title: titleFor(inviteePerson) } : {}),
    },
    inviter,
    ...(invite.note ? { note: invite.note } : {}),
    ...(invite.acceptedDate
      ? { acceptedDate: invite.acceptedDate, acceptedTime: invite.acceptedTime, acceptedTz: invite.acceptedTz }
      : {}),
    offeredDates: live
      ? redactSlots(await markReachable(live.offered, invite), trust)
      : invite.offeredDates.map((d) => ({ ...d, state: 'NO_MEETING' as const })),
    otherDates: live && invite.otherDatesWindow ? redactSlots(await markReachable(live.other, invite), trust) : null,
    swapAvailable: invite.type !== 'lecture' && status === 'accepted',
    ...(extras ? extras : {}),
    ...(icsUrl && (status === 'accepted' || status === 'cancelled') ? { icsUrl } : {}),
  }
}

/** The swap as the target (or requester) sees it. The other party's name is tier-redacted. */
export function swapView(
  swap: SpeakerSwapRecord,
  trust: Trust,
  viewerPersonId: string | null,
  shortNotice?: ShortNotice[],
  viewerTitle?: 'Brother' | 'Sister'
): SwapView {
  const side = (s: SpeakerSwapRecord['requester']) => ({
    name: s.personId === viewerPersonId ? s.name : nameForTier(s.name, trust),
    date: s.date,
    time: s.time,
    tz: s.tz,
  })
  const notice = redactShortNotice(shortNotice, trust)
  return {
    swapId: swap.swapId,
    ecclesia: swap.ecclesia,
    type: swap.type,
    status: effectiveSwapStatus(swap),
    viewerRole: viewerPersonId !== null && viewerPersonId === swap.requester.personId ? 'requester' : 'target',
    ...(viewerTitle ? { viewerTitle } : {}),
    requester: side(swap.requester),
    target: side(swap.target),
    ...(swap.note ? { note: swap.note } : {}),
    expiresAt: swap.expiresAt,
    ...(notice ? { shortNotice: notice } : {}),
  }
}

/**
 * The inviter's view: the record (with live status) plus the invitee's
 * contact. A follow-up names the other person on the address (name only).
 */
export async function inviterInviteView(invite: SpeakerInviteRecord) {
  const [invitee, other] = await Promise.all([
    contactOf(invite.inviteePersonId),
    invite.followUp ? personRepository.getById(invite.followUp.withPersonId).catch(() => null) : Promise.resolve(null),
  ])
  const { pkey: _pk, skey: _sk, gsi1pk: _g1, gsi1sk: _g2, followUp, ...rest } = invite
  return {
    ...rest,
    status: effectiveStatus(invite),
    invitee,
    ...(followUp
      ? {
          followUp: {
            ...followUp,
            withName: (other && (`${other.firstName ?? ''} ${other.lastName ?? ''}`.trim() || other.displayName)) || 'another person',
          },
        }
      : {}),
  }
}
