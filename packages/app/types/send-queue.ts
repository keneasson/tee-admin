export type EmailType = 'newsletter' | 'memorial' | 'bible-class' | 'sunday-school'

export type QueueStatus = 'ready' | 'processing' | 'complete' | 'failed'

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

// Schedule configuration for recurring emails
export interface EmailSchedule {
  emailType: EmailType
  dayOfWeek: DayOfWeek
  time: string // HH:MM format (24 hour)
  timezone: string // e.g., "America/Toronto"
  enabled: boolean
  description?: string
  testMode?: boolean
}

// Queue entry for emails to be sent
export interface QueueEntry {
  emailType: EmailType
  scheduledDate: string // YYYY-MM-DD format
  scheduledTime: string // HH:MM format
  status: QueueStatus
  created: string // ISO timestamp when added to queue
  claimedAt?: string // ISO timestamp when claimed for processing (prevents duplicate sends)
  sent?: string // ISO timestamp when email was sent
  error?: string // Error message if failed
  recipientCount?: number // Number of recipients (for logging)
  sentCount?: number // Number of successfully sent (for partial failures)
  failedCount?: number // Number of failed recipients
  testMode?: boolean // Whether this was a test send
  retryCount?: number // Number of retry attempts
  lastRetry?: string // ISO timestamp of last retry attempt
}

// DynamoDB record structures
export interface ScheduleRecord {
  PK: 'SCHEDULE'
  SK: string // {email_type}#{day}#{time}
  emailType: EmailType
  dayOfWeek: DayOfWeek
  time: string
  timezone: string
  enabled: boolean
  description?: string
  testMode?: boolean
  createdAt: string
  updatedAt: string
}

export interface QueueRecord {
  PK: 'QUEUE'
  SK: string // {email_type}#{YYYY-MM-DD}#{HH:MM}
  GSI1PK: string // {status}
  GSI1SK: string // {YYYY-MM-DD}#{HH:MM}
  emailType: EmailType
  scheduledDate: string
  scheduledTime: string
  status: QueueStatus
  created: string
  claimedAt?: string
  sent?: string
  error?: string
  recipientCount?: number
  sentCount?: number
  failedCount?: number
  testMode?: boolean
  retryCount?: number
  lastRetry?: string
}

// API request/response types
export interface CreateScheduleRequest {
  emailType: EmailType
  dayOfWeek: DayOfWeek
  time: string
  timezone?: string
  enabled?: boolean
  description?: string
  testMode?: boolean
}

export interface UpdateScheduleRequest extends Partial<CreateScheduleRequest> {
  emailType: EmailType // Required for identification
}

export interface QueueEntryRequest {
  emailType: EmailType
  scheduledDate: string
  scheduledTime: string
  testMode?: boolean
}

export interface CronJobResponse {
  processed: {
    sent: number
    queued: number
    errors: number
  }
  details: {
    sentEmails: string[]
    queuedEmails: string[]
    errors: string[]
  }
}

// Helper types for admin UI
export interface ScheduleWithStats extends EmailSchedule {
  lastSent?: string
  nextScheduled?: string
  totalSent: number
  recentFailures: number
}

export interface QueueSummary {
  ready: number
  processing: number
  complete: number
  failed: number
  byType: Record<EmailType, {
    ready: number
    processing: number
    complete: number
    failed: number
  }>
}