import { describe, it, expect } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  checkFeatureFlag,
} from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import {
  DEFAULT_FEATURE_FLAG_CONFIGS,
  type FeatureFlagConfig,
} from '@my/app/features/feature-flags/feature-flags'

/**
 * Regression guard for the "code default doesn't apply until a DB row exists"
 * footgun. getAllCached() now merges DEFAULT_FEATURE_FLAG_CONFIGS *under* the
 * DB rows, so a flag whose code default targets (e.g.) 'owner' resolves for the
 * owner even when the DB has no row for it — while a DB row still wins per flag.
 *
 * These tests exercise the resolution logic (checkFeatureFlag) against the
 * shape getAllCached() produces: { ...defaults, ...dbConfigs }.
 */

const OWNER = { user: { email: 'owner@tee-admin.com', role: ROLES.OWNER } } as any
const MEMBER = { user: { email: 'm@x.com', role: ROLES.MEMBER } } as any

// Simulates getAllCached()'s merge: code defaults as fallback, DB rows override.
function mergedConfigs(
  dbConfigs: Record<string, FeatureFlagConfig> = {}
): Record<string, FeatureFlagConfig> {
  return { ...DEFAULT_FEATURE_FLAG_CONFIGS, ...dbConfigs }
}

describe('feature flag default fallback (merge with DB configs)', () => {
  it('resolves an owner-default flag for the owner when the DB has NO row for it', () => {
    // Emulate a DB that holds *other* flags but not SECURE_EMAIL_CHANGE.
    const configs = mergedConfigs({
      some_other_flag: { description: 'x', visibleTo: 'off', users: [] },
    })

    // Code default for secure_email_change is 'owner'.
    expect(configs['secure_email_change']?.visibleTo).toBe('owner')
    expect(checkFeatureFlag('secure_email_change', OWNER, configs)).toBe(true)
    expect(checkFeatureFlag('secure_email_change', MEMBER, configs)).toBe(false)
  })

  it('lets a DB row OVERRIDE the code default (per flag)', () => {
    // DB row turns an owner-default flag OFF for everyone.
    const configs = mergedConfigs({
      secure_email_change: { description: 'db override', visibleTo: 'off', users: [] },
    })

    expect(configs['secure_email_change']?.visibleTo).toBe('off')
    expect(checkFeatureFlag('secure_email_change', OWNER, configs)).toBe(false)
  })

  it('lets a DB row PROMOTE a code default (e.g. off → everyone)', () => {
    const configs = mergedConfigs({
      universal_email_login: {
        description: 'db override',
        visibleTo: 'everyone',
        users: [],
      },
    })

    // Code default is 'off'; DB row promotes it to everyone.
    expect(DEFAULT_FEATURE_FLAG_CONFIGS['universal_email_login']?.visibleTo).toBe('off')
    expect(checkFeatureFlag('universal_email_login', MEMBER, configs)).toBe(true)
  })

  it('still returns false for a flag absent from BOTH defaults and DB', () => {
    expect(checkFeatureFlag('nonexistent_flag', OWNER, mergedConfigs())).toBe(false)
  })
})
