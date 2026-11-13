import { NextResponse } from 'next/server'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { getInvite, resolveFollowUp } from '@/utils/speaker-invites/service'
import { inviterInviteView } from '@/utils/speaker-invites/views'
import { forbidden, inviterContext, noStore, serviceErrorResponse } from '@/utils/speaker-invites/http'

/**
 * POST /api/speaker-invites/{inviteId}/follow-up/resolve → { invite: InviterInviteView }
 *
 * Spec §9a: "Mark resolved" on a "Needs follow-up" invite. Inviters of that
 * ecclesia, or the owner. Records who resolved it and when; repeating it
 * changes nothing.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const { inviteId } = await params
  const invite = await getInvite(inviteId)
  if (!invite) return NextResponse.json({ error: 'Invitation not found.', code: 'NOT_FOUND' }, { status: 404 })
  if (!canSendSpeakerInvite(ctx.person, ctx.role, invite.ecclesia)) return forbidden()

  const result = await resolveFollowUp(inviteId, { personId: ctx.person.personId, trust: ctx.trust })
  if (!result.ok) return serviceErrorResponse(result)
  return NextResponse.json({ invite: await inviterInviteView(result.invite) }, { headers: noStore })
}
