import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Default privacy: your own ecclesia can see you.
 *
 * Every field used to default to `private`, and only 28 of ~700 people had ever
 * opened the settings — so for everybody else the directory showed a member
 * nothing at all, and community confirmation of a contact change was impossible
 * because you cannot vouch for an address you are not allowed to see.
 *
 * These tests pin both halves of the fix: the default is ecclesia-visible, AND
 * "same ecclesia" means a MEMBER of it, so flipping the default did not hand the
 * directory to any account that signs up.
 */

const h = vi.hoisted(() => ({ isConnected: vi.fn() }))

vi.mock('@my/app/provider/dynamodb/repositories/connection-repository', () => ({
  connectionRepository: { isConnected: h.isConnected },
}))

// A static import is fine: `vi.mock` is hoisted above it, so the connection
// repository is already stubbed when this module is evaluated.
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'

const TEE = 'Toronto East Ecclesia'
const OTHER = 'Hamilton Ecclesia'

/** Nobody in these tests has stored settings, so the default is what applies. */
beforeEach(() => {
  h.isConnected.mockReset()
  h.isConnected.mockResolvedValue(false)
  vi.spyOn(privacyRepository as never as { get: () => unknown }, 'get').mockResolvedValue(
    undefined as never
  )
})

describe('the default when somebody has never opened privacy settings', () => {
  it('is ecclesia-visible on every field, not private', async () => {
    const s = await privacyRepository.getPrivacySettings('nobody@example.com')
    expect(s.showName).toBe('ecclesia_and_connections')
    expect(s.showPhone).toBe('ecclesia_and_connections')
    expect(s.showAddress).toBe('ecclesia_and_connections')
    expect(s.showEmail).toBe('ecclesia_and_connections')
    expect(s.showFamily).toBe('ecclesia_and_connections')
  })

  it('lets a member of the same ecclesia see a brother they look up', async () => {
    const fields = await privacyRepository.getVisibleFields(
      'viewer@x.z',
      'target@x.z',
      TEE,
      TEE,
      'member'
    )
    expect(fields.canViewName).toBe(true)
    expect(fields.canViewPhone).toBe(true)
    expect(fields.canViewAddress).toBe(true)
    expect(fields.canViewFamily).toBe(true)
  })

  it('is what makes a member able to confirm a change — they can see the address', async () => {
    // The whole point: a member with no sight of the address could never vouch
    // for it, so the "2 member confirmations" rule had no surface to happen on.
    expect(
      await privacyRepository.canViewField('viewer@x.z', 'target@x.z', 'showAddress', TEE, TEE, 'member')
    ).toBe(true)
  })
})

describe('what the new default deliberately does NOT open up', () => {
  it('a member of another ecclesia still sees nothing', async () => {
    const fields = await privacyRepository.getVisibleFields(
      'viewer@x.z',
      'target@x.z',
      OTHER,
      TEE,
      'member'
    )
    expect(fields.canViewAddress).toBe(false)
    expect(fields.canViewPhone).toBe(false)
    expect(fields.canViewName).toBe(false)
  })

  it('a GUEST account in the same ecclesia sees nothing', async () => {
    // A guest carries an ecclesia on its profile but has no standing to read
    // the directory. Without this, flipping the default would have exposed
    // every contact detail to anybody who registered.
    const fields = await privacyRepository.getVisibleFields(
      'guest@x.z',
      'target@x.z',
      TEE,
      TEE,
      'guest'
    )
    expect(fields.canViewAddress).toBe(false)
    expect(fields.canViewPhone).toBe(false)
  })

  it('an account with no role at all is treated as a guest', async () => {
    const fields = await privacyRepository.getVisibleFields(
      'unknown@x.z',
      'target@x.z',
      TEE,
      TEE,
      undefined
    )
    expect(fields.canViewAddress).toBe(false)
  })

  it('a suspicious account gets nothing, same ecclesia or not', async () => {
    const fields = await privacyRepository.getVisibleFields(
      'flagged@x.z',
      'target@x.z',
      TEE,
      TEE,
      'suspicious'
    )
    expect(fields.canViewAddress).toBe(false)
  })

  it('a guest can still see someone who explicitly connected with them', async () => {
    // Connections are a personal act of sharing and are unaffected by standing.
    h.isConnected.mockResolvedValue(true)
    expect(
      await privacyRepository.canViewField('guest@x.z', 'target@x.z', 'showPhone', TEE, TEE, 'guest')
    ).toBe(true)
  })
})

describe('an explicit choice still beats the default', () => {
  it('a stored `private` stays private to their own ecclesia', async () => {
    vi.spyOn(privacyRepository as never as { get: () => unknown }, 'get').mockResolvedValue({
      pkey: 'USER#target@x.z',
      skey: 'PRIVACY_SETTINGS',
      showName: 'private',
      showPhone: 'private',
      showAddress: 'private',
      showEmail: 'private',
      showFamily: 'private',
      allowContactRequests: true,
    } as never)

    const fields = await privacyRepository.getVisibleFields(
      'viewer@x.z',
      'target@x.z',
      TEE,
      TEE,
      'member'
    )
    expect(fields.canViewAddress).toBe(false)
    expect(fields.canViewPhone).toBe(false)
    // Still reachable — a private profile offers a contact request, not silence.
    expect(fields.canRequestContact).toBe(true)
  })

  it('the elevated roles keep seeing their own ecclesia regardless of settings', async () => {
    vi.spyOn(privacyRepository as never as { get: () => unknown }, 'get').mockResolvedValue({
      showName: 'private',
      showPhone: 'private',
      showAddress: 'private',
      showEmail: 'private',
      showFamily: 'private',
      allowContactRequests: true,
    } as never)

    for (const role of ['recorder', 'rep', 'admin']) {
      expect(
        await privacyRepository.canViewField('rb@x.z', 'target@x.z', 'showAddress', TEE, TEE, role)
      ).toBe(true)
    }
    // Owner is platform-wide, so not ecclesia-bound.
    expect(
      await privacyRepository.canViewField('owner@x.z', 'target@x.z', 'showAddress', OTHER, TEE, 'owner')
    ).toBe(true)
  })
})
