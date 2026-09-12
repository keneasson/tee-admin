import { personRepository } from '../provider/dynamodb/repositories/person-repository'
import type { PersonRecord } from '../provider/dynamodb/types'

/**
 * Resolve "who is this page about?" from a `[email]` route param.
 *
 * The param is named `email` for historical reasons but carries EITHER a
 * personId (UUID) or an email address, and an email may be a person's secondary
 * rather than their primary. All three have to work, because links into a
 * profile are generated from several places and use whichever they have.
 *
 * **This rule must be declared exactly once.** It was written three times, and
 * the copies disagreed: the profile GET handled UUIDs, the contacts route had a
 * local helper that POST and DELETE used, the contacts PATCH called
 * `getByEmail` directly, and the confirm route had no UUID branch at all. So on
 * a profile opened by personId — which is how the directory links to people —
 * the page rendered fine and then every action on it answered
 * "Person not found": Verify was dead for a Super Admin, and so was community
 * confirmation. Per ADR-0003, a domain rule lives in `packages/app` and is
 * declared once; duplicating it is what produced the defect.
 *
 * Returns `null` when nothing matches, so the caller owns the 404.
 */
export async function resolvePersonParam(paramValue: string): Promise<PersonRecord | null> {
  const decoded = decodeURIComponent(paramValue ?? '').trim()
  if (!decoded) return null

  if (isPersonId(decoded)) {
    return (await personRepository.getById(decoded)) || null
  }

  const email = decoded.toLowerCase()
  const byPrimary = await personRepository.getByEmail(email)
  if (byPrimary) return byPrimary

  // An email the person owns but which is not their primary.
  const persons = await personRepository.getAllPersonsByEmail(email)
  return persons[0] || null
}

/** A personId is a UUID; anything else in this param is an email address. */
export function isPersonId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
