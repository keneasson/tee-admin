import { NextResponse } from 'next/server'
import { titleFor } from '@my/app/utils/speaker-eligibility'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { refuseActor, resolveInviteActor } from '@/utils/speaker-invites/actor'
import { speakerEmailFor } from '@/utils/speaker-invites/contact'
import { getSwap, respondSwap, swapViewShortNotice } from '@/utils/speaker-invites/service'
import { swapView } from '@/utils/speaker-invites/views'
import { noStore, readInviteToken, readJson, serviceErrorResponse } from '@/utils/speaker-invites/http'
import type { SpeakerSwapRecord } from '@my/app/provider/dynamodb/speaker-invite-types'

/**
 * A swap request, as the OTHER speaker (the target) sees it (spec §7).
 *
 * GET  /api/invite/swap/{swapId}?token=…  → { swap: SwapView, actor: { trust } }   (read-only, NEVER mutates)
 *      The requester may also view it. `swap.shortNotice` is present when
 *      accepting now (or the accepted swap) is within 24h of either appointment.
 * POST /api/invite/swap/{swapId}  body { action: 'accept' | 'decline', token? }
 *      → { swap: SwapView }  (recognized + identity == the target speaker)
 *      Errors: SWAP_CLOSED / SWAP_EXPIRED / SWAP_STALE (409), NOT_FOUND (404).
 */

type Params = { params: Promise<{ swapId: string }> }

const notFound = () =>
  NextResponse.json({ error: 'This swap link is not valid.', code: 'NOT_FOUND' }, { status: 404, headers: noStore })

async function subjectOf(side: SpeakerSwapRecord['target']) {
  const person = await personRepository.getById(side.personId).catch(() => null)
  // Their own primary, or the (household) address their invite went to (§9a).
  return { personId: side.personId, email: await speakerEmailFor(side.personId, side.inviteId, person) }
}

/** The viewer's recorded gender for the page title (§9b); none when unset. */
async function titleOf(personId: string | null) {
  if (!personId) return undefined
  return titleFor(await personRepository.getById(personId).catch(() => null))
}

export async function GET(request: Request, { params }: Params) {
  const { swapId } = await params
  const swap = await getSwap(swapId)
  if (!swap) return notFound()
  const token = await readInviteToken(request.url)

  let actor = await resolveInviteActor(await subjectOf(swap.target), { ecclesiaToken: token })
  // The side the reader acts for (a household member acts for their speaker).
  let viewer = swap.target.personId
  if (!actor.isInvitee && !actor.mismatch && actor.trust !== 'anonymous') {
    const asRequester = await resolveInviteActor(await subjectOf(swap.requester), { ecclesiaToken: token })
    if (asRequester.isInvitee) {
      actor = asRequester
      viewer = swap.requester.personId
    }
  }
  const refusal = refuseActor(actor, 'recognized')
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: noStore })

  const shortNotice = await swapViewShortNotice(swap)
  return NextResponse.json(
    { swap: swapView(swap, actor.trust, viewer, shortNotice, await titleOf(viewer)), actor: { trust: actor.trust } },
    { headers: noStore }
  )
}

export async function POST(request: Request, { params }: Params) {
  const { swapId } = await params
  const body = await readJson(request)
  if (!body || (body.action !== 'accept' && body.action !== 'decline')) {
    return NextResponse.json({ error: 'action must be accept or decline.', code: 'INVALID_INPUT' }, { status: 400 })
  }
  const swap = await getSwap(swapId)
  if (!swap) return notFound()

  const token = await readInviteToken(request.url, body)
  const actor = await resolveInviteActor(await subjectOf(swap.target), { ecclesiaToken: token })
  const refusal = refuseActor(actor, 'recognized')
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: noStore })

  const result = await respondSwap(swapId, body.action, { personId: actor.personId!, trust: actor.trust })
  if (!result.ok) return serviceErrorResponse(result)
  return NextResponse.json(
    { swap: swapView(result.swap, actor.trust, swap.target.personId, result.shortNotice, await titleOf(swap.target.personId)) },
    { headers: noStore }
  )
}
