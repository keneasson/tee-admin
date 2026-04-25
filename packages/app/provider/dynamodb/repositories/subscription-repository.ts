import { BaseRepository } from './base-repository'
import type { SubscriptionRecord, NotificationPreference } from '../types'

class SubscriptionRepository extends BaseRepository<SubscriptionRecord> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for SubscriptionRepository')
  }

  private pk(subscriberEcclesia: string): string {
    return `SUBSCRIPTION#${subscriberEcclesia}`
  }

  async subscribe(
    subscriberEcclesia: string,
    publisherEcclesia: string,
    subscribedBy: string,
    notificationPref: NotificationPreference = 'all'
  ): Promise<SubscriptionRecord> {
    const now = new Date().toISOString()
    const record: SubscriptionRecord = {
      pkey: this.pk(subscriberEcclesia),
      skey: publisherEcclesia,
      subscriberEcclesia,
      publisherEcclesia,
      subscribedBy,
      notificationPref,
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }
    await this.put(record)
    return record
  }

  async unsubscribe(subscriberEcclesia: string, publisherEcclesia: string): Promise<void> {
    await this.delete(this.pk(subscriberEcclesia), publisherEcclesia)
  }

  async getSubscription(
    subscriberEcclesia: string,
    publisherEcclesia: string
  ): Promise<SubscriptionRecord | null> {
    return this.get(this.pk(subscriberEcclesia), publisherEcclesia)
  }

  async getSubscriptions(subscriberEcclesia: string): Promise<SubscriptionRecord[]> {
    const result = await this.query(
      'pkey = :pk',
      { ':pk': this.pk(subscriberEcclesia) }
    )
    return result.items
  }

  async updateNotificationPref(
    subscriberEcclesia: string,
    publisherEcclesia: string,
    notificationPref: NotificationPreference
  ): Promise<SubscriptionRecord> {
    return this.update(
      this.pk(subscriberEcclesia),
      publisherEcclesia,
      { notificationPref } as Partial<SubscriptionRecord>
    )
  }
}

export const subscriptionRepository = new SubscriptionRepository()
