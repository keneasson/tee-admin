// Newsletter Assembly System - Core Components
export * from './rules-validator'
export * from './event-duration'
export * from './content-ordering'
export * from './validation-notifications'
export * from './assembly-processor'
export * from './services-integration'
export * from './preview-generator'

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

export type {
  NewsletterPreview,
  EmailPreview,
  WebPreview,
  PlainTextPreview,
  NewsletterMetadata,
  PreviewFormat
} from './preview-generator'