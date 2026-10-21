import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PersonEmailRecord, PersonRecord } from '@my/app/provider/dynamodb/types'
import { verifyPassword } from './password'
import {
  findCredentialsUsersByEmail,
  verifyCredentialsUser,
} from './dynamodb/credentials-users'

/**
 * Password sign-in and password step-up (R7a).
 *
 * The typed address resolves to ONE person by the household sign-in rule
 * (`personRepository.getByEmail` → `chooseSignInHolder`); any address that
 * person holds signs in, if it is VERIFIED on them. The password is checked
 * against `PersonRecord.hashedPassword`.
 *
 * Only when the person has NO password yet is the legacy record consulted:
 * every duplicate that is itself emailVerified, under every address VERIFIED on
 * the person, is tried; a match copies that hash onto the PersonRecord, so the
 * next sign-in, and every later password change, uses the person (additive,
 * lazy, one-time). An address no person holds keeps the legacy check. Both
 * legacy reads go with the USER# store (R8).
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
  legacyVerify: (email: string, password: string) => Promise<PasswordSignInUser | null>
  /** Legacy USER# credentials records at an address (duplicates possible). */
  legacyRecords: (email: string) => Promise<LegacyCredentialsRecord[]>
  copyHash: (personId: string, hashedPassword: string) => Promise<unknown>
  verify: (password: string, hash: string) => Promise<boolean>
  /** Everyone who holds the address (a shared household inbox), R2. */
  getHolders?: (email: string) => Promise<PersonRecord[]>
}

export const defaultPasswordSignInDeps: PasswordSignInDeps = {
  getPerson: (email) => personRepository.getByEmail(email),
  getEmails: (personId) => personRepository.getEmails(personId),
  legacyVerify: async (email, password) => {
    const user = await verifyCredentialsUser(email, password)
    return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null
  },
  legacyRecords: (email) => findCredentialsUsersByEmail(email),
  copyHash: (personId, hashedPassword) => personRepository.updatePassword(personId, hashedPassword),
  verify: verifyPassword,
  getHolders: (email) => personRepository.getAllPersonsByEmail(email),
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
  if (!person) {
    // No person holds this address: the legacy check, unchanged.
    return deps.legacyVerify(email, password)
  }
  if (person.role === 'deceased') return null

  const user = await signInAs(person, email, password, deps)
  if (user) return user

  // A shared household address (R2): a household member's OWN password
  // identifies them directly, so try everyone else who holds the address.
  // Only their own PersonRecord password counts (no legacy fallback): a
  // password belongs to one person.
  for (const other of (await deps.getHolders?.(email)) ?? []) {
    if (other.personId === person.personId || other.role === 'deceased' || !other.hashedPassword) continue
    if (!isAddressVerifiedOn(other, email, await deps.getEmails(other.personId))) continue
    if (await deps.verify(password, other.hashedPassword)) return userFor(other, email)
  }
  return null
}

function userFor(person: PersonRecord, email: string): PasswordSignInUser {
  return {
    id: person.personId,
    email,
    name: person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim() || email,
    role: roleOf(person),
  }
}

async function signInAs(
  person: PersonRecord,
  email: string,
  password: string,
  deps: PasswordSignInDeps
): Promise<PasswordSignInUser | null> {
  const rows = await deps.getEmails(person.personId)
  if (!isAddressVerifiedOn(person, email, rows)) {
    console.log('password sign-in: address not verified on person', person.personId)
    return null
  }

  // The session carries the address that was typed, and this person's id
  // (`user.id`): the password named them, so the session never asks who (R2).
  const user = userFor(person, email)

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
}

const defaultPasswordResetDeps: PasswordResetDeps = defaultPasswordSignInDeps

/**
 * The person whose PersonRecord password a reset through `emailRaw` may touch:
 * the address must be VERIFIED on them. Anything else
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
  const rows = await deps.getEmails(person.personId)
  if (!isAddressVerifiedOn(person, email, rows)) {
    console.log('password reset: address not verified on person', person.personId)
    return null
  }
  return person
}
