'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { RoleBasedNavigationClient } from './role-based-navigation'

type UserRole = 'GUEST' | 'MEMBER' | 'ADMIN' | 'OWNER'
type RequiredRole = UserRole | UserRole[]

interface RoleBasedNavigationProps {
  /** Child components to render if user has required role */
  children: React.ReactNode
  /** Required role(s) to view this navigation item */
  requiredRole?: RequiredRole
  /** Whether to require exact role match or allow higher roles */
  exactMatch?: boolean
  /** Fallback component to render if user doesn't have access */
  fallback?: React.ReactNode
  /** Whether to hide completely (true) or show fallback (false) when access denied */
  hideWhenDenied?: boolean
}

export function RoleBasedNavigationWrapper(props: RoleBasedNavigationProps) {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  
  return (
    <RoleBasedNavigationClient
      {...props}
      userRole={userRole}
    />
  )
}

// Hook for checking roles in components
export function useUserRole() {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  
  const hasRequiredRole = (
    requiredRole: RequiredRole | undefined,
    exactMatch: boolean = false
  ): boolean => {
    // Role hierarchy for permission checking (higher index = more permissions)
    const ROLE_HIERARCHY: UserRole[] = ['GUEST', 'MEMBER', 'ADMIN', 'OWNER']
    
    // If no role required, allow access
    if (!requiredRole) return true
    
    // If user has no role, deny access
    if (!userRole) return false
    
    // Convert to array for consistent handling
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    
    if (exactMatch) {
      // Exact match: user role must be in the required roles array
      return requiredRoles.includes(userRole as UserRole)
    } else {
      // Hierarchical match: user role must be at or above the minimum required role
      const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole as UserRole)
      const minRequiredIndex = Math.min(
        ...requiredRoles.map(role => ROLE_HIERARCHY.indexOf(role))
      )
      return userRoleIndex >= minRequiredIndex
    }
  }
  
  return {
    role: userRole,
    isGuest: userRole === 'GUEST',
    isMember: userRole === 'MEMBER',
    isAdmin: userRole === 'ADMIN',
    isOwner: userRole === 'OWNER',
    hasRole: hasRequiredRole,
    isAdminOrOwner: userRole === 'ADMIN' || userRole === 'OWNER',
    isMemberOrHigher: hasRequiredRole('MEMBER', false)
  }
}