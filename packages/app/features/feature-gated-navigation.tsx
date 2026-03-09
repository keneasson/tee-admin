'use client'

import React from 'react'
import { SimpleEnhancedNavigation } from './simple-enhanced-navigation'

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
 * Navigation wrapper. Previously feature-gated between legacy and enhanced navigation;
 * enhanced navigation is now the permanent choice (flag removed after 100% rollout).
 */
export const FeatureGatedNavigation: React.FC<FeatureGatedNavigationProps> = ({ children, user, onSignOut }) => {
  return <SimpleEnhancedNavigation user={user} onSignOut={onSignOut}>{children}</SimpleEnhancedNavigation>
}
