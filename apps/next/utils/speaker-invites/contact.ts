import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { speakerInviteRepository } from '@my/app/provider/dynamodb/repositories/speaker-invite-repository'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * The address a speaker is reached at: their own primary, or else the address
 * their invite was sent to. A visitor who joined a household address only as a
 * secondary (§9a) has no primary of their own, but `invite.inviteeEmail`
 * reaches them. Pass `person` when it is already loaded (undefined = fetch).
 */
export async function speakerEmailFor(
  personId: string,
  inviteId?: string | null,
  person?: PersonRecord | null
): Promise<string | null> {
  const p = person === undefined ? await personRepository.getById(personId).catch(() => null) : person
  if (p?.primaryEmail) return p.primaryEmail
  if (!inviteId) return null
  const invite = await speakerInviteRepository.getInvite(inviteId).catch(() => null)
  return invite && invite.inviteePersonId === personId && invite.inviteeEmail ? invite.inviteeEmail : null
}
