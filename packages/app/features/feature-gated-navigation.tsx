'use client'

import React from 'react'
import { SimpleEnhancedNavigation } from './simple-enhanced-navigation'

type UserSession = {
  name?: string | null
  email?: string | null
  role?: string
  /** Signed-in user's home ecclesia, surfaced in the navigation header */
  ecclesia?: string | null
  /** Recording Brother designation — grants content-manager nav access */
  isRecordingBrother?: boolean
}

type FeatureGatedNavigationProps = {
  children: React.ReactNode
  /** User session data passed from platform-specific auth */
  user?: UserSession | null
  /** Sign out function passed from platform-specific auth */
  onSignOut?: () => void
  /** Unread notification count (feature-flagged) */
  notificationCount?: number
  /** Handler when bell icon is pressed */
  onNotificationPress?: () => void
}

/**
 * Navigation wrapper. Previously feature-gated between legacy and enhanced navigation;
 * enhanced navigation is now the permanent choice (flag removed after 100% rollout).
 */
export const FeatureGatedNavigation: React.FC<FeatureGatedNavigationProps> = ({ children, user, onSignOut, notificationCount, onNotificationPress }) => {
  return (
    <SimpleEnhancedNavigation
      user={user}
      onSignOut={onSignOut}
      notificationCount={notificationCount}
      onNotificationPress={onNotificationPress}
    >
      {children}
    </SimpleEnhancedNavigation>
  )
}
