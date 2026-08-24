// Event Management System Types
export type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'baptism' | 'engagement' | 'general' | 'recurring' | 'election-cycle'

// DEPRECATED: Use `active: boolean` instead. Kept for backward compatibility during migration.
export type EventStatus = 'draft' | 'ready' | 'published' | 'archived'

export type LocationMode = 'in-person' | 'online' | 'hybrid'

export type EventSharingScope = 'own' | 'region' | 'global'

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
  thumbnailUrl?: string // For PDFs: server-generated JPEG preview of page 1 (best-effort)
}

/**
 * Pick the best "poster" preview image from a set of attachments, for cards and
 * email where there's no room to render a full document. Prefers a real image;
 * falls back to a PDF's generated page-1 thumbnail. Returns undefined when no
 * attachment can stand in as a preview.
 */
export function getPreviewImageUrl(
  documents: DocumentAttachment[] | undefined
): string | undefined {
  if (!documents?.length) return undefined
  const image = documents.find((doc) => doc.mimeType?.startsWith('image/'))
  if (image) return image.fileUrl
  const pdfThumb = documents.find(
    (doc) => doc.mimeType === 'application/pdf' && doc.thumbnailUrl
  )
  return pdfThumb?.thumbnailUrl
}

// Online meeting information for virtual/hybrid events
export interface OnlineMeetingInfo {
  link: string // Required for online/hybrid events
  meetingId?: string // Optional meeting ID
  password?: string // Optional password/passcode
  platform?: string // e.g., 'zoom', 'google-meet', 'teams', 'webex', 'custom-stream'
  dialInNumber?: string // Optional phone dial-in
  additionalInfo?: string // Any other relevant info
}

/** Map platform value → human-readable display name */
export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  'zoom': 'Zoom',
  'google-meet': 'Google Meet',
  'teams': 'Microsoft Teams',
  'webex': 'Webex',
  'custom-stream': 'Video Stream',
  'other': 'Video Stream', // Legacy value migration
}

/** Get display name for a platform, falling back to the raw value */
export const getPlatformDisplayName = (platform: string | undefined): string => {
  if (!platform) return ''
  return PLATFORM_DISPLAY_NAMES[platform] || platform
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

  // ── Event Lifecycle ──────────────────────────────────────────────────
  //
  // `publishDate` is the SINGLE SOURCE OF TRUTH for event visibility:
  //
  //   null / undefined → Inactive (never activated, or deactivated)
  //   Past or now      → Active — visible to public, duration rules start from this date
  //   Future           → Scheduled — not visible yet, becomes active when date arrives
  //
  // UI actions:
  //   "Activate"     → set publishDate = new Date()
  //   "Deactivate"   → set publishDate = null
  //   "Schedule for" → set publishDate = futureDate
  //
  // All visibility checks go through `isEventActive(event)`.
  // ────────────────────────────────────────────────────────────────────

  publishDate?: Date

  /**
   * @deprecated Since March 2026. Use `publishDate` instead.
   *
   * Was a boolean toggle for visibility. Now derived from `publishDate`:
   *   publishDate <= now  → active = true
   *   publishDate is null → active = false
   *   publishDate > now   → active = false (scheduled)
   *
   * `isEventActive()` handles backward compat: if `publishDate` is not set,
   * falls back to checking `active`, then legacy `status`/`published`.
   *
   * CLEANUP: Safe to remove once all DynamoDB EVENT# records have been
   * backfilled with `publishDate`. Run a one-time migration script that sets
   * `publishDate = updatedAt` for records where `active === true` and
   * `publishDate` is missing, then remove this field and the legacy fallback
   * in `isEventActive()`.
   */
  active: boolean

  /**
   * @deprecated Since July 2025. Replaced by `active`, which is itself
   * deprecated in favor of `publishDate`. Legacy chain:
   *   status === 'published' | 'ready' → active = true → publishDate = <date>
   *
   * CLEANUP: Same migration as `active` above. Remove alongside `active`.
   */
  published?: boolean
  /** @deprecated See `published` above. */
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
  candidates?: Array<{ firstName: string; lastName: string }> // Multiple baptism candidates (e.g. double baptism); falls back to [candidate]
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
  hideDates?: boolean // When true, suppress date display in newsletter, events list, detail view, and emails

  /**
   * "No in-person services" notice shown in the newsletter/recap emails and app UI
   * when this event replaces cancelled in-person Sunday services. Set by the admin
   * in the Event Editor. When unset, templates fall back to
   * DEFAULT_NO_IN_PERSON_SERVICES_MESSAGE (see config/service-messages.ts). Issue #45:
   * un-hardcodes the message from the templates so wording changes need no deploy.
   */
  noInPersonServicesMessage?: string

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

  // Multi-tenant event sharing
  sharingScope?: EventSharingScope

  /**
   * Ecclesia that OWNS this event for authorization (who may edit/delete it).
   * Distinct from `hostingEcclesia` (a display field). Set server-side from the
   * validated authoring context on create; legacy events without it fall back to
   * hostingEcclesia?.name then the home ecclesia.
   */
  ownerEcclesia?: string
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
  candidates?: Array<{ firstName: string; lastName: string }>
}

// --- Baptism candidate helpers (backward-compatible with single `candidate`) ---

/**
 * Returns the list of baptism candidates for an event.
 * Prefers the `candidates` array (rows that have a name); falls back to the
 * single legacy `candidate` when the array is empty; otherwise returns [].
 */
export function getBaptismCandidates(
  event: {
    candidate?: { firstName?: string; lastName?: string } | null
    candidates?: Array<{ firstName?: string; lastName?: string }> | null
  } | null | undefined
): Array<{ firstName: string; lastName: string }> {
  const hasName = (c?: { firstName?: string; lastName?: string } | null) =>
    !!c && !!((c.firstName || '').trim() || (c.lastName || '').trim())

  const fromArray = (event?.candidates || [])
    .filter(hasName)
    .map((c) => ({ firstName: c.firstName || '', lastName: c.lastName || '' }))
  if (fromArray.length > 0) {
    return fromArray
  }

  if (hasName(event?.candidate)) {
    return [
      {
        firstName: event!.candidate!.firstName || '',
        lastName: event!.candidate!.lastName || '',
      },
    ]
  }

  return []
}

/**
 * Joins candidate full names into a human-readable string:
 * 0 -> '', 1 -> "First Last", 2 -> "A and B", 3+ -> "A, B and C".
 */
export function formatCandidateNames(
  cands: Array<{ firstName?: string; lastName?: string }> | null | undefined
): string {
  const names = (cands || [])
    .map((c) => `${c.firstName || ''} ${c.lastName || ''}`.trim())
    .filter((n) => n.length > 0)

  if (names.length === 0) {
    return ''
  }
  if (names.length === 1) {
    return names[0]
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
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
 * Check if an event is currently active/visible.
 *
 * Source of truth: `publishDate`
 *   - null/undefined → Inactive
 *   - Past or now    → Active (visible to public)
 *   - Future         → Scheduled (not visible yet)
 *
 * Backward compatibility fallback chain (for records without publishDate):
 *   1. `active === true` → treat as active (deprecated boolean)
 *   2. `status === 'published' | 'ready'` → treat as active (legacy)
 *
 * @deprecated fallback logic — once all EVENT# records are backfilled with
 * `publishDate`, remove the `active` and `status` fallbacks. See BaseEvent
 * type for migration instructions.
 */
export function isEventActive(event: Partial<Event>): boolean {
  // PRIMARY: publishDate is the source of truth
  if (event.publishDate) {
    const publishTime = new Date(event.publishDate).getTime()
    if (!isNaN(publishTime)) {
      return publishTime <= Date.now()
    }
  }

  // FALLBACK 1: deprecated `active` boolean (records not yet migrated)
  if (typeof event.active === 'boolean') {
    return event.active
  }

  // FALLBACK 2: legacy `status` field (oldest records)
  if (event.status) {
    return event.status === 'published' || event.status === 'ready'
  }

  return false
}

/**
 * Check if an event is scheduled for future activation.
 * Returns true if publishDate is set and in the future.
 */
export function isEventScheduled(event: Partial<Event>): boolean {
  if (!event.publishDate) return false
  const publishTime = new Date(event.publishDate).getTime()
  return !isNaN(publishTime) && publishTime > Date.now()
}

/**
 * Get the effective activation date of an event.
 * Returns the publishDate if set, or falls back to createdAt/updatedAt
 * for legacy records that were active but had no publishDate.
 *
 * Used by newsletter duration rules (e.g., "show for 3 weeks from activation").
 */
export function getEventActivationDate(event: Partial<Event>): Date | null {
  if (event.publishDate) {
    const d = new Date(event.publishDate)
    if (!isNaN(d.getTime())) return d
  }

  // Legacy fallback: if event was active, use updatedAt or createdAt
  if (event.active === true || event.status === 'published' || event.status === 'ready') {
    if (event.updatedAt) {
      const d = new Date(event.updatedAt)
      if (!isNaN(d.getTime())) return d
    }
    if (event.createdAt) {
      const d = new Date(event.createdAt)
      if (!isNaN(d.getTime())) return d
    }
  }

  return null
}

/**
 * @deprecated Since March 2026. No longer needed — `publishDate` replaces `active`.
 *
 * Was used to convert legacy status/published fields to the `active` boolean.
 * Now that `publishDate` is the source of truth, normalization should set
 * `publishDate` instead. See `normalizeToPublishDate()`.
 *
 * CLEANUP: Remove once all callers are updated to use `normalizeToPublishDate()`.
 */
export function normalizeEventActiveState(event: Partial<Event>): Partial<Event> {
  if (typeof event.active === 'boolean') {
    return event
  }
  const active = event.status === 'published' || event.status === 'ready'
  return { ...event, active }
}

/**
 * Normalize a legacy event to use `publishDate` as source of truth.
 *
 * For records that have `active: true` or `status: 'published'/'ready'`
 * but no `publishDate`, sets `publishDate` to `updatedAt` or `createdAt`.
 *
 * Use this in a one-time migration script to backfill all EVENT# records,
 * after which the `active`, `published`, and `status` fields can be removed.
 */
export function normalizeToPublishDate(event: Partial<Event>): Partial<Event> {
  // Already has publishDate — nothing to do
  if (event.publishDate) return event

  // Check if event was active under old model
  const wasActive =
    event.active === true ||
    event.status === 'published' ||
    event.status === 'ready'

  if (!wasActive) return event

  // Set publishDate from best available timestamp
  const fallbackDate = event.updatedAt || event.createdAt || new Date()
  return {
    ...event,
    publishDate: new Date(fallbackDate),
  }
}