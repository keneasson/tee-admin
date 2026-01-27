'use client'

import React from 'react'
import { useFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { SimpleEnhancedNavigation } from './simple-enhanced-navigation'
import { WithNavigation } from './with-navigation'

type UserSession = {
  name?: string | null
  email?: string | null
  role?: string
}

type FeatureGatedNavigationProps = {
  children: React.ReactNode
  /** User session data passed from platform-specific auth */
  user?: UserSession | null
  /** Sign out function passed from platform-specific auth */
  onSignOut?: () => void
}

/**
 * Feature-gated navigation wrapper that switches between legacy and enhanced navigation
 * based on the NEW_NAVIGATION_DESIGN feature flag.
 *
 * This allows us to safely test the new navigation in development while keeping
 * the existing navigation as fallback.
 */
export const FeatureGatedNavigation: React.FC<FeatureGatedNavigationProps> = ({ children, user, onSignOut }) => {
  const isEnhancedNavigationEnabled = useFeatureFlag(FEATURE_FLAGS.NEW_NAVIGATION_DESIGN)

  if (isEnhancedNavigationEnabled) {
    return <SimpleEnhancedNavigation user={user} onSignOut={onSignOut}>{children}</SimpleEnhancedNavigation>
  }

  // Fallback to legacy navigation
  return <WithNavigation user={user} onSignOut={onSignOut}>{children}</WithNavigation>
}