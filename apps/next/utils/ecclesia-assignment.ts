import { NextResponse } from 'next/server'
import { getEcclesiaByName } from './dynamodb/locations'
import { isClosedEcclesia, isSameEcclesia } from '@my/app/utils/ecclesia-name'

/**
 * Server-side guard for writes that put a person (or content) AT an ecclesia.
 * A closed ecclesia stays findable, but nobody is newly assigned to it — the
 * pickers hide it, and this refuses it even if a client sends it anyway.
 *
 * Keeping a person's CURRENT ecclesia is always allowed (`current`): someone
 * already recorded at a closed ecclesia can still save other profile edits.
 * A name that matches no record is left to the caller (free text is allowed
 * for visitors). Returns a 409 response to send, or null to carry on.
 */
export async function refuseClosedEcclesia(
  requested: string | undefined | null,
  current?: string | null
): Promise<NextResponse | null> {
  const name = (requested || '').trim()
  if (!name) return null
  if (current && isSameEcclesia(name, current)) return null
  const ecclesia = await getEcclesiaByName(name)
  if (!isClosedEcclesia(ecclesia)) return null
  return NextResponse.json(
    { error: `${ecclesia!.name} is closed. Choose the ecclesia this person attends now.`, code: 'ECCLESIA_CLOSED' },
    { status: 409 }
  )
}
