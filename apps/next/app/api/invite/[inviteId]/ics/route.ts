import { NextResponse } from 'next/server'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import { refuseActor, resolveInviteActor } from '@/utils/speaker-invites/actor'
import { getInvite } from '@/utils/speaker-invites/service'
import { appointmentPlace, baseUrlFor, icsFor, tenantForEcclesia } from '@/utils/speaker-invites/appointment'
import { noStore, readInviteToken } from '@/utils/speaker-invites/http'

/**
 * GET /api/invite/{inviteId}/ics?token=…  → text/calendar (read-only, NEVER mutates)
 *
 * The hosted .ics linked from the confirmation email (spec §8.2). Generated
 * live from the invite, so it always matches the current booking:
 *   - UID `speaker-invite-{inviteId}@{brand domain}` — stable, so an import
 *     replaces the earlier entry;
 *   - SEQUENCE = the invite's history count (goes up on every change);
 *   - a cancelled invite serves METHOD:CANCEL with the same UID.
 * Gate: recognized + identity == the invitee (same as the invite page).
 * 404 when the invite has no appointment (not yet accepted).
 */

type Params = { params: Promise<{ inviteId: string }> }

const notFound = (message: string) =>
  NextResponse.json({ error: message, code: 'NOT_FOUND' }, { status: 404, headers: noStore })

export async function GET(request: Request, { params }: Params) {
  const { inviteId } = await params
  const invite = await getInvite(inviteId)
  if (!invite) return notFound('This calendar link is not valid.')

  const token = await readInviteToken(request.url)
  const actor = await resolveInviteActor({ personId: invite.inviteePersonId, email: invite.inviteeEmail }, { ecclesiaToken: token })
  const refusal = refuseActor(actor, 'recognized')
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status, headers: noStore })

  if (!invite.acceptedDate) return notFound('There is no appointment on this invitation yet.')

  const tenant = tenantForEcclesia(invite.ecclesia)
  const [place, inviter] = await Promise.all([
    appointmentPlace(invite.ecclesia),
    personRepository.getById(invite.inviterPersonId).catch(() => null),
  ])
  const manageUrl = `${baseUrlFor(tenant)}/invite/${invite.inviteId}`
  const body = icsFor(
    invite,
    { type: invite.type, date: invite.acceptedDate, time: invite.acceptedTime ?? '', tz: invite.acceptedTz ?? DEFAULT_TIMEZONE },
    place,
    tenant,
    {
      url: manageUrl,
      ...(inviter?.primaryEmail
        ? { organizer: { name: `${inviter.firstName} ${inviter.lastName}`.trim(), email: inviter.primaryEmail } }
        : {}),
    }
  )

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="speaker-invite-${invite.inviteId}.ics"`,
      ...noStore,
    },
  })
}
