import { NextResponse } from 'next/server'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { cancelByInviter, getInvite } from '@/utils/speaker-invites/service'
import { inviterInviteView } from '@/utils/speaker-invites/views'
import { forbidden, inviterContext, noStore, serviceErrorResponse } from '@/utils/speaker-invites/http'

/**
 * POST /api/speaker-invites/{inviteId}/cancel → { invite } | 4xx { error, code }
 * The inviter withdraws the invite; an accepted booking and its roster entry are released.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const { inviteId } = await params
  const invite = await getInvite(inviteId)
  if (!invite) return NextResponse.json({ error: 'Invitation not found.', code: 'NOT_FOUND' }, { status: 404 })
  if (!canSendSpeakerInvite(ctx.person, ctx.role, invite.ecclesia)) return forbidden()

  const result = await cancelByInviter(inviteId, { personId: ctx.person.personId, trust: ctx.trust })
  if (!result.ok) return serviceErrorResponse(result)
  return NextResponse.json({ invite: await inviterInviteView(result.invite) }, { headers: noStore })
}
