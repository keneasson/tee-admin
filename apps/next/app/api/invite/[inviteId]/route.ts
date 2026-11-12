import { NextResponse } from 'next/server'
import type { Trust } from '@/utils/auth-trust'
import { refuseActor, resolveInviteActor } from '@/utils/speaker-invites/actor'
import {
  acceptInvite,
  cancelByInvitee,
  changeDate,
  getInvite,
  requestSwap,
  type Actor,
  type ServiceError,
} from '@/utils/speaker-invites/service'
import { inviteeInviteView, redactShortNotice, redactSlots, swapView } from '@/utils/speaker-invites/views'
import { noStore, readInviteToken, readJson, serviceErrorResponse } from '@/utils/speaker-invites/http'

/**
 * The invitee's own invitation (spec §6).
 *
 * GET  /api/invite/{inviteId}?token=…  → { invite: InviteeInviteView, actor: { trust } }   (read-only, NEVER mutates)
 * POST /api/invite/{inviteId}          body { action, date?, note?, token? }
 *   action 'accept'       { date }  → { invite }                 (recognized + invitee)
 *   action 'change'       { date }  → { invite }                 (recognized + invitee)
 *   action 'cancel'       { note? } → { invite }                 (recognized + invitee; note = the reason, sent to the inviter)
 *   accept / change also return `shortNotice?: ShortNotice[]` (within 24h; names tier-redacted)
 *   action 'swap-request' { date, note? } → { swap: SwapView }   (AUTHENTICATED + invitee; else 403 stepUpRequired)
 *
 * Refusals: 401 { code: 'SIGN_IN_REQUIRED' } · 403 { code: 'SESSION_MISMATCH', mismatch: true }
 *           · 403 { code: 'NOT_INVITEE' } · 403 { code: 'STEP_UP_REQUIRED', stepUpRequired: true }
 * Service errors: { error, code, ... } — SLOT_TAKEN (409) carries `openDates`.
 */

type Params = { params: Promise<{ inviteId: string }> }

const notFound = () =>
  NextResponse.json({ error: 'This invitation link is not valid.', code: 'NOT_FOUND' }, { status: 404, headers: noStore })

function errorFor(err: ServiceError, trust: Trust) {
  return serviceErrorResponse(err.openDates ? { ...err, openDates: redactSlots(err.openDates, trust) } : err)
}

export async function GET(request: Request, { params }: Params) {
  const { inviteId } = await params
  const invite = await getInvite(inviteId)
  if (!invite) return notFound()

  const token = await readInviteToken(request.url)
  const actor = await resolveInviteActor({ personId: invite.inviteePersonId, email: invite.inviteeEmail }, { ecclesiaToken: token })
  const refusal = refuseActor(actor, 'recognized')
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: noStore })

  return NextResponse.json(
    { invite: await inviteeInviteView(invite, actor.trust, { token }), actor: { trust: actor.trust } },
    { headers: noStore }
  )
}

export async function POST(request: Request, { params }: Params) {
  const { inviteId } = await params
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_INPUT' }, { status: 400 })
  const action = body.action
  if (!['accept', 'change', 'cancel', 'swap-request'].includes(action)) {
    return NextResponse.json({ error: 'Unknown action.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const invite = await getInvite(inviteId)
  if (!invite) return notFound()

  const token = await readInviteToken(request.url, body)
  const actor = await resolveInviteActor({ personId: invite.inviteePersonId, email: invite.inviteeEmail }, { ecclesiaToken: token })
  // Requesting a swap moves ANOTHER person's booking: authenticated only.
  const refusal = refuseActor(actor, action === 'swap-request' ? 'authenticated' : 'recognized')
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: noStore })

  const who: Actor = { personId: actor.personId!, trust: actor.trust }
  const date = typeof body.date === 'string' ? body.date : ''

  if (action === 'swap-request') {
    const result = await requestSwap(inviteId, date, typeof body.note === 'string' ? body.note : undefined, who)
    if (!result.ok) return errorFor(result, actor.trust)
    return NextResponse.json({ swap: swapView(result.swap, actor.trust, actor.personId) }, { status: 201, headers: noStore })
  }

  const result =
    action === 'accept'
      ? await acceptInvite(inviteId, date, who)
      : action === 'change'
        ? await changeDate(inviteId, date, who)
        : await cancelByInvitee(inviteId, who, typeof body.note === 'string' ? body.note : undefined)
  if (!result.ok) return errorFor(result, actor.trust)
  const shortNotice = 'shortNotice' in result ? redactShortNotice(result.shortNotice, actor.trust) : undefined
  return NextResponse.json(
    {
      invite: await inviteeInviteView(result.invite, actor.trust, { token }),
      ...(shortNotice ? { shortNotice } : {}),
    },
    { headers: noStore }
  )
}
