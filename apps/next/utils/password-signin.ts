import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { AuthSession } from '@my/app/types'
import type { PersonEmailRecord, PersonRecord } from '@my/app/provider/dynamodb/types'
import { verifyPassword } from './password'
import {
  findCredentialsUsersByEmail,
  verifyCredentialsUser,
} from './dynamodb/credentials-users'

/**
 * Password sign-in and password step-up (R7a).
 *
 * Behind the `person_password_signin` flag (default OFF). The flag is evaluated
 * for the person the typed address resolves to, so 'owner' turns it on for the
 * owner's own account only.
 *
 *  - OFF: the unchanged legacy check (`verifyCredentialsUser`, USER# store).
 *  - ON:  the address resolves to ONE person by the household sign-in rule
 *         (`personRepository.getByEmail` → `chooseSignInHolder`); any address
 *         that person holds signs in, if it is VERIFIED on them. The password
 *         is checked against `PersonRecord.hashedPassword`.
 *         Only when the person has NO password yet is the legacy record
 *         consulted: every duplicate that is itself emailVerified, under
 *         every address VERIFIED on the person, is tried; a match copies that hash onto the PersonRecord, so the next sign-in, and every
 *         later password change, uses the person (additive, lazy, one-time).
 *         An address no person holds keeps the legacy check.
 */

export interface PasswordSignInUser {
  id: string
  email: string
  name: string
  role: string
}

export interface LegacyCredentialsRecord {
  hashedPassword?: string
  emailVerified?: unknown
}

export interface PasswordSignInDeps {
  getPerson: (email: string) => Promise<PersonRecord | null>
  getEmails: (personId: string) => Promise<PersonEmailRecord[]>
  flagOn: (session: AuthSession | null) => Promise<boolean>
  legacyVerify: (email: string, password: string) => Promise<PasswordSignInUser | null>
  /** Legacy USER# credentials records at an address (duplicates possible). */
  legacyRecords: (email: string) => Promise<LegacyCredentialsRecord[]>
  copyHash: (personId: string, hashedPassword: string) => Promise<unknown>
  verify: (password: string, hash: string) => Promise<boolean>
}

export const defaultPasswordSignInDeps: PasswordSignInDeps = {
  getPerson: (email) => personRepository.getByEmail(email),
  getEmails: (personId) => personRepository.getEmails(personId),
  flagOn: (session) => checkFeatureFlagFromDB(FEATURE_FLAGS.PERSON_PASSWORD_SIGNIN, session),
  legacyVerify: async (email, password) => {
    const user = await verifyCredentialsUser(email, password)
    return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null
  },
  legacyRecords: (email) => findCredentialsUsersByEmail(email),
  copyHash: (personId, hashedPassword) => personRepository.updatePassword(personId, hashedPassword),
  verify: verifyPassword,
}

/** Is the person-keyed password path on for this person? */
export async function personPasswordPathOn(
  email: string,
  person: Pick<PersonRecord, 'role'> | null,
  deps: Pick<PasswordSignInDeps, 'flagOn'> = defaultPasswordSignInDeps
): Promise<boolean> {
  return deps.flagOn(person ? { user: { email, role: person.role } } : null)
}

/** Is this address verified ON this person (primary stamp or its EMAIL# row)? */
export function isAddressVerifiedOn(person: PersonRecord, email: string, rows: PersonEmailRecord[]): boolean {
  const lower = email.toLowerCase()
  if (person.primaryEmail?.toLowerCase() === lower && person.emailVerified) return true
  const row = rows.find((r) => r.email?.toLowerCase() === lower)
  return row?.verified === true
}

function roleOf(person: PersonRecord): string {
  return (
    person.role ||
    (person.memberStatus === 'member' || person.isInterEcclesiaRep ? 'member' : undefined) ||
    'guest'
  )
}

export async function verifyPasswordSignIn(
  emailRaw: string,
  password: string,
  deps: PasswordSignInDeps = defaultPasswordSignInDeps
): Promise<PasswordSignInUser | null> {
  const email = emailRaw.toLowerCase().trim()
  if (!email || !password) return null

  const person = await deps.getPerson(email)
  if (!(await personPasswordPathOn(email, person, deps))) {
    return deps.legacyVerify(email, password)
  }
  if (!person) {
    // No person holds this address: the legacy check, unchanged.
    return deps.legacyVerify(email, password)
  }
  if (person.role === 'deceased') return null

  const rows = await deps.getEmails(person.personId)
  if (!isAddressVerifiedOn(person, email, rows)) {
    console.log('password sign-in: address not verified on person', person.personId)
    return null
  }

  // The session carries the address that was typed: the jwt callback resolves
  // it back to this same person by the same sign-in rule.
  const user: PasswordSignInUser = {
    id: person.personId,
    email,
    name: person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || email,
    role: roleOf(person),
  }

  if (person.hashedPassword) {
    return (await deps.verify(password, person.hashedPassword)) ? user : null
  }

  // The person has no password yet: one-time fallback to the legacy record(s)
  // under any address VERIFIED on this person (the legacy store is keyed by
  // address, and may hold duplicates). Only legacy records whose own address
  // was verified count: /api/auth/register creates an unverified USER# record
  // for any address, so an unverified one proves nothing about who set it.
  const addresses = [...new Set([email, person.primaryEmail, ...rows.map((r) => r.email)]
    .filter((a): a is string => !!a)
    .map((a) => a.toLowerCase()))]
    .filter((a) => isAddressVerifiedOn(person, a, rows))
  const hashes: string[] = []
  for (const address of addresses) {
    for (const record of await deps.legacyRecords(address)) {
      if (record.emailVerified && record.hashedPassword) hashes.push(record.hashedPassword)
    }
  }
  for (const hash of hashes) {
    if (!(await deps.verify(password, hash))) continue
    try {
      await deps.copyHash(person.personId, hash)
      console.log('password sign-in: copied legacy password onto person', person.personId)
    } catch (error) {
      // Sign-in still succeeds; the copy is retried on the next sign-in.
      console.error('password sign-in: copying the legacy password failed', person.personId, error)
    }
    return user
  }
  return null
}

export interface PasswordResetDeps {
  getPerson: (email: string) => Promise<PersonRecord | null>
  getEmails: (personId: string) => Promise<PersonEmailRecord[]>
  flagOn: (session: AuthSession | null) => Promise<boolean>
}

const defaultPasswordResetDeps: PasswordResetDeps = defaultPasswordSignInDeps

/**
 * The person whose PersonRecord password a reset through `emailRaw` may touch:
 * the flag is on for them AND the address is VERIFIED on them. Anything else
 * returns null, so forgot-password does not offer a person reset and
 * reset-password never writes `PersonRecord.hashedPassword` (an unverified
 * secondary address, e.g. a mistyped one, must not unlock its person).
 */
export async function personForPasswordReset(
  emailRaw: string,
  deps: PasswordResetDeps = defaultPasswordResetDeps
): Promise<PersonRecord | null> {
  const email = emailRaw.toLowerCase().trim()
  if (!email) return null
  const person = await deps.getPerson(email)
  if (!person || person.role === 'deceased') return null
  if (!(await personPasswordPathOn(email, person, deps))) return null
  const rows = await deps.getEmails(person.personId)
  if (!isAddressVerifiedOn(person, email, rows)) {
    console.log('password reset: address not verified on person', person.personId)
    return null
  }
  return person
}
