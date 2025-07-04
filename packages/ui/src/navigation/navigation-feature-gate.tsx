'use client'

import React from 'react'
import { useFeatureFlag } from '@my/app/features/feature-flags'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

interface NavigationFeatureGateProps {
  /** Children to render when new navigation is enabled */
  children: React.ReactNode
  /** Fallback to render when new navigation is disabled */
  fallback: React.ReactNode
  /** Whether to force enable new navigation (for testing) */
  forceEnable?: boolean
  /** Whether to force disable new navigation (for testing) */
  forceDisable?: boolean
}

export function NavigationFeatureGate({
  children,
  fallback,
  forceEnable = false,
  forceDisable = false
}: NavigationFeatureGateProps) {
  const isNewNavigationEnabled = useFeatureFlag(FEATURE_FLAGS.NEW_NAVIGATION_DESIGN)
  
  // Handle force overrides for testing
  if (forceDisable) {
    return <>{fallback}</>
  }
  
  if (forceEnable || isNewNavigationEnabled) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}

// Convenience hook for checking navigation feature flag
export function useNewNavigationDesign() {
  return useFeatureFlag(FEATURE_FLAGS.NEW_NAVIGATION_DESIGN)
}

// Higher-order component for wrapping navigation components
export function withNewNavigationFeature<P extends object>(
  NewComponent: React.ComponentType<P>,
  LegacyComponent: React.ComponentType<P>
) {
  return function NavigationFeatureWrapper(props: P) {
    return (
      <NavigationFeatureGate fallback={<LegacyComponent {...props} />}>
        <NewComponent {...props} />
      </NavigationFeatureGate>
    )
  }
}

// Enhanced navigation button that uses feature gate
export function FeatureGatedNavigationButton(props: any) {
  const { EnhancedNavigationButton } = require('./enhanced-navigation-button')
  const { NavigationButtonItem } = require('../navigation-button-item')
  
  return (
    <NavigationFeatureGate fallback={<NavigationButtonItem {...props} />}>
      <EnhancedNavigationButton
        onPress={props.linkTo}
        text={props.text}
        active={props.active}
        {...props}
      />
    </NavigationFeatureGate>
  )
}