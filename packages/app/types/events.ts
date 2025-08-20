// Event Management System Types
// Based on the comprehensive event management system requirements

export type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'baptism' | 'general' | 'recurring'
export type EventStatus = 'draft' | 'published' | 'archived'

// Newsletter content with character guidance
export interface NewsletterContent {
  emailSummary?: string    // 80-150 chars: Include date, location, key action
  webSummary?: string      // 150-300 chars: Add context, why it matters  
  socialSummary?: string   // 120-280 chars: For social sharing
  
  // Media selection for different contexts
  emailImage?: string      // Single optimized image for email
  galleryImages?: string[] // 3-5 images for newsletter/web
  
  // Call-to-action customization
  emailCTA?: {
    text: string          // "Register Now", "Full Details", "Learn More"
    url?: string          // Custom URL, defaults to event page
    style: 'primary' | 'secondary' | 'outline'
  }
  
  // Content freshness
  lastFeatured?: Date      // When this event was last in newsletter
  newsletterPriority?: number // 1-10, higher = more important
}

// SEO and sharing metadata
export interface EventMetadata {
  slug?: string            // SEO-friendly URL slug, auto-generated from title
  slugLocked?: boolean     // True after first save, prevents editing
  
  metaDescription?: string // Auto-generated from summaries if not provided
  socialImage?: string     // Open Graph image
  
  // Privacy and access control
  isPrivate?: boolean      // Requires login to view
  requiresAuth?: boolean   // Set automatically based on event type
}

// Base event interface - common fields for all event types
export interface BaseEvent {
  id: string
  title: string
  type: EventType
  createdBy: string
  createdAt: Date
  updatedAt: Date
  publishDate?: Date
  published: boolean
  status: EventStatus
  description?: string
  featured?: boolean
  
  // Newsletter integration
  newsletter?: NewsletterContent
  
  // SEO and routing
  metadata?: EventMetadata
}

// Common components that can be added to events
export interface LocationDetails {
  name: string
  address: string
  city: string
  province: string
  country?: string
  postalCode?: string
  directions?: string
  parkingInfo?: string
}

// Hosting ecclesia with location information
export interface HostingEcclesiaDetails {
  name: string
  city?: string
  province?: string
  country?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
}

export interface PersonDetails {
  firstName: string
  lastName: string
  title?: string
  bio?: string
  email?: string
  phone?: string
}

export interface Speaker {
  firstName: string
  lastName: string
  ecclesia: string
}

export interface DocumentAttachment {
  id: string
  fileName: string
  originalName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  uploadedAt: Date
  uploadedBy: string
  description?: string
}

export interface RegistrationDetails {
  required: boolean
  deadline?: Date
  maxAttendees?: number
  currentAttendees?: number
  fee?: number
  currency?: string
  paymentInstructions?: string
  contactEmail?: string
  contactPhone?: string
  registrationUrl?: string
  notes?: string
}

export interface ScheduleItem {
  id: string
  title: string
  startTime: Date
  endTime?: Date
  description?: string
  location?: LocationDetails
  speakers?: Speaker[]
  type: 'talk' | 'meal' | 'activity' | 'break' | 'service' | 'other'
  notes?: string
}

// Discriminated union for different event types
export interface StudyWeekendEvent extends BaseEvent {
  type: 'study-weekend'
  dateRange: {
    start: Date
    end: Date
  }
  hostingEcclesia: HostingEcclesiaDetails
  location: LocationDetails
  theme: string
  speakers: Speaker[]
  schedule: ScheduleItem[]
  registration?: RegistrationDetails
  documents: DocumentAttachment[]
  accommodation?: {
    available: boolean
    details?: string
    contactInfo?: string
  }
  meals?: {
    provided: boolean
    details?: string
    dietaryNotes?: string
  }
}

export interface FuneralEvent extends BaseEvent {
  type: 'funeral'
  serviceDate: Date
  viewingDate?: Date
  deceased: PersonDetails & {
    dateOfBirth?: Date
    dateOfDeath?: Date
    age?: number
    obituary?: string
  }
  locations: {
    viewing?: LocationDetails
    service: LocationDetails
    burial?: LocationDetails
  }
  serviceDetails?: {
    officiant?: PersonDetails
    speakers?: Speaker[]
    readings?: string[]
    hymns?: string[]
  }
  familyContact?: PersonDetails
  documents: DocumentAttachment[]
}

export interface WeddingEvent extends BaseEvent {
  type: 'wedding'
  ceremonyDate: Date
  hostingEcclesia: HostingEcclesiaDetails
  ceremonyLocation: LocationDetails
  couple: {
    bride: PersonDetails
    groom: PersonDetails
  }
  reception?: {
    date?: Date
    location?: LocationDetails
    details?: string
  }
  serviceDetails?: {
    officiant?: PersonDetails
    speakers?: Speaker[]
    readings?: string[]
    hymns?: string[]
  }
  documents: DocumentAttachment[]
}

export interface BaptismEvent extends BaseEvent {
  type: 'baptism'
  baptismDate: Date
  candidate: PersonDetails & {
    testimony?: string
    baptismStatement?: string
  }
  hostingEcclesia: HostingEcclesiaDetails
  location: LocationDetails
  serviceDetails?: {
    officiant?: PersonDetails
    assistants?: PersonDetails[]
    witnessingSpeakers?: Speaker[]
    readings?: string[]
    hymns?: string[]
  }
  zoomLink?: string
  documents: DocumentAttachment[]
}

export interface GeneralEvent extends BaseEvent {
  type: 'general'
  customType?: string
  startDate?: Date
  endDate?: Date
  hostingEcclesia?: HostingEcclesiaDetails
  location?: LocationDetails
  speakers?: Speaker[]
  schedule?: ScheduleItem[]
  registration?: RegistrationDetails
  documents: DocumentAttachment[]
  customFields?: Record<string, any>
}

// Recurring Events - for ongoing activities like Bible seminars
export interface RecurringEventException {
  id: string
  type: 'pause' | 'cancel' | 'reschedule'
  startDate: Date
  endDate?: Date  // If null, applies to single instance only
  reason?: string
  notes?: string
  rescheduleDate?: Date
  rescheduleTime?: string
  rescheduleLocation?: string
}

export interface RecurringEventConfig {
  daysOfWeek: number[]  // 0 = Sunday, 1 = Monday, etc.
  startTime: string     // "19:00" format
  endTime: string       // "20:30" format
  frequency: 'weekly' | 'biweekly' | 'monthly'
  startDate: Date       // When this recurring event starts
  endDate?: Date        // Optional end date
  exceptions: RecurringEventException[]
  location?: string
  description?: string
  contactPerson?: string
}

export interface RecurringEvent extends BaseEvent {
  type: 'recurring'
  recurringConfig: RecurringEventConfig
  hostingEcclesia?: HostingEcclesiaDetails
  location?: LocationDetails
  contactPerson?: PersonDetails
  documents: DocumentAttachment[]
}

// Union type for all events
export type Event = StudyWeekendEvent | FuneralEvent | WeddingEvent | BaptismEvent | GeneralEvent | RecurringEvent

// Event creation/update DTOs
export interface CreateEventRequest {
  title: string
  type: EventType
  publishDate?: Date
  description?: string
}

export interface UpdateEventRequest extends Partial<Omit<Event, 'id' | 'createdAt' | 'createdBy'>> {
  id: string
}

// Event query/filter types
export interface EventFilters {
  type?: EventType | EventType[]
  status?: EventStatus | EventStatus[]
  published?: boolean
  featured?: boolean
  dateFrom?: Date
  dateTo?: Date
  createdBy?: string
  search?: string
}

export interface EventListResponse {
  events: Event[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Event component types for progressive form building
export type EventComponent = 
  | 'date-time'
  | 'location'
  | 'speaker'
  | 'schedule-item'
  | 'registration'
  | 'document'
  | 'description'
  | 'custom-field'

export interface EventComponentConfig {
  id: string
  type: EventComponent
  title: string
  required: boolean
  order: number
  data: any
}

// Type guards for discriminated unions
export function isStudyWeekendEvent(event: Event): event is StudyWeekendEvent {
  return event.type === 'study-weekend'
}

export function isFuneralEvent(event: Event): event is FuneralEvent {
  return event.type === 'funeral'
}

export function isWeddingEvent(event: Event): event is WeddingEvent {
  return event.type === 'wedding'
}

export function isBaptismEvent(event: Event): event is BaptismEvent {
  return event.type === 'baptism'
}

export function isGeneralEvent(event: Event): event is GeneralEvent {
  return event.type === 'general'
}

export function isRecurringEvent(event: Event): event is RecurringEvent {
  return event.type === 'recurring'
}

// Event validation helpers
export interface EventValidationError {
  field: string
  message: string
  code: string
}

export interface EventValidationResult {
  isValid: boolean
  errors: EventValidationError[]
  warnings?: EventValidationError[]
}

// Event permissions
export interface EventPermissions {
  canView: boolean
  canEdit: boolean
  canDelete: boolean
  canPublish: boolean
  canManageDocuments: boolean
}

// Newsletter content guidance and helpers
export interface ContentGuidance {
  type: 'email' | 'web' | 'social'
  minChars: number
  maxChars: number
  guidance: string
  placeholder: string
}

export const NEWS_CONTENT_GUIDANCE: Record<string, ContentGuidance> = {
  email: {
    type: 'email',
    minChars: 80,
    maxChars: 150,
    guidance: 'Include date, location, and key action. Keep it scannable.',
    placeholder: 'Toronto East Bible School - March 15-17, 2025. Register by March 1st...'
  },
  web: {
    type: 'web', 
    minChars: 150,
    maxChars: 300,
    guidance: 'Add context and why it matters. Full paragraph format.',
    placeholder: 'Join us for our annual Bible School exploring themes of faith and community...'
  },
  social: {
    type: 'social',
    minChars: 120,
    maxChars: 280,
    guidance: 'Compelling hook for social media sharing.',
    placeholder: 'Discover deeper faith at our March Bible School. Registration now open!'
  }
}

// Slug generation and validation helpers
export class EventSlugHelper {
  static generateSlug(title: string, eventDate?: Date): string {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')         // Replace spaces with hyphens
      .replace(/-+/g, '-')          // Replace multiple hyphens with single
      .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
    
    // Add year if event has a date
    if (eventDate) {
      const year = new Date(eventDate).getFullYear()
      return `${baseSlug}-${year}`
    }
    
    return baseSlug
  }
  
  static validateSlug(slug: string): { isValid: boolean; error?: string } {
    if (!slug || slug.length < 3) {
      return { isValid: false, error: 'Slug must be at least 3 characters long' }
    }
    
    if (slug.length > 100) {
      return { isValid: false, error: 'Slug cannot exceed 100 characters' }
    }
    
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return { isValid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' }
    }
    
    if (slug.startsWith('-') || slug.endsWith('-')) {
      return { isValid: false, error: 'Slug cannot start or end with a hyphen' }
    }
    
    return { isValid: true }
  }

  static shouldUsePrivateSlug(eventType: EventType): boolean {
    // Personal events default to private (UUID slug)
    return ['funeral', 'wedding', 'baptism'].includes(eventType)
  }
}

// Content length analysis helpers
export class ContentAnalyzer {
  static analyzeLength(content: string, guidance: ContentGuidance): {
    length: number
    status: 'too_short' | 'optimal' | 'too_long'
    message: string
    remaining?: number
  } {
    const length = content.length
    
    if (length < guidance.minChars) {
      return {
        length,
        status: 'too_short',
        message: `Add ${guidance.minChars - length} more characters`,
        remaining: guidance.minChars - length
      }
    }
    
    if (length > guidance.maxChars) {
      return {
        length,
        status: 'too_long', 
        message: `Remove ${length - guidance.maxChars} characters`,
        remaining: guidance.maxChars - length
      }
    }
    
    return {
      length,
      status: 'optimal',
      message: `Perfect length for ${guidance.type}`,
      remaining: guidance.maxChars - length
    }
  }
  
  static suggestSummary(fullContent: string, type: 'email' | 'web' | 'social'): string {
    const guidance = NEWS_CONTENT_GUIDANCE[type]
    const sentences = fullContent.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    let summary = ''
    for (const sentence of sentences) {
      const potential = summary + sentence.trim() + '. '
      if (potential.length <= guidance.maxChars) {
        summary = potential
      } else {
        break
      }
    }
    
    return summary.trim()
  }
}