import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({ personRepository: {} }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({ checkFeatureFlagFromDB: vi.fn() }))
vi.mock('../../utils/dynamodb/credentials-users', () => ({
  findCredentialsUsersByEmail: vi.fn(),
  verifyCredentialsUser: vi.fn(),
}))

import {
  verifyPasswordSignIn,
  isAddressVerifiedOn,
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

function makeDeps(over: Partial<PasswordSignInDeps> = {}): PasswordSignInDeps & { [k: string]: any } {
  return {
    getPerson: vi.fn(async () => PERSON),
    getEmails: vi.fn(async () => ROWS),
    flagOn: vi.fn(async () => true),
    legacyVerify: vi.fn(async () => ({ id: 'legacy-id', email: 'x', name: 'x', role: 'member' })),
    legacyHashes: vi.fn(async () => []),
    copyHash: vi.fn(async () => undefined),
    // A fake hash is "hash:<password>".
    verify: vi.fn(async (password: string, hash: string) => hash === `hash:${password}`),
    ...over,
  }
}

describe('verifyPasswordSignIn', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flag OFF: the legacy check runs, unchanged', async () => {
    const deps = makeDeps({ flagOn: vi.fn(async () => false) })
    const user = await verifyPasswordSignIn('Primary@Example.org', 'whatever', deps)
    expect(deps.legacyVerify).toHaveBeenCalledWith('primary@example.org', 'whatever')
    expect(user?.id).toBe('legacy-id')
  })

  it('evaluates the flag for the resolved person (so "owner" means the owner only)', async () => {
    const deps = makeDeps()
    await verifyPasswordSignIn('primary@example.org', 'new-password', deps)
    expect(deps.flagOn).toHaveBeenCalledWith({ user: { email: 'primary@example.org', role: 'owner' } })
  })

  it('flag ON: the PersonRecord password signs in, and the legacy record is never read', async () => {
    const deps = makeDeps()
    const user = await verifyPasswordSignIn('primary@example.org', 'new-password', deps)
    expect(user).toEqual({ id: 'person-1', email: 'primary@example.org', name: 'Test Person', role: 'owner' })
    expect(deps.legacyVerify).not.toHaveBeenCalled()
    expect(deps.legacyHashes).not.toHaveBeenCalled()
  })

  it('flag ON: a stale legacy password no longer works once the person has one', async () => {
    const deps = makeDeps({ legacyHashes: vi.fn(async () => ['hash:old-password']) })
    expect(await verifyPasswordSignIn('primary@example.org', 'old-password', deps)).toBeNull()
    expect(deps.legacyHashes).not.toHaveBeenCalled()
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
      legacyHashes: vi.fn(async (email: string) =>
        email === 'second@example.org' ? ['hash:stale', 'hash:legacy-password'] : []
      ),
    })
    const user = await verifyPasswordSignIn('primary@example.org', 'legacy-password', deps)
    expect(user?.id).toBe('person-1')
    expect(deps.copyHash).toHaveBeenCalledWith('person-1', 'hash:legacy-password')
  })

  it('no password on the person and no legacy match: rejected, nothing copied', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => ({ ...PERSON, hashedPassword: undefined }) as PersonRecord),
      legacyHashes: vi.fn(async () => ['hash:something-else']),
    })
    expect(await verifyPasswordSignIn('primary@example.org', 'wrong', deps)).toBeNull()
    expect(deps.copyHash).not.toHaveBeenCalled()
  })

  it('a failed copy still signs in (retried next time)', async () => {
    const deps = makeDeps({
      getPerson: vi.fn(async () => ({ ...PERSON, hashedPassword: undefined }) as PersonRecord),
      legacyHashes: vi.fn(async () => ['hash:legacy-password']),
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
