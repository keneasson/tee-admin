/**
 * Email Queue Processor - Event Stream System
 * Handles scheduled email processing with reliability and monitoring
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { 
  EmailQueueItem, 
  QueueStatusItem, 
  QueueLogItem, 
  QueueStatsItem,
  EmailQueueKeys,
  EmailQueueQueries
} from './email-queue-schema'

export class EmailQueueProcessor {
  private dynamoDb: DynamoDBDocumentClient
  private tableName: string

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    })
    this.dynamoDb = DynamoDBDocumentClient.from(client)
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'tee-admin-dev'
  }

  /**
   * Main entry point - called by hourly cron job
   */
  async processQueue(): Promise<{
    success: boolean
    message: string
    stats: {
      processed: number
      failed: number
      skipped: number
      queueSize: number
    }
  }> {
    const startTime = Date.now()
    let stats = { processed: 0, failed: 0, skipped: 0, queueSize: 0 }

    try {
      // Log processor start
      await this.logEvent('PROCESSOR', 'started', 'Queue processor started')

      // Check if already processing
      const currentStatus = await this.getQueueStatus()
      if (currentStatus.status === 'sending') {
        await this.logEvent('PROCESSOR', 'skipped', 'Queue already processing, skipping...')
        return {
          success: true,
          message: 'Queue already processing, skipped',
          stats
        }
      }

      // Get due jobs
      const currentHour = new Date().getHours()
      const dueJobs = await this.getDueJobs(currentHour)
      stats.queueSize = dueJobs.length

      if (dueJobs.length === 0) {
        await this.updateQueueStatus({
          status: 'no_jobs',
          queuedJobs: 0,
          lastProcessed: new Date().toISOString()
        })
        await this.logEvent('PROCESSOR', 'completed', 'No jobs due for processing')
        return {
          success: true,
          message: 'No jobs due for processing',
          stats
        }
      }

      // Update status to sending
      await this.updateQueueStatus({
        status: 'sending',
        queuedJobs: dueJobs.length,
        processingStarted: new Date().toISOString()
      })

      // Process jobs in priority order
      const sortedJobs = dueJobs.sort((a, b) => a.priority - b.priority)
      
      for (const job of sortedJobs) {
        try {
          await this.processJob(job)
          stats.processed++
        } catch (error) {
          console.error(`Failed to process job ${job.id}:`, error)
          stats.failed++
        }
      }

      // Update final status
      await this.updateQueueStatus({
        status: 'finished',
        queuedJobs: 0,
        lastProcessed: new Date().toISOString(),
        processingStarted: undefined
      })

      // Update daily stats
      await this.updateDailyStats(stats, Date.now() - startTime)

      await this.logEvent('PROCESSOR', 'completed', 
        `Processed ${stats.processed} jobs, ${stats.failed} failed`)

      return {
        success: true,
        message: `Processed ${stats.processed} jobs successfully`,
        stats
      }

    } catch (error) {
      // Reset queue status on error
      await this.updateQueueStatus({
        status: 'finished',
        queuedJobs: 0,
        lastProcessed: new Date().toISOString()
      })

      await this.logEvent('PROCESSOR', 'failed', 
        `Queue processor failed: ${error.message}`, error.toString())

      return {
        success: false,
        message: `Queue processor failed: ${error.message}`,
        stats
      }
    }
  }

  /**
   * Process individual job
   */
  private async processJob(job: EmailQueueItem): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Update job status to sending
      await this.updateJobStatus(job.id, 'sending')
      await this.logJobEvent(job.id, 'started', `Processing ${job.type} email`)

      // Send email based on type
      await this.sendEmail(job)

      // Mark job as completed
      await this.updateJobStatus(job.id, 'sent', {
        sentAt: new Date().toISOString(),
        processedAt: new Date().toISOString()
      })

      const processingTime = Date.now() - startTime
      await this.logJobEvent(job.id, 'completed', 
        `Email sent successfully in ${processingTime}ms`, undefined, processingTime)

    } catch (error) {
      const newAttempts = job.attempts + 1
      
      if (newAttempts >= job.maxAttempts) {
        // Max attempts reached, mark as failed
        await this.updateJobStatus(job.id, 'failed', {
          lastError: error.message,
          attempts: newAttempts,
          processedAt: new Date().toISOString()
        })
        await this.logJobEvent(job.id, 'failed', 
          `Job failed after ${newAttempts} attempts: ${error.message}`, error.toString())
      } else {
        // Retry later - reschedule for next hour
        const nextHour = new Date()
        nextHour.setHours(nextHour.getHours() + 1)
        
        await this.updateJobStatus(job.id, 'queued', {
          lastError: error.message,
          attempts: newAttempts,
          scheduledFor: nextHour.toISOString(),
          scheduledHour: nextHour.getHours()
        })
        await this.logJobEvent(job.id, 'retried', 
          `Job retry ${newAttempts}/${job.maxAttempts}: ${error.message}`, error.toString(), undefined, newAttempts)
      }
      throw error
    }
  }

  /**
   * Send email based on job type
   */
  private async sendEmail(job: EmailQueueItem): Promise<void> {
    // TODO: Implement actual email sending logic
    // For now, simulate email sending
    console.log(`Sending ${job.type} email to ${job.recipients.length} recipients`)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // TODO: Replace with actual AWS SES integration
    // switch (job.type) {
    //   case 'bible-class':
    //     await this.sendBibleClassEmail(job)
    //     break
    //   case 'newsletter-qa':
    //     await this.sendNewsletterQA(job)
    //     break
    //   case 'newsletter-final':
    //     await this.sendNewsletterFinal(job)
    //     break
    //   // ... other email types
    // }
  }

  /**
   * Get jobs due for processing
   */
  private async getDueJobs(currentHour: number): Promise<EmailQueueItem[]> {
    const query = EmailQueueQueries.getDueJobs(currentHour)
    
    const result = await this.dynamoDb.send(new QueryCommand({
      TableName: this.tableName,
      ...query
    }))

    return (result.Items || []) as EmailQueueItem[]
  }

  /**
   * Get current queue status
   */
  private async getQueueStatus(): Promise<QueueStatusItem> {
    const query = EmailQueueQueries.getStatus()
    
    const result = await this.dynamoDb.send(new GetCommand({
      TableName: this.tableName,
      ...query
    }))

    return result.Item as QueueStatusItem || {
      ...EmailQueueKeys.status(),
      status: 'no_jobs',
      queuedJobs: 0,
      processedToday: 0,
      failedToday: 0,
      totalProcessed: 0,
      totalFailed: 0,
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * Update queue status
   */
  private async updateQueueStatus(updates: Partial<QueueStatusItem>): Promise<void> {
    const current = await this.getQueueStatus()
    
    const updated: QueueStatusItem = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    }

    await this.dynamoDb.send(new PutCommand({
      TableName: this.tableName,
      Item: updated
    }))
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: EmailQueueItem['status'], updates: Partial<EmailQueueItem> = {}): Promise<void> {
    // TODO: Implement job status update
    // This would query for the job and update its status
    console.log(`Updating job ${jobId} status to ${status}`)
  }

  /**
   * Log general events
   */
  private async logEvent(type: string, action: string, message: string, error?: string): Promise<void> {
    const now = new Date()
    const timestamp = now.toISOString()
    const date = now.toISOString().split('T')[0]
    
    const logItem: QueueLogItem = {
      ...EmailQueueKeys.log(date, timestamp, 'PROCESSOR'),
      jobId: 'PROCESSOR',
      type,
      action: action as any,
      message,
      error,
      timestamp,
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }

    await this.dynamoDb.send(new PutCommand({
      TableName: this.tableName,
      Item: logItem
    }))
  }

  /**
   * Log job-specific events
   */
  private async logJobEvent(
    jobId: string, 
    action: string, 
    message: string, 
    error?: string, 
    processingTime?: number,
    attemptNumber?: number
  ): Promise<void> {
    const now = new Date()
    const timestamp = now.toISOString()
    const date = now.toISOString().split('T')[0]
    
    const logItem: QueueLogItem = {
      ...EmailQueueKeys.log(date, timestamp, jobId),
      jobId,
      type: 'JOB',
      action: action as any,
      message,
      error,
      processingTime,
      attemptNumber,
      timestamp,
      ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }

    await this.dynamoDb.send(new PutCommand({
      TableName: this.tableName,
      Item: logItem
    }))
  }

  /**
   * Update daily statistics
   */
  private async updateDailyStats(stats: any, totalProcessingTime: number): Promise<void> {
    const date = new Date().toISOString().split('T')[0]
    const current = await this.getDailyStats(date)

    const updated: QueueStatsItem = {
      ...EmailQueueKeys.stats(date),
      date,
      totalJobs: current.totalJobs + stats.processed + stats.failed,
      successfulJobs: current.successfulJobs + stats.processed,
      failedJobs: current.failedJobs + stats.failed,
      retriedJobs: current.retriedJobs,
      jobsByType: current.jobsByType,
      failuresByType: current.failuresByType,
      averageProcessingTime: current.averageProcessingTime,
      maxProcessingTime: Math.max(current.maxProcessingTime, totalProcessingTime),
      minProcessingTime: current.minProcessingTime > 0 ? Math.min(current.minProcessingTime, totalProcessingTime) : totalProcessingTime,
      maxQueueSize: Math.max(current.maxQueueSize, stats.queueSize),
      processorCalls: current.processorCalls + 1,
      updatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
    }

    await this.dynamoDb.send(new PutCommand({
      TableName: this.tableName,
      Item: updated
    }))
  }

  /**
   * Get daily statistics
   */
  private async getDailyStats(date: string): Promise<QueueStatsItem> {
    const query = EmailQueueQueries.getStatsForDate(date)
    
    const result = await this.dynamoDb.send(new GetCommand({
      TableName: this.tableName,
      ...query
    }))

    return result.Item as QueueStatsItem || {
      ...EmailQueueKeys.stats(date),
      date,
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      retriedJobs: 0,
      jobsByType: {},
      failuresByType: {},
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: 0,
      maxQueueSize: 0,
      processorCalls: 0,
      updatedAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
    }
  }

  /**
   * Public methods for queue management
   */

  /**
   * Add job to queue
   */
  async addJob(job: Omit<EmailQueueItem, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK' | 'id' | 'createdAt' | 'ttl'>): Promise<string> {
    const id = `${job.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const scheduledFor = job.scheduledFor
    const scheduledDate = new Date(scheduledFor)
    
    const queueItem: EmailQueueItem = {
      ...EmailQueueKeys.job(id, scheduledFor, job.priority),
      id,
      ...job,
      scheduledHour: scheduledDate.getHours(),
      createdAt: new Date().toISOString(),
      ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days
    }

    await this.dynamoDb.send(new PutCommand({
      TableName: this.tableName,
      Item: queueItem
    }))

    await this.logJobEvent(id, 'created', `Job created: ${job.type}`)
    
    return id
  }

  /**
   * Get queue monitoring data
   */
  async getMonitoringData(): Promise<{
    status: QueueStatusItem
    recentLogs: QueueLogItem[]
    todayStats: QueueStatsItem
  }> {
    const today = new Date().toISOString().split('T')[0]
    
    const [status, recentLogs, todayStats] = await Promise.all([
      this.getQueueStatus(),
      this.getRecentLogs(today),
      this.getDailyStats(today)
    ])

    return { status, recentLogs, todayStats }
  }

  /**
   * Get recent logs
   */
  private async getRecentLogs(date: string): Promise<QueueLogItem[]> {
    const query = EmailQueueQueries.getLogsForDate(date)
    
    const result = await this.dynamoDb.send(new QueryCommand({
      TableName: this.tableName,
      ...query,
      Limit: 50
    }))

    return (result.Items || []) as QueueLogItem[]
  }
}