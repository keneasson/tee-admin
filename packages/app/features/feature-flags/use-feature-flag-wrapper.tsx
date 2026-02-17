'use client'

import { featureFlagConfigs, type FeatureFlag } from './feature-flags'
import { AuthSession } from '@my/app/types'

/**
 * Check if a feature flag is enabled for a given session
 * This is a pure function that can be used in any context
 * Session data must be provided by the caller
 */
export function checkFeatureFlag(flag: FeatureFlag, session: AuthSession | null): boolean {
  const config = featureFlagConfigs[flag]

  if (!config.enabled) {
    return false
  }

  // Check environment
  if (config.environment && config.environment !== 'all') {
    const currentEnv = process.env.NODE_ENV as 'development' | 'staging' | 'production'
    if (config.environment !== currentEnv) {
      return false
    }
  }

  // Check user role
  if (config.userRoles && config.userRoles.length > 0 && session?.user?.role) {
    if (!config.userRoles.includes(session.user.role)) {
      return false
    }
  }

  // Check rollout percentage
  if (config.rolloutPercentage && config.rolloutPercentage < 100) {
    // Use email as user identifier if id is not available
    const userId = (session?.user as any)?.id || session?.user?.email
    if (!userId) {
      return false
    }

    // Create a deterministic hash based on user ID and flag name
    const hash = simpleHash(`${userId}-${flag}`)
    const userPercentile = hash % 100

    if (userPercentile >= config.rolloutPercentage) {
      return false
    }
  }

  // Check user-specific overrides
  if (config.userOverrides && session?.user?.email) {
    const override = config.userOverrides[session.user.email]
    if (override !== undefined) {
      return override
    }
  }

  return true
}

/**
 * @deprecated Use checkFeatureFlag instead with session passed as parameter
 * This hook is preserved for backward compatibility but should not be used
 * in shared packages as it creates platform dependencies
 */
export function useFeatureFlag(flag: FeatureFlag, session: AuthSession | null): boolean {
  return checkFeatureFlag(flag, session)
}

// Simple hash function for rollout percentage calculation
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}