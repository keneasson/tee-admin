'use client'

import React from 'react'

interface NavigationFeatureGateProps {
  /** Children to render (enhanced navigation — now always active) */
  children: React.ReactNode
  /** Fallback kept for API compatibility but never rendered */
  fallback: React.ReactNode
  forceEnable?: boolean
  forceDisable?: boolean
}

/**
 * Navigation feature gate — enhanced navigation is now permanent.
 * This component is kept for API compatibility with navigation-showcase.
 */
export function NavigationFeatureGate({
  children,
  fallback,
  forceDisable = false,
}: NavigationFeatureGateProps) {
  if (forceDisable) {
    return <>{fallback}</>
  }
  return <>{children}</>
}

export function useNewNavigationDesign() {
  return true
}

export function withNewNavigationFeature<P extends object>(
  NewComponent: React.ComponentType<P>,
  _LegacyComponent: React.ComponentType<P>
) {
  return function NavigationFeatureWrapper(props: P) {
    return <NewComponent {...props} />
  }
}
