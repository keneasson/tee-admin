// Newsletter Assembly System - Core Components
export * from './rules-validator'
export * from './event-duration'
export * from './content-ordering'
export * from './validation-notifications'
export * from './services-integration'

// Re-export types for convenience
export type {
  NewsletterRules,
  EventTypeRule,
  DisplayDuration,
  NewsletterAssembly,
  AssembledContent,
  AssembledEvent,
  RegularServices,
  ValidationError,
  AssemblyValidation,
  DurationCalculationResult,
  EmailSection
} from '@my/app/types/newsletter-rules'
