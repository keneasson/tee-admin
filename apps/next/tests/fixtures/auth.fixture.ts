/**
 * Auth Test Fixtures
 *
 * Mock auth states and user roles for testing role-based access control.
 * Used for both Vitest unit tests and Playwright E2E tests.
 */

// User roles matching the application's role system
export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  GUEST: 'guest',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// ============================================================================
// Mock User Types
// ============================================================================

export interface MockUser {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface MockSession {
  user: MockUser
  expires: string
}

// ============================================================================
// Mock Users for Each Role
// ============================================================================

export const mockOwner: MockUser = {
  id: 'user-owner-1',
  email: 'owner@torontoeast.org',
  name: 'Test Owner',
  role: ROLES.OWNER,
}

export const mockAdmin: MockUser = {
  id: 'user-admin-1',
  email: 'admin@torontoeast.org',
  name: 'Test Admin',
  role: ROLES.ADMIN,
}

export const mockMember: MockUser = {
  id: 'user-member-1',
  email: 'member@torontoeast.org',
  name: 'Test Member',
  role: ROLES.MEMBER,
}

export const mockGuest: MockUser = {
  id: 'user-guest-1',
  email: 'guest@example.com',
  name: 'Test Guest',
  role: ROLES.GUEST,
}

// ============================================================================
// Session Factories
// ============================================================================

const createSession = (user: MockUser): MockSession => ({
  user,
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
})

export const mockOwnerSession = createSession(mockOwner)
export const mockAdminSession = createSession(mockAdmin)
export const mockMemberSession = createSession(mockMember)
export const mockGuestSession = createSession(mockGuest)

// ============================================================================
// Auth State Props for Shared Components
// ============================================================================

/**
 * Props that shared components receive from platform-specific auth hooks.
 * These match the pattern used in packages/ui and packages/app components.
 */
export interface AuthStateProps {
  userRole?: UserRole
  isMemberOrHigher?: boolean
  isAdminOrOwner?: boolean
  isAuthLoading?: boolean
}

export const authStateForOwner: AuthStateProps = {
  userRole: ROLES.OWNER,
  isMemberOrHigher: true,
  isAdminOrOwner: true,
  isAuthLoading: false,
}

export const authStateForAdmin: AuthStateProps = {
  userRole: ROLES.ADMIN,
  isMemberOrHigher: true,
  isAdminOrOwner: true,
  isAuthLoading: false,
}

export const authStateForMember: AuthStateProps = {
  userRole: ROLES.MEMBER,
  isMemberOrHigher: true,
  isAdminOrOwner: false,
  isAuthLoading: false,
}

export const authStateForGuest: AuthStateProps = {
  userRole: ROLES.GUEST,
  isMemberOrHigher: false,
  isAdminOrOwner: false,
  isAuthLoading: false,
}

export const authStateLoading: AuthStateProps = {
  userRole: undefined,
  isMemberOrHigher: false,
  isAdminOrOwner: false,
  isAuthLoading: true,
}

// ============================================================================
// Playwright Auth Helpers
// ============================================================================

/**
 * Script to inject mock auth state for Playwright tests.
 * Use with page.addInitScript() to set auth before page loads.
 */
export const createAuthInjectionScript = (role: UserRole) => `
  window.__TEST_AUTH__ = {
    role: '${role}',
    isMemberOrHigher: ${role === 'member' || role === 'admin' || role === 'owner'},
    isAdminOrOwner: ${role === 'admin' || role === 'owner'},
  };
`

/**
 * Mock session response for intercepting /api/auth/session
 */
export const createMockSessionResponse = (user: MockUser | null) => {
  if (!user) {
    return { user: null }
  }
  return createSession(user)
}

// ============================================================================
// Permission Check Helpers
// ============================================================================

/**
 * Check if a role has member-level access or higher
 */
export const isMemberOrHigher = (role: UserRole): boolean =>
  ([ROLES.MEMBER, ROLES.ADMIN, ROLES.OWNER] as readonly string[]).includes(role)

/**
 * Check if a role has admin-level access or higher
 */
export const isAdminOrOwner = (role: UserRole): boolean =>
  ([ROLES.ADMIN, ROLES.OWNER] as readonly string[]).includes(role)

/**
 * Get all roles that should have access to a given minimum level
 */
export const getRolesWithAccess = (minimumRole: UserRole): UserRole[] => {
  switch (minimumRole) {
    case ROLES.OWNER:
      return [ROLES.OWNER]
    case ROLES.ADMIN:
      return [ROLES.ADMIN, ROLES.OWNER]
    case ROLES.MEMBER:
      return [ROLES.MEMBER, ROLES.ADMIN, ROLES.OWNER]
    case ROLES.GUEST:
      return [ROLES.GUEST, ROLES.MEMBER, ROLES.ADMIN, ROLES.OWNER]
    default:
      return []
  }
}

/**
 * Get all roles that should be blocked from a given minimum level
 */
export const getRolesWithoutAccess = (minimumRole: UserRole): UserRole[] => {
  const allRoles = Object.values(ROLES)
  const withAccess = getRolesWithAccess(minimumRole)
  return allRoles.filter((role) => !withAccess.includes(role))
}

// ============================================================================
// Test Credentials (for E2E login tests)
// ============================================================================

export const testCredentials = {
  owner: {
    email: 'test-owner@torontoeast.org',
    password: 'TestPassword123!',
  },
  admin: {
    email: 'test-admin@torontoeast.org',
    password: 'TestPassword123!',
  },
  member: {
    email: 'test-member@torontoeast.org',
    password: 'TestPassword123!',
  },
  invalid: {
    email: 'nonexistent@example.com',
    password: 'WrongPassword',
  },
}
