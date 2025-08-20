// Newsletter Rules Configuration Types
export interface NewsletterRules {
  version: string
  lastUpdated: string
  description: string
  mandatoryContent: MandatoryContent
  eventTypes: Record<string, EventTypeRule>
  contentOrdering: string[]
  displayRules: DisplayRules
  validation: ValidationRules
  emailSettings: EmailSettings
  fallbackRules: FallbackRules
}

export interface MandatoryContent {
  sunday: {
    memorial: MemorialRules
    sundaySchool: SundaySchoolRules
  }
  bibleClass: BibleClassRules
  standingEvents: Record<string, StandingEventRule>
}

export interface MemorialRules {
  alwaysInclude: boolean
  time: string
  requiredFields: string[]
  exceptions: ServiceException[]
}

export interface SundaySchoolRules {
  schedule: string
  time: string
  requiredFields: string[]
  seasonalRules: {
    active: SeasonalRule
    inactive: SeasonalRule
  }
}

export interface BibleClassRules {
  alwaysInclude: boolean
  schedule: string
  platform: string
  requiredFields: string[]
  defaultLocation: string
}

export interface StandingEventRule {
  title: string
  schedule: string
  description: string
  alwaysInclude: boolean
  priority: number
}

export interface ServiceException {
  reason: string
  alternateMessage: string
  datePattern: string
}

export interface SeasonalRule {
  months: number[]
  message: string
}

export interface EventTypeRule {
  displayDuration: DisplayDuration
  priority: number
  includeInSummary: boolean
  maxSummaryLength?: number
  showFullContent: boolean
  requiresCTA: boolean
  ctaText?: string
}

export type DisplayDuration = 
  | 'until_event_date'
  | '1_week_after_event'
  | '2_weeks_after_event'
  | '3_weeks_after_event'
  | '3_weeks_from_first_inclusion'
  | '3_weeks_or_until_event_date'
  | 'custom'

export interface DisplayRules {
  bibleReadings: BibleReadingsDisplay
  eventSummary: EventSummaryDisplay
}

export interface BibleReadingsDisplay {
  startDay: 'friday' | 'saturday' | 'sunday' | 'monday'
  daysToShow: number
  format: 'table' | 'list'
  columns: string[]
  mobileFormat: 'stacked' | 'condensed'
}

export interface EventSummaryDisplay {
  truncateAt: string
  truncationSuffix: string
  linkText: string
}

export interface ValidationRules {
  requiredFields: Record<string, string[]>
  notifications: NotificationRules
  completenessThresholds: CompletenessThresholds
}

export interface NotificationRules {
  missingFields: NotificationRule
  unusualPatterns: UnusualPatternsRule
}

export interface NotificationRule {
  enabled: boolean
  method: 'email_admin' | 'slack' | 'dashboard'
  threshold: 'any_missing' | 'critical_only'
}

export interface UnusualPatternsRule extends NotificationRule {
  patterns: string[]
}

export interface CompletenessThresholds {
  excellent: number
  good: number
  acceptable: number
  poor: number
}

export interface EmailSettings {
  maxTotalLength: number
  sectionsMaxLength: Record<string, number>
  formatting: EmailFormatting
}

export interface EmailFormatting {
  useHtml: boolean
  includeImages: boolean
  responsive: boolean
}

export interface FallbackRules {
  missingData: Record<string, string>
  dataSourceFailure: DataSourceFallback
}

export interface DataSourceFallback {
  primary: 'dynamodb' | 'google_sheets'
  fallback: 'dynamodb' | 'google_sheets'
  emergency: 'manual_override'
}

// Newsletter Assembly Types
export interface NewsletterAssembly {
  id: string
  date: Date
  assemblyDate: Date
  status: AssemblyStatus
  content: AssembledContent
  overrides: CurationOverride[]
  validation: AssemblyValidation
  reviewedBy?: string
  reviewedAt?: Date
  approvedBy?: string
  approvedAt?: Date
  sentAt?: Date
}

export type AssemblyStatus = 'auto_generated' | 'under_review' | 'approved' | 'sent' | 'failed'

export interface AssembledContent {
  regularServices: RegularServices
  events: AssembledEvent[]
  standingContent: StandingContent[]
  dailyReadings: DailyReading[]
}

export interface RegularServices {
  thisWeek: {
    sunday: {
      memorial?: MemorialService
      sundaySchool?: SundaySchoolService
    }
    bibleClass?: BibleClassService
  }
  nextWeek: {
    sunday: {
      memorial?: MemorialService
      sundaySchool?: SundaySchoolService
    }
    bibleClass?: BibleClassService
  }
}

export interface MemorialService {
  date: Date
  preside: string
  exhort: string
  organist: string
  steward: string
  doorkeeper: string
  collection?: string
  lunch?: string
  hymns?: {
    opening: string
    exhortation: string
    memorial: string
    closing: string
  }
  readings?: {
    reading1: string
    reading2: string
  }
  specialEvents?: string
  isException?: boolean
  exceptionMessage?: string
}

export interface SundaySchoolService {
  date: Date
  refreshments: string
  notes?: string
  specialEvents?: string
  isActive: boolean // Based on seasonal rules
  inactiveMessage?: string
}

export interface BibleClassService {
  date: Date
  speaker: string
  topic: string
  presider?: string
  notes?: string
  location: string
}

export interface AssembledEvent {
  eventId: string
  title: string
  type: string
  priority: number
  eventDate?: Date
  
  // Content Format
  displayType: 'summary' | 'full' | 'title_only'
  content: string
  summary?: string
  ctaButton?: {
    text: string
    url: string
  }
  
  // Assembly Metadata
  includedByRule: string
  overriddenByUser: boolean
  firstIncludedDate?: Date
  displayUntilDate?: Date
}

export interface StandingContent {
  id: string
  title: string
  schedule: string
  description: string
  priority: number
  alwaysInclude: boolean
}

export interface DailyReading {
  date: Date
  dayName: string
  reading1: string
  reading2: string
  reading3: string
}

export interface CurationOverride {
  type: 'remove_event' | 'add_event' | 'reorder' | 'edit_summary' | 'add_custom'
  eventId?: string
  customContent?: string
  newSummary?: string
  newOrder?: number[]
  reason: string
  appliedBy: string
  appliedAt: Date
}

export interface AssemblyValidation {
  completenessScore: number
  missingFields: ValidationError[]
  warnings: string[]
  readyToSend: boolean
  lastValidated: Date
}

export interface ValidationError {
  field: string
  service: string
  severity: 'error' | 'warning' | 'info'
  message: string
}

// Newsletter Assembly Context
export interface NewsletterAssemblyContext {
  rules: NewsletterRules
  currentDate: Date
  newsletterDate: Date
  dataSource: 'production' | 'test' | 'fallback'
}

// Event Duration Calculation
export interface EventDurationContext {
  event: any // Will be typed properly when integrating with Event types
  rule: EventTypeRule
  currentDate: Date
  firstIncludedDate?: Date
}

export interface DurationCalculationResult {
  shouldInclude: boolean
  displayUntilDate?: Date
  reason: string
}