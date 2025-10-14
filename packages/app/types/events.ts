// Event Management System Types
export type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'baptism' | 'general' | 'recurring'
export type EventStatus = 'draft' | 'ready' | 'published' | 'archived'

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

  // Baptism fields
  baptismDate?: Date
  candidate?: {
    firstName: string
    lastName: string
  }

  // Funeral fields
  serviceDate?: Date
  deceased?: {
    firstName: string
    lastName: string
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

  // Hosting ecclesia (for most event types)
  hostingEcclesia?: {
    name: string
  }
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

export function isBaptismEvent(event: Event): boolean {
  return event.type === 'baptism'
}

export function isGeneralEvent(event: Event): boolean {
  return event.type === 'general'
}

export function isRecurringEvent(event: Event): boolean {
  return event.type === 'recurring'
}