import { NextResponse } from 'next/server'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { createInvite, listInvites, type CreateInviteInput } from '@/utils/speaker-invites/service'
import { inviterInviteView } from '@/utils/speaker-invites/views'
import { forbidden, inviterContext, noStore, readJson, serviceErrorResponse } from '@/utils/speaker-invites/http'
import { SPEAKER_INVITE_TYPES, type SpeakerInviteType } from '@my/app/provider/dynamodb/speaker-invite-types'

/**
 * Speaker invitations — inviter side (spec §2).
 *
 * GET  /api/speaker-invites?ecclesia=X  → { invites: InviterInviteView[] }
 * POST /api/speaker-invites             → 201 { invite } | 4xx { error, code, ... }
 *
 * Only the owner, or the Recording Brother / a Rep OF the ecclesia, may act.
 * The ecclesia defaults to the inviter's own; only the owner may name another.
 */

export async function GET(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const ecclesia = new URL(request.url).searchParams.get('ecclesia') || ctx.person.ecclesia
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ecclesia)) return forbidden()

  const invites = await listInvites(ecclesia)
  return NextResponse.json(
    { ecclesia, invites: await Promise.all(invites.map(inviterInviteView)) },
    { headers: noStore }
  )
}

export async function POST(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_INPUT' }, { status: 400 })

  const ecclesia: string = typeof body.ecclesia === 'string' && body.ecclesia ? body.ecclesia : ctx.person.ecclesia
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ecclesia)) return forbidden()

  const type = body.type as SpeakerInviteType
  if (!SPEAKER_INVITE_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Unknown invitation type.', code: 'INVALID_INPUT' }, { status: 400 })
  }
  const invitee = body.invitee as CreateInviteInput['invitee'] | undefined
  if (!invitee || typeof invitee !== 'object') {
    return NextResponse.json({ error: 'Choose who to invite.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const result = await createInvite({
    ecclesia,
    type,
    inviter: { personId: ctx.person.personId, trust: ctx.trust },
    invitee,
    dates: Array.isArray(body.dates) ? body.dates : [],
    ...(body.otherDatesWindow ? { otherDatesWindow: body.otherDatesWindow } : {}),
    ...(typeof body.note === 'string' ? { note: body.note } : {}),
    send: body.send !== false,
  })
  if (!result.ok) return serviceErrorResponse(result)
  return NextResponse.json({ invite: await inviterInviteView(result.invite) }, { status: 201, headers: noStore })
}
