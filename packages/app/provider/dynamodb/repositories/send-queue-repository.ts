import { docClient, tableNames } from '../config'
import { PutCommand, QueryCommand, UpdateCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import {
  EmailType,
  QueueStatus,
  DayOfWeek,
  EmailSchedule,
  QueueEntry,
  ScheduleRecord,
  QueueRecord,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  QueueEntryRequest,
  QueueSummary
} from '@my/app/types/send-queue'

/**
 * Send Queue Repository
 * Manages email schedules and send queue using efficient DynamoDB queries
 */
export class SendQueueRepository {
  private tableName = tableNames.sendQueue

  // ========== SCHEDULE MANAGEMENT ==========

  /**
   * Create or update an email schedule
   */
  async putSchedule(schedule: CreateScheduleRequest): Promise<EmailSchedule> {
    const now = new Date().toISOString()

    const record: ScheduleRecord = {
      PK: 'SCHEDULE',
      SK: `${schedule.emailType}#${schedule.dayOfWeek}#${schedule.time}`,
      emailType: schedule.emailType,
      dayOfWeek: schedule.dayOfWeek,
      time: schedule.time,
      timezone: schedule.timezone || 'America/Toronto',
      enabled: schedule.enabled ?? true,
      description: schedule.description,
      testMode: schedule.testMode ?? false,
      createdAt: now,
      updatedAt: now,
    }

    await docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: record,
    }))

    return this.recordToSchedule(record)
  }

  /**
   * Get all email schedules
   */
  async getAllSchedules(): Promise<EmailSchedule[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'SCHEDULE',
      },
    }))

    return (result.Items || []).map(item => this.recordToSchedule(item as ScheduleRecord))
  }

  /**
   * Get schedule for specific email type
   */
  async getScheduleByType(emailType: EmailType): Promise<EmailSchedule | null> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'SCHEDULE',
        ':sk': emailType,
      },
    }))

    if (!result.Items || result.Items.length === 0) {
      return null
    }

    return this.recordToSchedule(result.Items[0] as ScheduleRecord)
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(update: UpdateScheduleRequest): Promise<EmailSchedule> {
    // First get the existing schedule to build the SK
    const existing = await this.getScheduleByType(update.emailType)
    if (!existing) {
      throw new Error(`Schedule not found for email type: ${update.emailType}`)
    }

    const sk = `${existing.emailType}#${existing.dayOfWeek}#${existing.time}`

    // Build update expression
    const updateExpressions: string[] = []
    const expressionAttributeValues: Record<string, any> = {}

    if (update.dayOfWeek !== undefined) {
      updateExpressions.push('dayOfWeek = :dayOfWeek')
      expressionAttributeValues[':dayOfWeek'] = update.dayOfWeek
    }

    if (update.time !== undefined) {
      updateExpressions.push('#time = :time')
      expressionAttributeValues[':time'] = update.time
    }

    if (update.timezone !== undefined) {
      updateExpressions.push('#timezone = :timezone')
      expressionAttributeValues[':timezone'] = update.timezone
    }

    if (update.enabled !== undefined) {
      updateExpressions.push('enabled = :enabled')
      expressionAttributeValues[':enabled'] = update.enabled
    }

    if (update.description !== undefined) {
      updateExpressions.push('description = :description')
      expressionAttributeValues[':description'] = update.description
    }

    if (update.testMode !== undefined) {
      updateExpressions.push('testMode = :testMode')
      expressionAttributeValues[':testMode'] = update.testMode
    }

    updateExpressions.push('updatedAt = :updatedAt')
    expressionAttributeValues[':updatedAt'] = new Date().toISOString()

    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { PK: 'SCHEDULE', SK: sk },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: {
        '#time': 'time',      // Reserved word
        '#timezone': 'timezone' // Reserved word
      },
      ExpressionAttributeValues: expressionAttributeValues,
    }))

    // Return updated schedule
    const updatedSchedule = await this.getScheduleByType(update.emailType)
    if (!updatedSchedule) {
      throw new Error('Failed to retrieve updated schedule')
    }

    return updatedSchedule
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(emailType: EmailType): Promise<boolean> {
    const existing = await this.getScheduleByType(emailType)
    if (!existing) {
      return false
    }

    const sk = `${existing.emailType}#${existing.dayOfWeek}#${existing.time}`

    await docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: 'SCHEDULE', SK: sk },
    }))

    return true
  }

  // ========== QUEUE MANAGEMENT ==========

  /**
   * Add email to send queue (with duplicate prevention)
   */
  async addToQueue(entry: QueueEntryRequest): Promise<QueueEntry> {
    const sk = `${entry.emailType}#${entry.scheduledDate}#${entry.scheduledTime}`

    // Check for existing entry (duplicate prevention)
    const existing = await this.getQueueEntry(entry.emailType, entry.scheduledDate, entry.scheduledTime)
    if (existing) {
      throw new Error(`Email already queued: ${entry.emailType} for ${entry.scheduledDate} at ${entry.scheduledTime}`)
    }

    const now = new Date().toISOString()
    const gsiSK = `${entry.scheduledDate}#${entry.scheduledTime}`

    const record: QueueRecord = {
      PK: 'QUEUE',
      SK: sk,
      GSI1PK: 'ready', // Initial status
      GSI1SK: gsiSK,
      emailType: entry.emailType,
      scheduledDate: entry.scheduledDate,
      scheduledTime: entry.scheduledTime,
      status: 'ready',
      created: now,
      testMode: entry.testMode ?? false,
    }

    await docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: record,
    }))

    return this.recordToQueueEntry(record)
  }

  /**
   * Get specific queue entry
   */
  async getQueueEntry(emailType: EmailType, date: string, time: string): Promise<QueueEntry | null> {
    const sk = `${emailType}#${date}#${time}`

    const result = await docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: 'QUEUE', SK: sk },
    }))

    if (!result.Item) {
      return null
    }

    return this.recordToQueueEntry(result.Item as QueueRecord)
  }

  /**
   * Get all ready emails to send
   */
  async getReadyEmails(): Promise<QueueEntry[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'StatusIndex',
      KeyConditionExpression: 'GSI1PK = :status',
      ExpressionAttributeValues: {
        ':status': 'ready',
      },
    }))

    return (result.Items || []).map(item => this.recordToQueueEntry(item as QueueRecord))
  }

  /**
   * Atomically claim a queue entry for processing
   * Uses conditional update to ensure only ONE process can claim it
   * Returns the claimed entry if successful, null if already claimed
   *
   * @param emailType - Type of email
   * @param date - Scheduled date (YYYY-MM-DD)
   * @param time - Scheduled time (HH:MM)
   * @param expectedStatus - Expected current status (defaults to 'ready', use 'failed' for retries)
   */
  async claimQueueEntry(
    emailType: EmailType,
    date: string,
    time: string,
    expectedStatus: QueueStatus = 'ready'
  ): Promise<QueueEntry | null> {
    const sk = `${emailType}#${date}#${time}`
    const gsiSK = `${date}#${time}`
    const now = new Date().toISOString()

    try {
      // Atomic update: only succeeds if status matches expected status
      await docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: { PK: 'QUEUE', SK: sk },
        UpdateExpression: 'SET #status = :processing, GSI1PK = :processing, claimedAt = :now',
        ConditionExpression: '#status = :expectedStatus', // CRITICAL: Only claim if still in expected state
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':expectedStatus': expectedStatus,
          ':processing': 'processing',
          ':now': now,
        },
      }))

      // Successfully claimed! Return the entry
      const entry = await this.getQueueEntry(emailType, date, time)
      if (!entry) {
        throw new Error('Failed to retrieve claimed entry')
      }

      return entry
    } catch (error: any) {
      // ConditionalCheckFailedException means someone else claimed it
      if (error.name === 'ConditionalCheckFailedException') {
        return null // Already claimed by another process
      }
      // Other errors should be thrown
      throw error
    }
  }

  /**
   * Update queue entry status
   */
  async updateQueueStatus(
    emailType: EmailType,
    date: string,
    time: string,
    status: QueueStatus,
    metadata?: {
      error?: string
      recipientCount?: number
      sentCount?: number
      failedCount?: number
      incrementRetry?: boolean
    }
  ): Promise<QueueEntry> {
    const sk = `${emailType}#${date}#${time}`
    const gsiSK = `${date}#${time}`

    const updateExpressions: string[] = [
      '#status = :status',
      'GSI1PK = :status', // Update GSI for status queries
    ]

    const expressionAttributeValues: Record<string, any> = {
      ':status': status,
    }

    if (status === 'complete') {
      updateExpressions.push('sent = :sent')
      expressionAttributeValues[':sent'] = new Date().toISOString()
    }

    if (metadata?.error) {
      updateExpressions.push('#error = :error')
      expressionAttributeValues[':error'] = metadata.error
    }

    if (metadata?.recipientCount !== undefined) {
      updateExpressions.push('recipientCount = :recipientCount')
      expressionAttributeValues[':recipientCount'] = metadata.recipientCount
    }

    if (metadata?.sentCount !== undefined) {
      updateExpressions.push('sentCount = :sentCount')
      expressionAttributeValues[':sentCount'] = metadata.sentCount
    }

    if (metadata?.failedCount !== undefined) {
      updateExpressions.push('failedCount = :failedCount')
      expressionAttributeValues[':failedCount'] = metadata.failedCount
    }

    if (metadata?.incrementRetry) {
      updateExpressions.push('retryCount = if_not_exists(retryCount, :zero) + :one')
      updateExpressions.push('lastRetry = :lastRetry')
      expressionAttributeValues[':zero'] = 0
      expressionAttributeValues[':one'] = 1
      expressionAttributeValues[':lastRetry'] = new Date().toISOString()
    }

    // Build ExpressionAttributeNames only for attributes actually used
    const expressionAttributeNames: Record<string, string> = {
      '#status': 'status'
    }
    if (metadata?.error) {
      expressionAttributeNames['#error'] = 'error'
    }

    await docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { PK: 'QUEUE', SK: sk },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
    }))

    const updated = await this.getQueueEntry(emailType, date, time)
    if (!updated) {
      throw new Error('Failed to retrieve updated queue entry')
    }

    return updated
  }

  /**
   * Get queue entries by date range
   */
  async getQueueByDateRange(startDate: string, endDate: string): Promise<QueueEntry[]> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'scheduledDate BETWEEN :startDate AND :endDate',
      ExpressionAttributeValues: {
        ':pk': 'QUEUE',
        ':startDate': startDate,
        ':endDate': endDate,
      },
    }))

    return (result.Items || []).map(item => this.recordToQueueEntry(item as QueueRecord))
  }

  /**
   * Get queue summary statistics
   */
  async getQueueSummary(): Promise<QueueSummary> {
    // Get all queue entries
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'QUEUE',
      },
    }))

    const entries = (result.Items || []).map(item => this.recordToQueueEntry(item as QueueRecord))

    const summary: QueueSummary = {
      ready: 0,
      processing: 0,
      complete: 0,
      failed: 0,
      byType: {
        'newsletter': { ready: 0, processing: 0, complete: 0, failed: 0 },
        'memorial': { ready: 0, processing: 0, complete: 0, failed: 0 },
        'bible-class': { ready: 0, processing: 0, complete: 0, failed: 0 },
        'sunday-school': { ready: 0, processing: 0, complete: 0, failed: 0 },
      }
    }

    entries.forEach(entry => {
      summary[entry.status]++
      summary.byType[entry.emailType][entry.status]++
    })

    return summary
  }

  /**
   * Delete old queue entries (cleanup)
   */
  async cleanupOldEntries(beforeDate: string): Promise<number> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'scheduledDate < :beforeDate',
      ExpressionAttributeValues: {
        ':pk': 'QUEUE',
        ':beforeDate': beforeDate,
      },
    }))

    let deletedCount = 0

    for (const item of result.Items || []) {
      await docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: item.PK, SK: item.SK },
      }))
      deletedCount++
    }

    return deletedCount
  }

  // ========== HELPER METHODS ==========

  private recordToSchedule(record: ScheduleRecord): EmailSchedule {
    return {
      emailType: record.emailType,
      dayOfWeek: record.dayOfWeek,
      time: record.time,
      timezone: record.timezone,
      enabled: record.enabled,
      description: record.description,
      testMode: record.testMode,
    }
  }

  private recordToQueueEntry(record: QueueRecord): QueueEntry {
    return {
      emailType: record.emailType,
      scheduledDate: record.scheduledDate,
      scheduledTime: record.scheduledTime,
      status: record.status,
      created: record.created,
      claimedAt: record.claimedAt,
      sent: record.sent,
      error: record.error,
      recipientCount: record.recipientCount,
      sentCount: record.sentCount,
      failedCount: record.failedCount,
      testMode: record.testMode,
      retryCount: record.retryCount,
      lastRetry: record.lastRetry,
    }
  }
}

// Export singleton instance
export const sendQueueRepo = new SendQueueRepository()