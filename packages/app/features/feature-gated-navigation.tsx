'use client'

import React from 'react'
import { useFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { SimpleEnhancedNavigation } from './simple-enhanced-navigation'
import { WithNavigation } from './with-navigation'

type FeatureGatedNavigationProps = {
  children: React.ReactNode
}

/**
 * Feature-gated navigation wrapper that switches between legacy and enhanced navigation
 * based on the NEW_NAVIGATION_DESIGN feature flag.
 * 
 * This allows us to safely test the new navigation in development while keeping
 * the existing navigation as fallback.
 */
export const FeatureGatedNavigation: React.FC<FeatureGatedNavigationProps> = ({ children }) => {
  const isEnhancedNavigationEnabled = useFeatureFlag(FEATURE_FLAGS.NEW_NAVIGATION_DESIGN)
  
  if (isEnhancedNavigationEnabled) {
    return <SimpleEnhancedNavigation>{children}</SimpleEnhancedNavigation>
  }
  
  // Fallback to legacy navigation
  return <WithNavigation>{children}</WithNavigation>
}