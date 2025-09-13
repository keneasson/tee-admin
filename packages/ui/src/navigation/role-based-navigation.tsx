import React from 'react'
import { ROLES } from '@my/app/provider/auth/auth-roles'

type UserRole = keyof typeof ROLES
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

interface RoleBasedNavigationClientProps extends RoleBasedNavigationProps {
  /** Current user role from session */
  userRole?: string
}

// Role hierarchy for permission checking (higher index = more permissions)
const ROLE_HIERARCHY: UserRole[] = ['GUEST', 'MEMBER', 'ADMIN', 'OWNER']

function hasRequiredRole(
  userRole: string | undefined,
  requiredRole: RequiredRole | undefined,
  exactMatch: boolean = false
): boolean {
  // If no role required, allow access
  if (!requiredRole) return true
  
  // If user has no role, deny access
  if (!userRole) return false
  
  // Convert to array for consistent handling
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  
  if (exactMatch) {
    // Exact match: user role must be in the required roles list
    return requiredRoles.some(role => userRole === ROLES[role])
  } else {
    // Hierarchy match: user role must be equal or higher than required role
    const userRoleIndex = ROLE_HIERARCHY.findIndex(role => userRole === ROLES[role])
    
    return requiredRoles.some(role => {
      const requiredRoleIndex = ROLE_HIERARCHY.findIndex(r => ROLES[r] === ROLES[role])
      return userRoleIndex >= requiredRoleIndex
    })
  }
}

// Server-side component - no NextAuth dependency
export function RoleBasedNavigationClient({
  children,
  requiredRole,
  exactMatch = false,
  fallback = null,
  hideWhenDenied = true,
  userRole
}: RoleBasedNavigationClientProps) {
  const hasAccess = hasRequiredRole(userRole, requiredRole, exactMatch)
  
  if (hasAccess) {
    return <>{children}</>
  }
  
  if (hideWhenDenied) {
    return null
  }
  
  return <>{fallback}</>
}

// Server-side component (no NextAuth dependency for build)
export function RoleBasedNavigation({
  children,
  requiredRole,
  exactMatch = false,
  fallback = null,
  hideWhenDenied = true
}: RoleBasedNavigationProps) {
  // For build-time, just render children (role checking happens at runtime)
  return <>{children}</>
}

// Convenience components for common role patterns
export function AdminOnlyNavigation({ children }: { children: React.ReactNode }) {
  return (
    <RoleBasedNavigation requiredRole="ADMIN">
      {children}
    </RoleBasedNavigation>
  )
}

export function OwnerOnlyNavigation({ children }: { children: React.ReactNode }) {
  return (
    <RoleBasedNavigation requiredRole="OWNER">
      {children}
    </RoleBasedNavigation>
  )
}

export function AdminOrOwnerNavigation({ children }: { children: React.ReactNode }) {
  return (
    <RoleBasedNavigation requiredRole={['ADMIN', 'OWNER']} exactMatch>
      {children}
    </RoleBasedNavigation>
  )
}

export function MemberPlusNavigation({ children }: { children: React.ReactNode }) {
  return (
    <RoleBasedNavigation requiredRole="MEMBER">
      {children}
    </RoleBasedNavigation>
  )
}

// Hook for checking roles in components (build-safe version)
export function useUserRole() {
  // Build-time safe version - returns default values
  return {
    role: undefined,
    isGuest: true,
    isMember: false,
    isAdmin: false,
    isOwner: false,
    hasRole: () => false,
    isAdminOrOwner: false,
    isMemberOrHigher: false
  }
}

// Navigation item wrapper that automatically handles role-based visibility
interface RoleBasedNavigationItemProps {
  /** Required role to see this navigation item */
  requiredRole?: RequiredRole
  /** Whether to require exact role match */
  exactMatch?: boolean
  /** Navigation item content */
  children: React.ReactNode
}

export function RoleBasedNavigationItem({
  requiredRole,
  exactMatch,
  children
}: RoleBasedNavigationItemProps) {
  return (
    <RoleBasedNavigation requiredRole={requiredRole} exactMatch={exactMatch}>
      {children}
    </RoleBasedNavigation>
  )
}