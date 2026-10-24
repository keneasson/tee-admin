// Feature flag definitions
// Each flag gates an unreleased feature. When released, remove the flag from code.
export const FEATURE_FLAGS = {
  MULTI_TENANT_INIT: 'multi_tenant_init',
  UNIVERSAL_EMAIL_LOGIN: 'universal_email_login',
  CONSOLIDATED_CMS: 'consolidated_cms',
  SECURE_EMAIL_CHANGE: 'secure_email_change',
  PEOPLE_INDEX_SIGNIN: 'people_index_signin',
  INTER_ECCLESIA_FROM_OFFICES: 'inter_ecclesia_from_offices',
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
  [FEATURE_FLAGS.SECURE_EMAIL_CHANGE]: {
    // Launch-dark security feature. Read server-side with the request session; the
    // email-change/start + confirm + undo routes 404 while this is 'off', so the
    // endpoints stay invisible until deliberately enabled. Now 'owner' so it can be
    // exercised in prod behind the flag (still dark for everyone else, including
    // admins and members).
    description: 'Secure self-serve login-email change (fresh-auth step-up + confirmation code)',
    visibleTo: 'owner',
    users: [],
  },
  [FEATURE_FLAGS.PEOPLE_INDEX_SIGNIN]: {
    // Sign-in path gate (#275). Read globally with a null session, so it is ON
    // only at 'everyone'. Off → the Recording Brother check for a brand-new
    // address keeps the legacy table Scan; on → the RB-email index entry
    // (one Query). Flip only after the people-index backfill has run.
    description: 'Sign-in: Recording Brother check via the people index instead of a table Scan',
    visibleTo: 'off',
    users: [],
  },
  [FEATURE_FLAGS.INTER_ECCLESIA_FROM_OFFICES]: {
    // Send-path gate (R3). Read globally with a null session, so it is ON only
    // at 'everyone'. Off → inter-ecclesia sends go to the interEcclesia
    // registry list (its SUB# rows), exactly as today. On → recipients are
    // the Recording Brother offices' addresses (Reps don't receive it). Also
    // needs the offices-assigned marker. Flip only after the owner has
    // reviewed scripts/diff-inter-ecclesia-recipients.ts.
    description: 'Inter-ecclesia sends: recipients from Recording Brother offices instead of the registry list',
    visibleTo: 'off',
    users: [],
  },
}
