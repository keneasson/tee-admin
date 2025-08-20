/**
 * Email Queue DynamoDB Schema
 * Single table design for email queue management
 */

export interface EmailQueueItem {
  // Primary key
  PK: string  // 'EMAIL_QUEUE#{id}'
  SK: string  // 'JOB#{scheduledFor}#{priority}'
  
  // GSI1 - Queue Status Index
  GSI1PK: string  // 'QUEUE_STATUS'
  GSI1SK: string  // '{status}#{scheduledFor}'
  
  // Core queue data
  id: string
  type: 'bible-class' | 'recap' | 'newsletter-draft' | 'newsletter-qa' | 'newsletter-final'
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled'
  priority: number  // 1 = highest priority
  
  // Scheduling
  scheduledFor: string  // ISO date string
  scheduledHour: number  // Hour of day (0-23) for easy filtering
  
  // Email content
  recipients: string[]
  template: string
  templateData: Record<string, any>
  
  // Retry logic
  attempts: number
  maxAttempts: number
  lastError?: string
  
  // Timestamps
  createdAt: string
  processedAt?: string
  sentAt?: string
  
  // TTL for cleanup (90 days)
  ttl: number
}

export interface QueueStatusItem {
  // Primary key
  PK: string  // 'QUEUE_STATUS'
  SK: string  // 'CURRENT'
  
  // Status tracking
  status: 'no_jobs' | 'queued' | 'sending' | 'finished'
  currentJobId?: string
  queuedJobs: number
  
  // Timing
  lastProcessed?: string
  nextScheduled?: string
  processingStarted?: string
  
  // Statistics
  processedToday: number
  failedToday: number
  totalProcessed: number
  totalFailed: number
  
  // Updated timestamp
  updatedAt: string
}

export interface QueueLogItem {
  // Primary key  
  PK: string  // 'QUEUE_LOG#{date}'
  SK: string  // '{timestamp}#{jobId}'
  
  // GSI1 - Job logs
  GSI1PK: string  // 'JOB_LOG#{jobId}'
  GSI1SK: string  // '{timestamp}'
  
  // Log data
  jobId: string
  type: string
  action: 'created' | 'started' | 'completed' | 'failed' | 'retried' | 'cancelled'
  message: string
  error?: string
  
  // Context
  processingTime?: number  // milliseconds
  attemptNumber?: number
  
  // Timestamp
  timestamp: string
  
  // TTL for cleanup (30 days)
  ttl: number
}

export interface QueueStatsItem {
  // Primary key
  PK: string  // 'QUEUE_STATS#{date}'  
  SK: string  // 'DAILY'
  
  // Daily statistics
  date: string
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  retriedJobs: number
  
  // By email type
  jobsByType: Record<string, number>
  failuresByType: Record<string, number>
  
  // Timing stats
  averageProcessingTime: number
  maxProcessingTime: number
  minProcessingTime: number
  
  // Queue health
  maxQueueSize: number
  processorCalls: number
  
  // Updated timestamp
  updatedAt: string
  
  // TTL for cleanup (1 year)
  ttl: number
}

// Helper functions for key generation
export const EmailQueueKeys = {
  job: (id: string, scheduledFor: string, priority: number) => ({
    PK: `EMAIL_QUEUE#${id}`,
    SK: `JOB#${scheduledFor}#${priority.toString().padStart(3, '0')}`,
    GSI1PK: 'QUEUE_STATUS',
    GSI1SK: `queued#${scheduledFor}`
  }),
  
  status: () => ({
    PK: 'QUEUE_STATUS',
    SK: 'CURRENT'
  }),
  
  log: (date: string, timestamp: string, jobId: string) => ({
    PK: `QUEUE_LOG#${date}`,
    SK: `${timestamp}#${jobId}`,
    GSI1PK: `JOB_LOG#${jobId}`,
    GSI1SK: timestamp
  }),
  
  stats: (date: string) => ({
    PK: `QUEUE_STATS#${date}`,
    SK: 'DAILY'
  })
}

// Query helpers
export const EmailQueueQueries = {
  // Get jobs due for processing
  getDueJobs: (currentHour: number) => ({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :status)',
    FilterExpression: 'scheduledHour <= :hour',
    ExpressionAttributeValues: {
      ':pk': 'QUEUE_STATUS',
      ':status': 'queued',
      ':hour': currentHour
    },
    ScanIndexForward: true  // Sort by priority
  }),
  
  // Get queue status
  getStatus: () => ({
    Key: EmailQueueKeys.status()
  }),
  
  // Get job logs for date
  getLogsForDate: (date: string) => ({
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `QUEUE_LOG#${date}`
    },
    ScanIndexForward: false  // Most recent first
  }),
  
  // Get job logs for specific job
  getJobLogs: (jobId: string) => ({
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `JOB_LOG#${jobId}`
    },
    ScanIndexForward: false  // Most recent first
  }),
  
  // Get daily stats
  getStatsForDate: (date: string) => ({
    Key: EmailQueueKeys.stats(date)
  })
}