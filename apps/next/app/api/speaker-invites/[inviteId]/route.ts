import { NextResponse } from 'next/server'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { getInvite } from '@/utils/speaker-invites/service'
import { inviterInviteView } from '@/utils/speaker-invites/views'
import { forbidden, inviterContext, noStore } from '@/utils/speaker-invites/http'

/** GET /api/speaker-invites/{inviteId} → { invite: InviterInviteView } (inviters of that ecclesia). */
export async function GET(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const { inviteId } = await params
  const invite = await getInvite(inviteId)
  if (!invite) return NextResponse.json({ error: 'Invitation not found.', code: 'NOT_FOUND' }, { status: 404 })
  if (!canSendSpeakerInvite(ctx.person, ctx.role, invite.ecclesia)) return forbidden()
  return NextResponse.json({ invite: await inviterInviteView(invite) }, { headers: noStore })
}
