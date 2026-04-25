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
   *
   * IMPORTANT: If dayOfWeek or time changes, we must DELETE the old record and CREATE a new one
   * because the SK is immutable and contains these values.
   */
  async updateSchedule(update: UpdateScheduleRequest): Promise<EmailSchedule> {
    // First get the existing schedule to build the SK
    const existing = await this.getScheduleByType(update.emailType)
    if (!existing) {
      throw new Error(`Schedule not found for email type: ${update.emailType}`)
    }

    const oldSK = `${existing.emailType}#${existing.dayOfWeek}#${existing.time}`

    // Check if day or time is changing (which requires delete + create)
    const dayChanging = update.dayOfWeek !== undefined && update.dayOfWeek !== existing.dayOfWeek
    const timeChanging = update.time !== undefined && update.time !== existing.time

    if (dayChanging || timeChanging) {
      // Delete the old record
      await docClient.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: 'SCHEDULE', SK: oldSK },
      }))

      // Create new record with updated values
      const newSchedule: CreateScheduleRequest = {
        emailType: update.emailType,
        dayOfWeek: update.dayOfWeek ?? existing.dayOfWeek,
        time: update.time ?? existing.time,
        timezone: update.timezone ?? existing.timezone,
        enabled: update.enabled ?? existing.enabled,
        description: update.description ?? existing.description,
        testMode: update.testMode ?? existing.testMode,
      }

      return await this.putSchedule(newSchedule)
    }

    // Only updating metadata (enabled, testMode, description, timezone) - can use UpdateCommand
    const updateExpressions: string[] = []
    const expressionAttributeValues: Record<string, any> = {}
    const expressionAttributeNames: Record<string, string> = {}

    if (update.timezone !== undefined) {
      updateExpressions.push('#timezone = :timezone')
      expressionAttributeValues[':timezone'] = update.timezone
      expressionAttributeNames['#timezone'] = 'timezone'
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
      Key: { PK: 'SCHEDULE', SK: oldSK },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
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
   * Delete a schedule by email type
   *
   * NOTE: We query by emailType (not construct SK from provided data) because
   * the SK may be out of sync with the data due to immutable key constraints.
   */
  async deleteSchedule(emailType: EmailType, dayOfWeek: DayOfWeek, time: string): Promise<boolean> {
    // Query to find the actual record for this email type
    const queryResult = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': 'SCHEDULE',
        ':sk': emailType,
      },
    }))

    if (!queryResult.Items || queryResult.Items.length === 0) {
      throw new Error(`No schedule found for email type: ${emailType}`)
    }

    // Use the first matching record (there should only be one per email type)
    const actualItem = queryResult.Items[0]
    const actualSK = actualItem.SK as string

    await docClient.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: 'SCHEDULE', SK: actualSK },
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
        'recap': { ready: 0, processing: 0, complete: 0, failed: 0 },
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
    // Extract emailType from SK if not stored separately (handles legacy records)
    // SK format: {emailType}#{dayOfWeek}#{time}
    let emailType = record.emailType

    if (!emailType && record.SK) {
      const skParts = record.SK.split('#')
      if (skParts.length >= 1) {
        emailType = skParts[0] as EmailType
      }
    }

    if (!emailType) {
      throw new Error(`Cannot determine emailType from record with SK: ${record.SK}`)
    }

    return {
      emailType: emailType,
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