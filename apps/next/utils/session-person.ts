import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * The person a signed-in address means for THIS request (R2).
 *
 * A household can share one address, so the address alone doesn't say who is
 * signed in: the session carries the person who signed in (`personId`, chosen
 * on "Are you A or B?"). When `email` is the session's own address, that person
 * is returned; any other address (or a session from before R2) resolves by the
 * household sign-in rule, as before.
 */
type SessionLike = { user?: { email?: string | null; personId?: string | null } } | null

export async function personForSessionEmail(emailRaw: string | null | undefined): Promise<PersonRecord | null> {
  const email = (emailRaw || '').toLowerCase().trim()
  if (!email) return null

  let session: SessionLike = null
  try {
    // Loaded lazily: auth pulls in NextAuth, which callers that never reach
    // here (scripts, unit tests) shouldn't have to load.
    const { auth } = await import('./auth')
    session = (await auth()) as SessionLike
  } catch {
    // Outside a request scope (scripts, tests): no session.
  }
  const personId = session?.user?.personId
  if (personId && session?.user?.email?.toLowerCase() === email) {
    const person = await personRepository.getById(personId)
    if (person) return person
  }

  return (await personRepository.getByEmail(email)) ?? (await personRepository.getAllPersonsByEmail(email))[0] ?? null
}
