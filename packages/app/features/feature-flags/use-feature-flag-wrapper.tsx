'use client'

import { featureFlagConfigs, type FeatureFlag, type FeatureFlagConfig } from './feature-flags'
import { AuthSession } from '@my/app/types'

/**
 * Check if a feature flag is enabled for a given session.
 * Pure function — works with any configs map (DynamoDB-backed or hardcoded fallback).
 *
 * @param flag - The flag name to check
 * @param session - Current user session
 * @param configs - Optional configs map. If omitted, falls back to hardcoded defaults.
 */
export function checkFeatureFlag(
  flag: string,
  session: AuthSession | null,
  configs?: Record<string, FeatureFlagConfig>
): boolean {
  const allConfigs = configs || featureFlagConfigs
  const config = allConfigs[flag]

  if (!config || !config.enabled) {
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

  // Check user-specific overrides (before rollout percentage so overrides bypass 0% rollout)
  if (config.userOverrides && session?.user?.email) {
    const override = config.userOverrides[session.user.email]
    if (override !== undefined) {
      return override
    }
  }

  // Check rollout percentage
  if (config.rolloutPercentage !== undefined && config.rolloutPercentage < 100) {
    const userId = (session?.user as any)?.id || session?.user?.email
    if (!userId) {
      return false
    }

    const hash = simpleHash(`${userId}-${flag}`)
    const userPercentile = hash % 100

    if (userPercentile >= config.rolloutPercentage) {
      return false
    }
  }

  return true
}

/**
 * Server-side async check that reads from DynamoDB cache.
 * Use this in API routes and server components.
 */
export async function checkFeatureFlagFromDB(
  flag: string,
  session: AuthSession | null
): Promise<boolean> {
  try {
    const { featureFlagRepository } = await import('@my/app/provider/dynamodb/repositories/feature-flag-repository')
    const configs = await featureFlagRepository.getAllCached()
    return checkFeatureFlag(flag, session, configs)
  } catch (error) {
    // Fallback to hardcoded defaults if DynamoDB is unavailable
    console.error('Failed to load feature flags from DynamoDB, using defaults:', error)
    return checkFeatureFlag(flag, session)
  }
}

/**
 * @deprecated Use checkFeatureFlag instead with session passed as parameter
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
