import { DEFAULT_FEATURE_FLAG_CONFIGS, type FeatureFlag } from './feature-flags'

/**
 * Build-time feature flag check for shared packages.
 * Returns true if the flag exists in defaults (feature is being developed).
 * For runtime session-aware checks, use checkFeatureFlag from use-feature-flag-wrapper.
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return flag in DEFAULT_FEATURE_FLAG_CONFIGS
}

export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = Object.keys(DEFAULT_FEATURE_FLAG_CONFIGS) as FeatureFlag[]
  return flags.reduce((acc, flag) => {
    acc[flag] = true
    return acc
  }, {} as Record<FeatureFlag, boolean>)
}
