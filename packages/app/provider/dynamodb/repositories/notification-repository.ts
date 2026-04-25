import { BaseRepository } from './base-repository'
import type {
  NotificationRecord,
  NotificationQueryResult,
  NotificationType,
  NotificationStatus,
} from '../types'

// Generate a unique notification ID (timestamp-random7 gives chronological order)
function generateNotificationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// TTL: 30 days in seconds
const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60

/**
 * Repository for in-app notification records.
 * Uses 'tee-admin' table with lowercase keys (pkey, skey).
 * pkey: USER#{recipientEmail}, skey: NOTIFICATION#{notificationId}
 */
export class NotificationRepository extends BaseRepository<NotificationRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for NotificationRepository')
  }

  /**
   * Create a notification
   */
  async createNotification(params: {
    recipientEmail: string
    type: NotificationType
    title: string
    body: string
    actionUrl?: string
    sourceId?: string
    sourceType?: string
    senderEmail?: string
  }): Promise<NotificationRecord> {
    const notificationId = generateNotificationId()
    const now = new Date().toISOString()
    const ttl = Math.floor(Date.now() / 1000) + THIRTY_DAYS_SECONDS

    const record = {
      pkey: `USER#${params.recipientEmail}`,
      skey: `NOTIFICATION#${notificationId}`,
      notificationId,
      recipientEmail: params.recipientEmail,
      type: params.type,
      status: 'unread' as NotificationStatus,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
      sourceId: params.sourceId,
      sourceType: params.sourceType,
      senderEmail: params.senderEmail,
      createdAt: now,
      ttl,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record as any)
    return record as unknown as NotificationRecord
  }

  /**
   * Get notifications for a user, newest first
   */
  async getNotifications(email: string, limit = 50): Promise<NotificationQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'NOTIFICATION#' },
      { limit, scanIndexForward: false }
    )
    return {
      items: result.items as NotificationRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(email: string): Promise<number> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'NOTIFICATION#' }
    )
    return result.items.filter((n) => n.status === 'unread').length
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(email: string, notificationId: string): Promise<NotificationRecord> {
    const pk = `USER#${email}`
    const sk = `NOTIFICATION#${notificationId}`
    return this.update(pk, sk, {
      status: 'read',
      readAt: new Date().toISOString(),
    } as any)
  }

  /**
   * Mark all unread notifications as read for a user
   */
  async markAllAsRead(email: string): Promise<number> {
    const result = await this.getNotifications(email, 200)
    const unread = result.items.filter((n) => n.status === 'unread')

    const now = new Date().toISOString()
    await Promise.all(
      unread.map((n) =>
        this.update(n.pkey, n.skey, {
          status: 'read',
          readAt: now,
        } as any)
      )
    )

    return unread.length
  }

  /**
   * Delete a notification
   */
  async deleteNotification(email: string, notificationId: string): Promise<void> {
    const pk = `USER#${email}`
    const sk = `NOTIFICATION#${notificationId}`
    await this.delete(pk, sk)
  }

  /**
   * Create the same notification for multiple recipients
   */
  async createBulkNotifications(
    recipientEmails: string[],
    template: {
      type: NotificationType
      title: string
      body: string
      actionUrl?: string
      sourceId?: string
      sourceType?: string
      senderEmail?: string
    }
  ): Promise<number> {
    let created = 0
    for (const email of recipientEmails) {
      try {
        await this.createNotification({
          recipientEmail: email,
          ...template,
        })
        created++
      } catch (error) {
        console.error(`Failed to create notification for ${email}:`, error)
      }
    }
    return created
  }
}

// Export singleton instance
export const notificationRepository = new NotificationRepository()
