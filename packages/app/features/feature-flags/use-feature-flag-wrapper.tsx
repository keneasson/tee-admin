'use client'

import { useSession } from 'next-auth/react'
import { featureFlagConfigs, type FeatureFlag } from './feature-flags'

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const { data: session } = useSession()
  
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
    if (!session?.user?.id) {
      return false
    }
    
    // Create a deterministic hash based on user ID and flag name
    const hash = simpleHash(`${session.user.id}-${flag}`)
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