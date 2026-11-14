import { NextResponse } from 'next/server'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { INVITE_WHO, isEligibleFor, type InviteWho } from '@my/app/provider/dynamodb/invite-program-types'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { isEmailAddress } from '@/utils/speaker-invites/service'
import { forbidden, inviterContext, noStore } from '@/utils/speaker-invites/http'

/**
 * GET /api/speaker-invites/lookup-email?email=…[&who=brethren|sisters|anyone]
 *   → { match: { personId, displayName, ecclesia, invitable } | null }
 *
 * Spec §9a: the composer's "add them" form checks an email before creating
 * anyone. Inviters only (owner, or the RB / a Rep of their own ecclesia). The
 * answer is the name floor only, never contact details: the caller already
 * typed the address. 400 on a malformed address. `invitable` follows the
 * program's WHO filter (§3a); default brethren (§9b).
 */
export async function GET(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ctx.person.ecclesia)) return forbidden()

  const params = new URL(request.url).searchParams
  const email = (params.get('email') || '').trim().toLowerCase()
  const whoParam = params.get('who') as InviteWho | null
  const who: InviteWho = whoParam && INVITE_WHO.includes(whoParam) ? whoParam : 'brethren'
  if (!isEmailAddress(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.', code: 'INVALID_INPUT' }, { status: 400, headers: noStore })
  }
  const person = await personRepository.getByEmail(email)
  const match =
    person && person.role !== 'deceased'
      ? {
          personId: person.personId,
          displayName: (person.displayName || `${person.firstName ?? ''} ${person.lastName ?? ''}`).trim(),
          ecclesia: person.ecclesia ?? '',
          // §9b/§3a: whether "Yes, invite them" may be offered. No facts, just the answer.
          invitable: isEligibleFor(who, person),
        }
      : null
  return NextResponse.json({ match }, { headers: noStore })
}
