import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { firstNameOf } from '@my/app/utils/viewer-pii'
import type {
  ShortNotice,
  SpeakerInviteRecord,
  SpeakerSwapRecord,
} from '@my/app/provider/dynamodb/speaker-invite-types'
import type { Trust } from '../auth-trust'
import type { Slot } from './slots'
import { effectiveStatus, effectiveSwapStatus, inviteSlots } from './service'

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

export interface InviteeInviteView {
  inviteId: string
  ecclesia: string
  type: SpeakerInviteRecord['type']
  status: SpeakerInviteRecord['status']
  invitee: { firstName: string; lastName: string }
  inviter: { name: string; email: string | null } | null
  note?: string
  acceptedDate?: string
  acceptedTime?: string
  acceptedTz?: string
  /** Offered dates with their live state (stored dates when not actionable). */
  offeredDates: Slot[]
  /** Other dates in the window, when the inviter enabled them; null otherwise. */
  otherDates: Slot[] | null
  swapAvailable: boolean
}

export async function inviteeInviteView(invite: SpeakerInviteRecord, trust: Trust): Promise<InviteeInviteView> {
  const status = effectiveStatus(invite)
  const [inviteePerson, inviter] = await Promise.all([
    personRepository.getById(invite.inviteePersonId).catch(() => null),
    contactOf(invite.inviterPersonId),
  ])
  const actionable = status === 'sent' || status === 'accepted'
  const live = actionable ? await inviteSlots(invite) : null
  return {
    inviteId: invite.inviteId,
    ecclesia: invite.ecclesia,
    type: invite.type,
    status,
    invitee: { firstName: inviteePerson?.firstName ?? '', lastName: inviteePerson?.lastName ?? '' },
    inviter,
    ...(invite.note ? { note: invite.note } : {}),
    ...(invite.acceptedDate
      ? { acceptedDate: invite.acceptedDate, acceptedTime: invite.acceptedTime, acceptedTz: invite.acceptedTz }
      : {}),
    offeredDates: live
      ? redactSlots(live.offered, trust)
      : invite.offeredDates.map((d) => ({ ...d, state: 'NO_MEETING' as const })),
    otherDates: live && invite.otherDatesWindow ? redactSlots(live.other, trust) : null,
    swapAvailable: invite.type !== 'lecture' && status === 'accepted',
  }
}

export interface SwapView {
  swapId: string
  ecclesia: string
  type: SpeakerSwapRecord['type']
  status: SpeakerSwapRecord['status']
  requester: { name: string | undefined; date: string; time: string; tz: string }
  target: { name: string | undefined; date: string; time: string; tz: string }
  note?: string
  expiresAt: string
  shortNotice?: ShortNotice[]
}

/** The swap as the target (or requester) sees it. The other party's name is tier-redacted. */
export function swapView(
  swap: SpeakerSwapRecord,
  trust: Trust,
  viewerPersonId: string | null,
  shortNotice?: ShortNotice[]
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
    requester: side(swap.requester),
    target: side(swap.target),
    ...(swap.note ? { note: swap.note } : {}),
    expiresAt: swap.expiresAt,
    ...(notice ? { shortNotice: notice } : {}),
  }
}

/** The inviter's view: the record (with live status) plus the invitee's contact. */
export async function inviterInviteView(invite: SpeakerInviteRecord) {
  const invitee = await contactOf(invite.inviteePersonId)
  const { pkey: _pk, skey: _sk, gsi1pk: _g1, gsi1sk: _g2, ...rest } = invite
  return { ...rest, status: effectiveStatus(invite), invitee }
}
