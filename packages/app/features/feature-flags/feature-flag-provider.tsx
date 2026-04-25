'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useFeatureFlags } from './use-feature-flag'
import { type FeatureFlag } from './feature-flags'

interface FeatureFlagContextType {
  flags: Record<FeatureFlag, boolean>
  isEnabled: (flag: FeatureFlag) => boolean
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined)

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const flags = useFeatureFlags()
  const isEnabled = (flag: FeatureFlag): boolean => flags[flag] || false

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

export function useFeatureFlagContext(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext)
  if (context === undefined) {
    throw new Error('useFeatureFlagContext must be used within a FeatureFlagProvider')
  }
  return context
}
