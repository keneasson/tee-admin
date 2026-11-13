import { NextResponse } from 'next/server'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { forbidden, inviterContext, noStore, readJson } from '@/utils/speaker-invites/http'

/**
 * POST /api/speaker-invites/confirm-brother { personId } → { person: { personId, displayName, ecclesia, gender, baptized } }
 *
 * Spec §9b "Confirm: baptized brother": the inviter vouches. Sets ONLY the
 * facts that are unset (gender → 'male', baptized → true), never overwrites,
 * and records who and when. 409 when either is already recorded to the
 * contrary (a sister, or not baptized). Inviters only (`canSendSpeakerInvite`).
 */
export async function POST(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ctx.person.ecclesia)) return forbidden()
  const body = await readJson(request)
  const personId = typeof body?.personId === 'string' ? body.personId.trim() : ''
  if (!personId) return NextResponse.json({ error: 'personId is required', code: 'INVALID_INPUT' }, { status: 400 })

  const result = await personRepository.confirmBaptizedBrother(personId, ctx.person.personId)
  if (!result.ok) {
    return result.reason === 'not_found'
      ? NextResponse.json({ error: 'That person is not in the directory.', code: 'NOT_FOUND' }, { status: 404 })
      : NextResponse.json(
          { error: 'This person is already recorded otherwise. Their record was not changed.', code: 'CONFLICT' },
          { status: 409 }
        )
  }
  const p = result.person
  return NextResponse.json(
    {
      person: {
        personId: p.personId,
        displayName: (p.displayName || `${p.firstName ?? ''} ${p.lastName ?? ''}`).trim(),
        ecclesia: p.ecclesia ?? '',
        gender: p.gender ?? null,
        baptized: p.baptized ?? null,
      },
    },
    { headers: noStore }
  )
}
