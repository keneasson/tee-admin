// Feature flag definitions
// Each flag gates an unreleased feature. When released, remove the flag from code.
export const FEATURE_FLAGS = {
  MULTI_TENANT_INIT: 'multi_tenant_init',
  IN_APP_NOTIFICATIONS: 'in_app_notifications',
} as const

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

// Visibility tiers for feature rollout
export type FlagVisibility = 'off' | 'owner' | 'admin' | 'everyone'

// Feature flag config — stored in DynamoDB
export interface FeatureFlagConfig {
  description: string
  visibleTo: FlagVisibility
  users: string[]   // specific emails that can see this feature regardless of role
}

/**
 * Default configs used to seed DynamoDB on first load.
 * Runtime source of truth is DynamoDB (via featureFlagRepository).
 */
export const DEFAULT_FEATURE_FLAG_CONFIGS: Record<string, FeatureFlagConfig> = {
  [FEATURE_FLAGS.MULTI_TENANT_INIT]: {
    description: 'Multi-tenant foundation: ecclesia external links and regional data model',
    visibleTo: 'owner',
    users: [],
  },
  [FEATURE_FLAGS.IN_APP_NOTIFICATIONS]: {
    description: 'In-app notification bell and notifications page',
    visibleTo: 'owner',
    users: [],
  },
}
