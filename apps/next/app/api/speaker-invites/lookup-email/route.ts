import { NextResponse } from 'next/server'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { isInvitableSpeaker } from '@my/app/utils/speaker-eligibility'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { isEmailAddress } from '@/utils/speaker-invites/service'
import { forbidden, inviterContext, noStore } from '@/utils/speaker-invites/http'

/**
 * GET /api/speaker-invites/lookup-email?email=… → { match: { personId, displayName, ecclesia, invitable } | null }
 *
 * Spec §9a: the composer's "add them" form checks an email before creating
 * anyone. Inviters only (owner, or the RB / a Rep of their own ecclesia). The
 * answer is the name floor only, never contact details: the caller already
 * typed the address. 400 on a malformed address.
 */
export async function GET(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ctx.person.ecclesia)) return forbidden()

  const email = (new URL(request.url).searchParams.get('email') || '').trim().toLowerCase()
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
          // §9b: whether "Yes, invite them" may be offered. No facts, just the answer.
          invitable: isInvitableSpeaker(person),
        }
      : null
  return NextResponse.json({ match }, { headers: noStore })
}
