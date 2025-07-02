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
  if (config.userRoles && session?.user?.role) {
    if (!config.userRoles.includes(session.user.role)) {
      return false
    }
  }
  
  // Check rollout percentage
  if (config.rolloutPercentage === 0) {
    return false
  }
  
  if (config.rolloutPercentage === 100) {
    return true
  }
  
  // Use deterministic percentage based on user ID
  if (session?.user?.email) {
    const hash = simpleHash(session.user.email)
    const userPercentage = hash % 100
    return userPercentage < config.rolloutPercentage
  }
  
  return false
}

// Simple hash function for deterministic user bucketing
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export function useFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = Object.keys(featureFlagConfigs) as FeatureFlag[]
  
  const flagStates = flags.reduce((acc, flag) => {
    acc[flag] = useFeatureFlag(flag)
    return acc
  }, {} as Record<FeatureFlag, boolean>)
  
  return flagStates
}