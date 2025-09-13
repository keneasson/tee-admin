import { featureFlagConfigs, type FeatureFlag } from './feature-flags'

// Server-safe feature flag hook - just check config during build
export function useFeatureFlag(flag: FeatureFlag): boolean {
  const config = featureFlagConfigs[flag]
  
  if (!config.enabled) {
    return false
  }
  
  // For build-time, just return enabled state
  // Runtime checks will be handled by the components that use this
  return true
}

export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = Object.keys(featureFlagConfigs) as FeatureFlag[]
  
  const flagStates = flags.reduce((acc, flag) => {
    acc[flag] = useFeatureFlag(flag)
    return acc
  }, {} as Record<FeatureFlag, boolean>)
  
  return flagStates
}