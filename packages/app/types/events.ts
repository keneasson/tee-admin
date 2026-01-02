// Event Management System Types
export type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'baptism' | 'engagement' | 'general' | 'recurring' | 'election-cycle'
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
  name?: string // Location name
  address?: string
  city?: string
  province?: string
  country?: string
  postalCode?: string
  directions?: string
  parkingInfo?: string
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
    firstName: string
    lastName: string
  }>

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
  }
  aboutCandidate?: string // Biography/testimony text for the candidate
  candidatePhoto?: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  }

  // Funeral fields
  serviceDate?: Date
  deceased?: {
    title?: 'Brother' | 'Sister' | 'Mr.' | 'Mrs.' | 'Ms.' | ''
    firstName: string
    lastName: string
  }
  aboutDeceased?: string // Biography/tribute text for the deceased
  deceasedPhoto?: {
    url: string
    fileName: string
    originalName: string
    uploadedAt: Date
  }

  // General event fields
  startDate?: Date
  endDate?: Date
  customType?: string

  // Recurring event fields
  recurringConfig?: {
    startDate: Date
    startTime: string
  }

  // Election cycle fields
  electionStartDate?: Date
  electionEndDate?: Date

  // Hosting ecclesia (for most event types)
  hostingEcclesia?: {
    name: string
  }

  // Location details (for all event types)
  location?: LocationInfo

  // Registration details (for events that require registration)
  registration?: RegistrationInfo
}

// Type guards for discriminated unions
export function isStudyWeekendEvent(event: Event): boolean {
  return event.type === 'study-weekend'
}

export function isFuneralEvent(event: Event): boolean {
  return event.type === 'funeral'
}

export function isWeddingEvent(event: Event): boolean {
  return event.type === 'wedding'
}

export function isEngagementEvent(event: Event): boolean {
  return event.type === 'engagement'
}

export function isBaptismEvent(event: Event): boolean {
  return event.type === 'baptism'
}

export function isGeneralEvent(event: Event): boolean {
  return event.type === 'general'
}

export function isRecurringEvent(event: Event): boolean {
  return event.type === 'recurring'
}

export function isElectionCycleEvent(event: Event): boolean {
  return event.type === 'election-cycle'
}