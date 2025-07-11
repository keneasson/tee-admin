// Feature flag definitions
export const FEATURE_FLAGS = {
  // Brand system features
  NEW_BRAND_COLORS: 'new_brand_colors',
  NEW_NAVIGATION_DESIGN: 'new_navigation_design',
  ENHANCED_TYPOGRAPHY: 'enhanced_typography',
  
  // Component features
  NEW_FORM_COMPONENTS: 'new_form_components',
  IMPROVED_BUTTONS: 'improved_buttons',
  ENHANCED_TABLES: 'enhanced_tables',
  
  // Email system
  NEW_EMAIL_TEMPLATES: 'new_email_templates',
  EMAIL_BRAND_INTEGRATION: 'email_brand_integration',
  
  // Development features
  COMPONENT_PLAYGROUND: 'component_playground',
  BRAND_SYSTEM_ACCESS: 'brand_system_access',
} as const

export type FeatureFlag = typeof FEATURE_FLAGS[keyof typeof FEATURE_FLAGS]

// Feature flag configurations
export interface FeatureFlagConfig {
  enabled: boolean
  rolloutPercentage: number
  userRoles?: string[]
  description: string
  environment?: 'development' | 'staging' | 'production' | 'all'
}

export const featureFlagConfigs: Record<FeatureFlag, FeatureFlagConfig> = {
  [FEATURE_FLAGS.NEW_BRAND_COLORS]: {
    enabled: true,
    rolloutPercentage: 100,
    userRoles: [], // Available to all users
    description: 'New accessible brand color palette',
    environment: 'all'
  },
  
  [FEATURE_FLAGS.NEW_NAVIGATION_DESIGN]: {
    enabled: true,
    rolloutPercentage: 100,
    userRoles: [], // Available to all users
    description: 'Enhanced navigation system with brand colors, mobile responsiveness, and improved UX',
    environment: 'all'
  },
  
  [FEATURE_FLAGS.ENHANCED_TYPOGRAPHY]: {
    enabled: true,
    rolloutPercentage: 100,
    userRoles: [], // Available to all users
    description: 'Enhanced typography system with better hierarchy',
    environment: 'all'
  },
  
  [FEATURE_FLAGS.NEW_FORM_COMPONENTS]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['admin', 'owner'],
    description: 'Improved form components with better accessibility',
    environment: 'development'
  },
  
  [FEATURE_FLAGS.IMPROVED_BUTTONS]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['admin', 'owner'],
    description: 'Enhanced button variants with brand colors',
    environment: 'development'
  },
  
  [FEATURE_FLAGS.ENHANCED_TABLES]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['admin', 'owner'],
    description: 'Better table components with improved styling',
    environment: 'development'
  },
  
  [FEATURE_FLAGS.NEW_EMAIL_TEMPLATES]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['admin', 'owner'],
    description: 'Email templates using brand color system',
    environment: 'development'
  },
  
  [FEATURE_FLAGS.EMAIL_BRAND_INTEGRATION]: {
    enabled: true,
    rolloutPercentage: 0,
    userRoles: ['admin', 'owner'],
    description: 'Integrate email colors with brand palette',
    environment: 'development'
  },
  
  [FEATURE_FLAGS.COMPONENT_PLAYGROUND]: {
    enabled: true,
    rolloutPercentage: 100,
    userRoles: ['admin', 'owner'],
    description: 'Component testing playground in brand system',
    environment: 'all'
  },
  
  [FEATURE_FLAGS.BRAND_SYSTEM_ACCESS]: {
    enabled: true,
    rolloutPercentage: 100,
    userRoles: ['admin', 'owner'],
    description: 'Access to brand system routes',
    environment: 'all'
  },
}