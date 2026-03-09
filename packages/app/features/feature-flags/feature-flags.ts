// Feature flag definitions
// New flags should be added here AND seeded to DynamoDB via the admin UI
export const FEATURE_FLAGS = {
  // Multi-tenant system
  MULTI_TENANT_INIT: 'multi_tenant_init',
} as const

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

// Feature flag configurations
export interface FeatureFlagConfig {
  enabled: boolean
  rolloutPercentage: number
  userRoles?: string[]
  description: string
  environment?: 'development' | 'staging' | 'production' | 'all'
  userOverrides?: Record<string, boolean>
}

/**
 * Default configs used to seed DynamoDB on first load.
 * Runtime source of truth is DynamoDB (via featureFlagRepository).
 * @deprecated For seeding only — do not read from this at runtime.
 */
export const DEFAULT_FEATURE_FLAG_CONFIGS: Record<string, FeatureFlagConfig> = {
  [FEATURE_FLAGS.MULTI_TENANT_INIT]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['owner'],
    description: 'Multi-tenant foundation: ecclesia external links and regional data model',
    environment: 'all',
    userOverrides: {},
  },
}

/**
 * @deprecated Use DEFAULT_FEATURE_FLAG_CONFIGS — this alias is kept for backwards compatibility.
 */
export const featureFlagConfigs: Record<string, FeatureFlagConfig> = DEFAULT_FEATURE_FLAG_CONFIGS
