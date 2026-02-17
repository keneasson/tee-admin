// Event Management System Types
export type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'baptism' | 'engagement' | 'general' | 'recurring' | 'election-cycle'

// DEPRECATED: Use `active: boolean` instead. Kept for backward compatibility during migration.
export type EventStatus = 'draft' | 'ready' | 'published' | 'archived'

export type LocationMode = 'in-person' | 'online' | 'hybrid'

export type DocumentType = 'upload' | 'google-doc'

export interface DocumentAttachment {
  id: string
  documentType: DocumentType // 'upload' for uploaded files, 'google-doc' for Google Doc links
  fileName: string // For uploads: S3 key; For Google Docs: document ID
  originalName: string // For uploads: original file name; For Google Docs: document title
  fileUrl: string // For uploads: S3 URL; For Google Docs: Google Doc URL
  fileSize: number // For uploads: file size in bytes; For Google Docs: 0
  mimeType: string // For uploads: actual MIME type; For Google Docs: 'application/vnd.google-apps.document'
  uploadedAt: Date
  uploadedBy: string
  description?: string
  editable?: boolean // For Google Docs: whether the title can be edited in the UI
}

// Online meeting information for virtual/hybrid events
export interface OnlineMeetingInfo {
  link: string // Required for online/hybrid events
  meetingId?: string // Optional meeting ID
  password?: string // Optional password/passcode
  platform?: string // e.g., Zoom, Google Meet, Teams
  dialInNumber?: string // Optional phone dial-in
  additionalInfo?: string // Any other relevant info
}

// Location information for events
export interface LocationInfo {
  mode?: LocationMode // 'in-person', 'online', or 'hybrid'
  name?: string // Venue name (e.g., "Anapilis Hall") - user-entered
  placeName?: string // Google Places name - auto-filled, used as fallback for name
  address?: string
  city?: string
  province?: string
  country?: string
  postalCode?: string
  directions?: string
  parkingInfo?: string
  mapsUrl?: string // Google Maps directions link
  lat?: number // Latitude from Google Places
  lng?: number // Longitude from Google Places
  placeId?: string // Google Places ID for future lookups
  onlineMeeting?: OnlineMeetingInfo // For online/hybrid events
}

// Registration information for events
export interface RegistrationInfo {
  required?: boolean | string // true/false or 'true'/'false' for form compatibility
  deadline?: Date
  registrationUrl?: string
  contactEmail?: string
  contactPhone?: string
  hasFee?: boolean
  fee?: number | string // number or string for form compatibility
  paymentInstructions?: string
  notes?: string
}

// Event section for multi-location, multi-day events (e.g., Toronto Fraternal Gathering)
// Each section is a self-contained sub-event with its own title, location, date/time, and schedule items
export interface EventSection {
  id: string                    // UUID, generated on creation
  title: string                 // "Friday Evening", "Saturday Sessions", etc.
  description?: string          // Optional section description/theme
  date?: Date | string          // Section date (ISO string or Date)
  startTime?: string            // e.g., "1:30pm"
  endTime?: string              // e.g., "11:00pm"
  location?: LocationInfo       // Section-specific location
  items: ScheduleItem[]         // Schedule items within this section
}

// Schedule item for study weekends, general events, etc.
export interface ScheduleItem {
  title?: string
  activity?: string // Alternative to title (used in some views)
  day?: string // Day label for grouping (e.g., "Saturday")
  time?: string // Time string (e.g., "7:30pm" or ISO datetime)
  startTime?: Date | string // Start time (Date object or ISO string)
  endTime?: Date | string | null // End time
  description?: string
  type?: string // e.g., 'talk', 'break', 'meal'
  notes?: string
  location?: string | LocationInfo // Optional per-item location override
  speakers?: Array<{
    firstName: string
    lastName: string
  }>
}

// Sponsor for baptism events
export interface Sponsor {
  firstName: string
  lastName: string
  role?: string // e.g., 'proposer', 'seconder'
}

// Reception details for wedding events
export interface ReceptionInfo {
  date?: Date | string
  location?: LocationInfo
  details?: string
}

// Wedding party member
export interface WeddingPartyMember {
  firstName: string
  lastName: string
  role?: string // e.g., 'best man', 'maid of honor', 'bridesmaid', 'groomsman'
}

// Funeral-specific locations (multiple named locations)
export interface FuneralLocations {
  service?: LocationInfo
  viewing?: LocationInfo // Legacy field name
  visitation?: LocationInfo // Preferred field name (replaces viewing)
  burial?: LocationInfo
  graveside?: LocationInfo
}

// Accommodation information for study weekends
export interface AccommodationInfo {
  available?: boolean
  details?: string
  contactInfo?: string
}

// Base event interface - common fields for all event types
export interface BaseEvent {
  id: string
  title: string
  type: EventType
  createdBy: string
  createdAt: Date
  updatedAt: Date

  // Simplified event lifecycle:
  // - active: Is the event visible in newsletter/emails? Simple toggle.
  // - publishDate: When was it activated? Controls duration rules (e.g., "3 weeks from publish").
  active: boolean
  publishDate?: Date

  // DEPRECATED: Replaced by `active`. Kept for backward compatibility during migration.
  // Will be removed in a future version. Use `active` instead.
  published?: boolean
  status?: EventStatus

  description?: string
  featured?: boolean
  membersOnly?: boolean // Restrict event to Toronto East Ecclesia members only
  documents: DocumentAttachment[]
}

// Event type with all possible type-specific fields
export interface Event extends BaseEvent {
  // Study weekend fields
  dateRange?: {
    start: Date
    end: Date
  }
  theme?: string
  speakers?: Array<{
    title?: string
    firstName: string
    lastName: string
    ecclesia?: string
  }>
  schedule?: ScheduleItem[] // Schedule items for study weekends and general events
  sections?: EventSection[] // Multi-section support for multi-location/multi-day events
  accommodation?: AccommodationInfo // Accommodation for study weekends

  // Wedding fields
  ceremonyDate?: Date
  couple?: {
    bride: {
      firstName: string
      lastName: string
    }
    groom: {
      firstName: string
      lastName: string
    }
  }
  ceremonyLocation?: LocationInfo // Ceremony-specific location for weddings
  reception?: ReceptionInfo // Reception details for weddings
  weddingParty?: WeddingPartyMember[] // Wedding party members

  // Engagement fields
  engagementDate?: Date
  engagementProposed?: string // Free-form name text (e.g., "Brother Gord Easson")
  engagementTo?: string // Free-form name text
  engagementAnnouncement?: string // The announcement blurb
  engagementPhoto?: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  }

  // Baptism fields
  baptismDate?: Date
  candidate?: {
    firstName: string
    lastName: string
    testimony?: string
    baptismStatement?: string
  }
  aboutCandidate?: string // Biography/testimony text for the candidate
  candidatePhoto?: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  }
  sponsors?: Sponsor[] // Baptism sponsors (proposer, seconder)
  zoomLink?: string // Online meeting link for baptism events

  // Funeral fields
  serviceDate?: Date
  dateOfPassing?: Date | string // Date the person passed away (internal tracking, not displayed in newsletters)
  deceased?: {
    title?: 'Brother' | 'Sister' | 'Mr.' | 'Mrs.' | 'Ms.' | ''
    firstName: string
    lastName: string
    age?: number // Age at time of passing
    obituary?: string // Obituary text
  }
  aboutDeceased?: string // Biography/tribute text for the deceased
  deceasedPhoto?: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  }
  // Visitation (formerly "viewing")
  visitationDate?: Date | string // Start date/time for visitation (ISO-8601 or YYYY-MM-DD)
  visitationEndDate?: Date | string // End date/time for visitation
  visitationSameLocation?: boolean // Default true - visitation at same location as service
  viewingDate?: Date | string // @deprecated - use visitationDate (kept for backward compatibility)
  // Graveside service
  hasGravesideService?: boolean // Toggle for graveside service
  gravesideDate?: Date | string // Date/time for graveside service
  // Timezone for all funeral times
  eventTimezone?: string // IANA timezone (e.g., 'America/Toronto')
  // Online obituary link (optional, often provided later by executor)
  obituaryUrl?: string // URL to official online obituary
  // Multiple locations: FuneralLocations object for funerals, LocationInfo array for general events
  locations?: FuneralLocations | LocationInfo[]

  // General event fields
  startDate?: Date
  endDate?: Date
  customType?: string

  // Recurring event fields
  recurringConfig?: {
    startDate?: Date
    startTime: string
    endTime?: string
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'custom'
    daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc.
    dateRange?: {
      start: Date
      end: Date
    }
    endDate?: Date
    customDates?: Date[]
    contactPerson?: string
  }

  // Election cycle fields
  electionStartDate?: Date
  electionEndDate?: Date

  // Hosting ecclesia (for most event types)
  hostingEcclesia?: {
    name: string
    province?: string
    city?: string
  }

  // Location details (for all event types)
  location?: LocationInfo

  // Registration details (for events that require registration)
  registration?: RegistrationInfo
}

// Type-specific event aliases for use in type-narrowed contexts
// These represent the Event type when narrowed by type guards
export type StudyWeekendEvent = Event & {
  type: 'study-weekend'
  dateRange: { start: Date; end: Date }
  theme: string
}

export type FuneralEvent = Omit<Event, 'locations'> & {
  type: 'funeral'
  serviceDate: Date
  deceased: {
    title?: 'Brother' | 'Sister' | 'Mr.' | 'Mrs.' | 'Ms.' | ''
    firstName: string
    lastName: string
    age?: number
    obituary?: string
  }
  locations: FuneralLocations
}

export type WeddingEvent = Event & {
  type: 'wedding'
  ceremonyDate: Date
  couple: {
    bride: { firstName: string; lastName: string }
    groom: { firstName: string; lastName: string }
  }
  ceremonyLocation: LocationInfo
}

export type BaptismEvent = Event & {
  type: 'baptism'
  baptismDate: Date
  candidate: {
    firstName: string
    lastName: string
    testimony?: string
    baptismStatement?: string
  }
}

export type GeneralEvent = Event & {
  type: 'general'
}

// Event filtering options for querying events
export interface EventFilters {
  type?: EventType | EventType[]
  dateFrom?: Date
  dateTo?: Date
  published?: boolean
  featured?: boolean
  createdBy?: string
  search?: string
  limit?: number
}

// Paginated event list response
export interface EventListResponse {
  events: Event[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Request type for updating an existing event
export type UpdateEventRequest = Partial<Event> & { id: string }

// Validation result returned by EventValidator
export interface EventValidationResult {
  isValid: boolean
  errors: EventValidationError[]
  warnings: EventValidationError[]
}

// Individual validation error
export interface EventValidationError {
  field: string
  message: string
  code: string
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

export function isEngagementEvent(event: Event): boolean {
  return event.type === 'engagement'
}

export function isBaptismEvent(event: Event): event is BaptismEvent {
  return event.type === 'baptism'
}

export function isGeneralEvent(event: Event): event is GeneralEvent {
  return event.type === 'general'
}

export function isRecurringEvent(event: Event): boolean {
  return event.type === 'recurring'
}

export function isElectionCycleEvent(event: Event): boolean {
  return event.type === 'election-cycle'
}

/**
 * Check if an event is active/visible for newsletter and email display.
 * Handles backward compatibility with legacy `status` and `published` fields.
 *
 * New model: active = true
 * Legacy model: status === 'published' || status === 'ready'
 */
export function isEventActive(event: Partial<Event>): boolean {
  // New model: use `active` directly
  if (typeof event.active === 'boolean') {
    return event.active
  }

  // Legacy fallback: check status
  if (event.status) {
    return event.status === 'published' || event.status === 'ready'
  }

  // Default: not active
  return false
}

/**
 * Normalize an event for the new lifecycle model.
 * Converts legacy status/published fields to the new `active` field.
 */
export function normalizeEventActiveState(event: Partial<Event>): Partial<Event> {
  // If already has `active`, return as-is
  if (typeof event.active === 'boolean') {
    return event
  }

  // Convert from legacy status
  const active = event.status === 'published' || event.status === 'ready'

  return {
    ...event,
    active
  }
}