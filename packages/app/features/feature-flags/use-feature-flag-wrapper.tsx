import { type FeatureFlagConfig } from './feature-flags'
import { AuthSession } from '@my/app/types'

const OWNER_ROLE = 'owner'
const ADMIN_ROLE = 'admin'

/**
 * Check if a feature flag is visible to the given user.
 *
 * Logic:
 * 1. User email in `users` list → yes
 * 2. `visibleTo` === 'everyone' → yes
 * 3. `visibleTo` === 'admin' and user is admin or owner → yes
 * 4. User is owner → yes
 * 5. Otherwise → no
 */
export function checkFeatureFlag(
  flag: string,
  session: AuthSession | null,
  configs?: Record<string, FeatureFlagConfig>
): boolean {
  const config = configs?.[flag]
  if (!config) return false

  // 0. Off — disabled for everyone, including owner
  if (config.visibleTo === 'off') {
    return false
  }

  const userEmail = session?.user?.email?.toLowerCase()
  const userRole = session?.user?.role?.toLowerCase()

  // 1. User in explicit users list
  if (userEmail && config.users.some((u) => u.toLowerCase() === userEmail)) {
    return true
  }

  // 2. Released to everyone
  if (config.visibleTo === 'everyone') {
    return true
  }

  // 3. Visible to admins
  if (config.visibleTo === 'admin' && (userRole === ADMIN_ROLE || userRole === OWNER_ROLE)) {
    return true
  }

  // 4. Owner always sees
  if (userRole === OWNER_ROLE) {
    return true
  }

  return false
}

/**
 * Server-side async check that reads from DynamoDB cache.
 * Use this in API routes and server components.
 */
export async function checkFeatureFlagFromDB(
  flag: string,
  session: AuthSession | null
): Promise<boolean> {
  try {
    const { featureFlagRepository } = await import('@my/app/provider/dynamodb/repositories/feature-flag-repository')
    const configs = await featureFlagRepository.getAllCached()
    return checkFeatureFlag(flag, session, configs)
  } catch (error) {
    console.error('Failed to load feature flags from DynamoDB:', error)
    return false
  }
}
