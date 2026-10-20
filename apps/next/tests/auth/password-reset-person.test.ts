import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

/**
 * R7a security: with person_password_signin on, a password reset may only set
 * PersonRecord.hashedPassword when the reset address is VERIFIED on that
 * person. A token sent to an unverified (e.g. mistyped) secondary address must
 * never unlock the person.
 */

const h = vi.hoisted(() => ({
  getByEmail: vi.fn(),
  getEmails: vi.fn(),
  updatePassword: vi.fn(),
  flag: vi.fn(),
  findLegacy: vi.fn(),
  createToken: vi.fn(),
  validateToken: vi.fn(),
  legacyReset: vi.fn(),
  deleteToken: vi.fn(),
  sendReset: vi.fn(),
}))

vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getByEmail: h.getByEmail, getEmails: h.getEmails, updatePassword: h.updatePassword },
}))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({ checkFeatureFlagFromDB: h.flag }))
vi.mock('../../utils/dynamodb/credentials-users', () => ({
  findCredentialsUserByEmail: h.findLegacy,
  findCredentialsUsersByEmail: vi.fn(async () => []),
  verifyCredentialsUser: vi.fn(),
  createPasswordResetToken: h.createToken,
  validatePasswordResetToken: h.validateToken,
  resetPassword: h.legacyReset,
  deletePasswordResetToken: h.deleteToken,
}))
vi.mock('../../utils/email/send-verification-email', () => ({ sendPasswordResetEmail: h.sendReset }))
vi.mock('../../utils/password', () => ({
  validatePassword: vi.fn(() => ({ isValid: true, errors: [] })),
  hashPassword: vi.fn(async (p: string) => `hash:${p}`),
  verifyPassword: vi.fn(),
}))

import { POST as forgotPOST } from '../../app/api/auth/forgot-password/route'
import { POST as resetPOST } from '../../app/api/auth/reset-password/route'

const PERSON = {
  personId: 'person-1',
  primaryEmail: 'primary@example.org',
  emailVerified: '2026-01-01T00:00:00.000Z',
  firstName: 'Test',
  lastName: 'Person',
  role: 'member',
  hashedPassword: 'hash:current',
}
const ROWS = [
  { email: 'primary@example.org', verified: true },
  { email: 'mistyped@example.org', verified: false },
]

function post(body: unknown) {
  return { json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  h.getByEmail.mockResolvedValue(PERSON)
  h.getEmails.mockResolvedValue(ROWS)
  h.flag.mockResolvedValue(true)
  h.findLegacy.mockResolvedValue(null)
  h.createToken.mockResolvedValue('token-1')
  h.legacyReset.mockResolvedValue(false)
})

describe('forgot-password (flag on)', () => {
  it('a verified address of a person with a password gets a reset email', async () => {
    await forgotPOST(post({ email: 'primary@example.org' }))
    expect(h.createToken).toHaveBeenCalledWith('primary@example.org')
    expect(h.sendReset).toHaveBeenCalled()
  })

  it('an address UNVERIFIED on the person gets no person reset', async () => {
    const res = await forgotPOST(post({ email: 'mistyped@example.org' }))
    expect(res.status).toBe(200) // same answer either way (no enumeration)
    expect(h.createToken).not.toHaveBeenCalled()
    expect(h.sendReset).not.toHaveBeenCalled()
  })
})

describe('reset-password (flag on)', () => {
  it('a token for a verified address sets the PersonRecord password', async () => {
    h.validateToken.mockResolvedValue({ email: 'primary@example.org' })
    const res = await resetPOST(post({ token: 'token-1', password: 'a long new passphrase' }))
    expect(res.status).toBe(200)
    expect(h.updatePassword).toHaveBeenCalledWith('person-1', 'hash:a long new passphrase')
  })

  it('a token for an UNVERIFIED address never touches the PersonRecord password', async () => {
    // e.g. the controller of the mistyped address reset their own legacy account.
    h.validateToken.mockResolvedValue({ email: 'mistyped@example.org' })
    h.legacyReset.mockResolvedValue(true)
    await resetPOST(post({ token: 'token-1', password: 'attacker passphrase' }))
    expect(h.updatePassword).not.toHaveBeenCalled()
    // Only that address's own legacy record is reset.
    expect(h.legacyReset).toHaveBeenCalledWith('token-1', 'attacker passphrase')
  })
})
