import { NextResponse } from 'next/server'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { getInvite, resendInvite } from '@/utils/speaker-invites/service'
import { inviterInviteView } from '@/utils/speaker-invites/views'
import { forbidden, inviterContext, noStore, serviceErrorResponse } from '@/utils/speaker-invites/http'

/**
 * POST /api/speaker-invites/{inviteId}/resend → { invite, sent: 'invitation' | 'confirmation' }
 *
 * Spec §9 "Resend": re-sends the email for the invite's current state (the
 * invitation while waiting, the confirmation once accepted) with fresh token
 * links. Inviters of that ecclesia only. Each resend is a `resent` history
 * entry and its own idempotency claim. Cancelled/expired → 409; a failed
 * send → 502 SEND_FAILED.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const { inviteId } = await params
  const invite = await getInvite(inviteId)
  if (!invite) return NextResponse.json({ error: 'Invitation not found.', code: 'NOT_FOUND' }, { status: 404 })
  if (!canSendSpeakerInvite(ctx.person, ctx.role, invite.ecclesia)) return forbidden()

  const result = await resendInvite(inviteId, { personId: ctx.person.personId, trust: ctx.trust })
  if (!result.ok) return serviceErrorResponse(result)
  return NextResponse.json({ invite: await inviterInviteView(result.invite), sent: result.sent }, { headers: noStore })
}
