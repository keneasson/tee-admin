import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({ personRepository: {} }))
vi.mock('../../utils/dynamodb/credentials-users', () => ({
  findCredentialsUsersByEmail: vi.fn(),
  verifyCredentialsUser: vi.fn(),
}))

import {
  verifyPasswordSignIn,
  isAddressVerifiedOn,
  personForPasswordReset,
  type PasswordResetDeps,
  type PasswordSignInDeps,
} from '../../utils/password-signin'
import type { PersonEmailRecord, PersonRecord } from '@my/app/provider/dynamodb/types'

/**
 * R7a: password sign-in (and the password step-up, which uses the same
 * credentials provider) checks the PersonRecord. The bug: a changed password
 * was rejected because sign-in read a legacy USER# record (possibly one of
 * several duplicates) instead.
 */

const PERSON = {
  personId: 'person-1',
  primaryEmail: 'primary@example.org',
  emailVerified: '2026-01-01T00:00:00.000Z',
  firstName: 'Test',
  lastName: 'Person',
  displayName: 'Test Person',
  role: 'owner',
  hashedPassword: 'hash:new-password',
} as unknown as PersonRecord

const ROWS = [
  { email: 'primary@example.org', verified: true },
  { email: 'second@example.org', verified: true },
  { email: 'unverified@example.org', verified: false },
] as unknown as PersonEmailRecord[]

/** A legacy USER# credentials record; verified unless said otherwise. */
function legacy(hashedPassword: string, emailVerified: unknown = '2025-01-01T00:00:00.000Z') {
  return { hashedPassword, emailVerified }
}

const NO_PASSWORD = { ...PERSON, hashedPassword: undefined } as PersonRecord

function makeDeps(over: Partial<PasswordSignInDeps> = {}): PasswordSignInDeps & { [k: string]: any } {
  return {
    getPerson: vi.fn(async () => PERSON),
    getEmails: vi.fn(async () => ROWS),
    legacyVerify: vi.fn(async () => ({ id: 'legacy-id', email: 'x', name: 'x', role: 'member' })),
    legacyRecords: vi.fn(async () => []),
    copyHash: vi.fn(async () => undefined),
    // A fake hash is "hash:<password>".
    verify: vi.fn(async (password: string, hash: string) => hash === `hash:${password}`),
    ...over,
  }
}

describe('verifyPasswordSignIn', () => {
  beforeEach(() => vi.clearAllMocks())

  it('the PersonRecord password signs in, and the legacy record is never read', async () => {
    const deps = makeDeps()
    const user = await verifyPasswordSignIn('primary@example.org', 'new-password', deps)
    expect(user).toEqual({ id: 'person-1', email: 'primary@example.org', name: 'Test Person', role: 'owner' })
    expect(deps.legacyVerify).not.toHaveBeenCalled()
    expect(deps.legacyRecords).not.toHaveBeenCalled()
  })

  it('a stale legacy password no longer works once the person has one', async () => {
    const deps = makeDeps({ legacyRecords: vi.fn(async () => [legacy('hash:old-password')]) })
    expect(await verifyPasswordSignIn('primary@example.org', 'old-password', deps)).toBeNull()
    expect(deps.legacyRecords).not.toHaveBeenCalled()
  })

  it('any VERIFIED address the person holds signs in; the session keeps the typed address', async () => {
    const deps = makeDeps()
    const user = await verifyPasswordSignIn('second@example.org', 'new-password', deps)
    expect(user?.id).toBe('person-1')
    expect(user?.email).toBe('second@example.org')
  })

  it('an unverified address does not sign in', async () => {
    const deps = makeDeps()
    expect(await verifyPasswordSignIn('unverified@example.org', 'new-password', deps)).toBeNull()
  })

  it('no password on the person: falls back to the legacy record(s) and copies the hash over', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => ({ ...PERSON, hashedPassword: undefined }) as PersonRecord),
      // Duplicates: the first is stale, the second is the real one — and they
      // may sit under another address the person holds.
      legacyRecords: vi.fn(async (email: string) =>
        email === 'second@example.org' ? [legacy('hash:stale'), legacy('hash:legacy-password')] : []
      ),
    })
    const user = await verifyPasswordSignIn('primary@example.org', 'legacy-password', deps)
    expect(user?.id).toBe('person-1')
    expect(deps.copyHash).toHaveBeenCalledWith('person-1', 'hash:legacy-password')
  })

  it('no password on the person and no legacy match: rejected, nothing copied', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => ({ ...PERSON, hashedPassword: undefined }) as PersonRecord),
      legacyRecords: vi.fn(async () => [legacy('hash:something-else')]),
    })
    expect(await verifyPasswordSignIn('primary@example.org', 'wrong', deps)).toBeNull()
    expect(deps.copyHash).not.toHaveBeenCalled()
  })

  it('a failed copy still signs in (retried next time)', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => ({ ...PERSON, hashedPassword: undefined }) as PersonRecord),
      legacyRecords: vi.fn(async () => [legacy('hash:legacy-password')]),
      copyHash: vi.fn(async () => {
        throw new Error('dynamo down')
      }),
    })
    expect((await verifyPasswordSignIn('primary@example.org', 'legacy-password', deps))?.id).toBe('person-1')
  })

  it('no person holds the address: the legacy check runs', async () => {
    const deps = makeDeps({ getPerson: vi.fn(async () => null) })
    await verifyPasswordSignIn('nobody@example.org', 'pw', deps)
    expect(deps.legacyVerify).toHaveBeenCalled()
  })

  // Security: the legacy fallback must not let someone else's credentials in.
  it('an UNVERIFIED legacy record never matches (register creates one for any address)', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => NO_PASSWORD),
      legacyRecords: vi.fn(async () => [legacy('hash:attacker-password', null)]),
    })
    expect(await verifyPasswordSignIn('primary@example.org', 'attacker-password', deps)).toBeNull()
    expect(deps.copyHash).not.toHaveBeenCalled()
  })

  it('an unverified duplicate is skipped while a verified one still matches', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => NO_PASSWORD),
      legacyRecords: vi.fn(async () => [legacy('hash:attacker-password', null), legacy('hash:real-password')]),
    })
    expect(await verifyPasswordSignIn('primary@example.org', 'attacker-password', deps)).toBeNull()
    expect((await verifyPasswordSignIn('primary@example.org', 'real-password', deps))?.id).toBe('person-1')
    expect(deps.copyHash).toHaveBeenCalledTimes(1)
    expect(deps.copyHash).toHaveBeenCalledWith('person-1', 'hash:real-password')
  })

  it('a legacy hash under an address UNVERIFIED on the person is never read or matched', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => NO_PASSWORD),
      // A verified legacy account owned by whoever controls the unverified
      // (e.g. mistyped) secondary address.
      legacyRecords: vi.fn(async (email: string) =>
        email === 'unverified@example.org' ? [legacy('hash:other-owner-password')] : []
      ),
    })
    expect(await verifyPasswordSignIn('primary@example.org', 'other-owner-password', deps)).toBeNull()
    expect(deps.legacyRecords).not.toHaveBeenCalledWith('unverified@example.org')
    expect(deps.legacyRecords).toHaveBeenCalledWith('primary@example.org')
    expect(deps.legacyRecords).toHaveBeenCalledWith('second@example.org')
    expect(deps.copyHash).not.toHaveBeenCalled()
  })

  it('an unverified PROFILE primary is not a fallback address either', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(
        async () => ({ ...NO_PASSWORD, primaryEmail: 'stale@example.org', emailVerified: undefined }) as PersonRecord
      ),
      legacyRecords: vi.fn(async (email: string) =>
        email === 'stale@example.org' ? [legacy('hash:stale-owner-password')] : []
      ),
    })
    expect(await verifyPasswordSignIn('second@example.org', 'stale-owner-password', deps)).toBeNull()
    expect(deps.legacyRecords).not.toHaveBeenCalledWith('stale@example.org')
  })

  it('a deceased person cannot sign in', async () => {
    const deps = makeDeps({ getPerson: vi.fn(async () => ({ ...PERSON, role: 'deceased' }) as PersonRecord) })
    expect(await verifyPasswordSignIn('primary@example.org', 'new-password', deps)).toBeNull()
  })
})

describe('isAddressVerifiedOn', () => {
  it('a verified PROFILE primary counts even with no EMAIL# row', () => {
    expect(isAddressVerifiedOn(PERSON, 'PRIMARY@example.org', [])).toBe(true)
  })
  it('an unverified PROFILE primary needs a verified row', () => {
    const p = { ...PERSON, emailVerified: undefined } as PersonRecord
    expect(isAddressVerifiedOn(p, 'primary@example.org', [])).toBe(false)
    expect(isAddressVerifiedOn(p, 'primary@example.org', ROWS)).toBe(true)
  })
})

describe('personForPasswordReset', () => {
  function resetDeps(over: Partial<PasswordResetDeps> = {}): PasswordResetDeps {
    return {
      getPerson: vi.fn(async () => PERSON),
      getEmails: vi.fn(async () => ROWS),
      ...over,
    }
  }

  it('a verified address resolves its person', async () => {
    expect((await personForPasswordReset('Second@Example.org', resetDeps()))?.personId).toBe('person-1')
  })

  it('an address UNVERIFIED on the person never resolves it', async () => {
    expect(await personForPasswordReset('unverified@example.org', resetDeps())).toBeNull()
  })

  it('no person, or deceased: null', async () => {
    expect(await personForPasswordReset('primary@example.org', resetDeps({ getPerson: vi.fn(async () => null) }))).toBeNull()
    expect(
      await personForPasswordReset(
        'primary@example.org',
        resetDeps({ getPerson: vi.fn(async () => ({ ...PERSON, role: 'deceased' }) as PersonRecord) })
      )
    ).toBeNull()
  })
})
