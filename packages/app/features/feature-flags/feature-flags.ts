// Feature flag definitions
// Each flag gates an unreleased feature. When released, remove the flag from code.
export const FEATURE_FLAGS = {
  MULTI_TENANT_INIT: 'multi_tenant_init',
  IN_APP_NOTIFICATIONS: 'in_app_notifications',
  UNIVERSAL_EMAIL_LOGIN: 'universal_email_login',
  CONSOLIDATED_CMS: 'consolidated_cms',
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
  [FEATURE_FLAGS.UNIVERSAL_EMAIL_LOGIN]: {
    // Send-path behaviour gate. Read globally with a null session, so it is ON
    // only when set to 'everyone'. Default 'off' → emails render byte-for-byte
    // as before until deliberately enabled.
    description: 'Add a per-recipient one-click sign-in link to the footer of every outgoing email',
    visibleTo: 'off',
    users: [],
  },
  [FEATURE_FLAGS.CONSOLIDATED_CMS]: {
    // Unified Post model (epic #131) Phase 0. Gates the block-model read boundary
    // (legacyToPost + redactPost) at public read paths. OFF by default → existing
    // response shape/format is byte-identical; flip to 'everyone' to ship the
    // stricter anon-PII scrub to all readers.
    description: 'Unified Post model: block-based PII redaction at public read boundaries',
    visibleTo: 'owner',
    users: [],
  },
}
