// Event Management System Types
export type EventType = 'study-weekend' | 'funeral' | 'wedding' | 'baptism' | 'general' | 'recurring'
export type EventStatus = 'draft' | 'published' | 'archived'

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

// Minimal Event type for now (can be expanded later)
export interface Event extends BaseEvent {
  // Additional properties can be added as needed
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