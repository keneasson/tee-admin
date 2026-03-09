// Feature flag definitions
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

export const featureFlagConfigs: Record<FeatureFlag, FeatureFlagConfig> = {
  [FEATURE_FLAGS.MULTI_TENANT_INIT]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['owner'],
    description: 'Multi-tenant foundation: ecclesia external links and regional data model',
    environment: 'all',
    userOverrides: {},
  },
}