'use client'

import { useSession } from 'next-auth/react'

type UserRole = 'GUEST' | 'MEMBER' | 'ADMIN' | 'OWNER'
type RequiredRole = UserRole | UserRole[]

// Hook for checking roles in Next.js components
export function useUserRole() {
  const { data: session, status } = useSession()
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

    // Normalize to uppercase for case-insensitive comparison
    const normalizedUserRole = (userRole as string).toUpperCase() as UserRole

    // Convert to array for consistent handling
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    const normalizedRequiredRoles = requiredRoles.map(role => role.toUpperCase() as UserRole)

    if (exactMatch) {
      // Exact match: user role must be in the required roles array
      return normalizedRequiredRoles.includes(normalizedUserRole)
    } else {
      // Hierarchical match: user role must be at or above the minimum required role
      const userRoleIndex = ROLE_HIERARCHY.indexOf(normalizedUserRole)
      const minRequiredIndex = Math.min(
        ...normalizedRequiredRoles.map(role => ROLE_HIERARCHY.indexOf(role))
      )
      return userRoleIndex >= minRequiredIndex
    }
  }

  const normalizedRole = userRole ? (userRole as string).toUpperCase() : undefined

  return {
    role: userRole,
    status, // 'loading' | 'authenticated' | 'unauthenticated'
    isLoading: status === 'loading',
    isGuest: normalizedRole === 'GUEST',
    isMember: normalizedRole === 'MEMBER',
    isAdmin: normalizedRole === 'ADMIN',
    isOwner: normalizedRole === 'OWNER',
    hasRole: hasRequiredRole,
    isAdminOrOwner: normalizedRole === 'ADMIN' || normalizedRole === 'OWNER',
    isMemberOrHigher: hasRequiredRole('MEMBER', false)
  }
}
