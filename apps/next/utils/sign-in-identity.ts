import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * Sign-in: proving the email, then saying who (R2).
 *
 * Email + code (or Google) proves the caller can use an address: that
 * AUTHORIZES them for it. It does not say who they are: a household shares one
 * inbox. So when more than one person can use the proven address, the session
 * asks "Are you A or B?" and trusts the answer — the caller is already
 * authorized for the address, the answer only identifies them. One holder → no
 * question. A password identifies its owner directly (it belongs to one
 * person), so password sign-in never asks.
 *
 * The allowed list is always derived on the server from the address the
 * session proved (`token.signInEmail`), never from the client.
 *
 * Extension point (R3): an office mailbox (an ecclesia's recording-brother
 * address) can be used by the office's current holder(s); `officeHoldersOf`
 * returns them once offices exist.
 */

export interface IdentityChoice {
  personId: string
  name: string
  ecclesia: string
}

export interface SignInIdentityDeps {
  /** Everyone who holds the address (primary or secondary, incl. loginExcluded). */
  holdersOf: (address: string) => Promise<PersonRecord[]>
  /** R3: the current holder(s) of an office whose mailbox this is. */
  officeHoldersOf: (address: string) => Promise<PersonRecord[]>
  /** The default holder when the credential named nobody (household sign-in rule). */
  defaultHolder: (address: string) => Promise<PersonRecord | null>
}

export const defaultSignInIdentityDeps: SignInIdentityDeps = {
  holdersOf: (address) => personRepository.getAllPersonsByEmail(address),
  officeHoldersOf: async () => [],
  defaultHolder: (address) => personRepository.getByEmail(address),
}

const hasName = (p: PersonRecord) =>
  !!(p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim())

/**
 * The people who may sign in through a proven address (deceased never). A
 * nameless record (a leftover from the 2024 mailing-list import, often an
 * ecclesia mailbox) is not a person to be: when anyone named can use the
 * address, nameless records are left out. Only when nobody named holds it
 * does the nameless record sign in, as before.
 */
export async function peopleWhoCanUse(
  addressRaw: string | null | undefined,
  deps: SignInIdentityDeps = defaultSignInIdentityDeps
): Promise<PersonRecord[]> {
  const address = (addressRaw || '').toLowerCase().trim()
  if (!address) return []
  const [holders, officeHolders] = await Promise.all([deps.holdersOf(address), deps.officeHoldersOf(address)])
  const seen = new Set<string>()
  const people = [...holders, ...officeHolders].filter((p) => {
    if (!p?.personId || p.role === 'deceased' || seen.has(p.personId)) return false
    seen.add(p.personId)
    return true
  })
  const named = people.filter(hasName)
  return named.length > 0 ? named : people
}

export function nameOf(p: PersonRecord): string {
  return p.displayName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed'
}

export function toChoices(people: PersonRecord[]): IdentityChoice[] {
  return people
    .map((p) => ({ personId: p.personId, name: nameOf(p), ecclesia: p.ecclesia || '' }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Should this sign-in ask "Are you A or B?" */
export function mustChooseIdentity(input: {
  people: PersonRecord[]
  /** The credential named one person (a password). */
  identified: boolean
  assurance: 'recognized' | 'authenticated'
}): boolean {
  // A recognized (forwardable email-link) session proves nothing about the
  // inbox, so it is never offered other identities.
  return !input.identified && input.assurance === 'authenticated' && input.people.length > 1
}

/** May a session that proved `address` act as `personId`? */
export async function mayActAs(
  personId: string | null | undefined,
  address: string | null | undefined,
  deps: SignInIdentityDeps = defaultSignInIdentityDeps
): Promise<boolean> {
  if (!personId) return false
  return (await peopleWhoCanUse(address, deps)).some((p) => p.personId === personId)
}

export interface SessionIdentity {
  /** The address this session proved. */
  signInEmail?: string
  personId?: string
  /** Still to answer "Are you A or B?" */
  chooseIdentity?: boolean
}

/** Who a fresh sign-in is, and whether to ask. */
export async function identityAtSignIn(
  input: {
    signInEmail: string | null | undefined
    /** The person the credential resolved to (`user.id`), if any. */
    userId?: string | null
    identified: boolean
    assurance: 'recognized' | 'authenticated'
  },
  deps: SignInIdentityDeps = defaultSignInIdentityDeps
): Promise<SessionIdentity> {
  const signInEmail = (input.signInEmail || '').toLowerCase().trim() || undefined
  if (!signInEmail) return {}
  const people = await peopleWhoCanUse(signInEmail, deps)
  const named = people.find((p) => p.personId === input.userId)
  // The household default, unless it's a record left out above (a nameless
  // leftover): then the only person who can use the address, or the first
  // choice until they answer.
  const fallback = (await deps.defaultHolder(signInEmail))?.personId
  const personId =
    named?.personId ??
    (people.some((p) => p.personId === fallback) ? fallback : people[0]?.personId)
  return {
    signInEmail,
    personId,
    chooseIdentity: mustChooseIdentity({ people, identified: input.identified && !!named, assurance: input.assurance }),
  }
}

/**
 * Answer "Are you A or B?" The requested personId comes from the client, so
 * it is accepted only if that person can use the address the session proved;
 * otherwise the session is unchanged.
 */
export async function switchIdentity(
  current: SessionIdentity,
  requestedPersonId: string,
  deps: SignInIdentityDeps = defaultSignInIdentityDeps
): Promise<SessionIdentity> {
  if (!(await mayActAs(requestedPersonId, current.signInEmail, deps))) return current
  return { ...current, personId: requestedPersonId, chooseIdentity: false }
}
