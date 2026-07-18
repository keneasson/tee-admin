import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from './base-repository'
import { docClient } from '../config'
import type { EmailReasonType, EmailSubReason } from '../../../types'
import type { EmailSendRecord } from '../../../types/analytics'

/** DynamoDB shape for a send record */
interface SendRecordItem {
  pkey: string // SEND#{campaignId}
  skey: string // METADATA
  gsi1pk: string // SENDS#{reason}
  gsi1sk: string // {sentAt} ISO timestamp
  gsi2pk: string // SENDS#ALL
  gsi2sk: string // {sentAt} ISO timestamp
  campaignId: string
  reason: EmailReasonType
  subReason: EmailSubReason
  subject: string
  description?: string
  recipientCount: number
  sentCount: number
  failedCount: number
  sentAt: string
  sentBy?: string
  opens: number
  clicks: number
  bounces: number
  deliveries: number
  complaints: number
  ttl: number
  lastUpdated: string
  version: number
}

type SendMetric = 'opens' | 'clicks' | 'bounces' | 'deliveries' | 'complaints'

class SendRecordRepository extends BaseRepository<SendRecordItem> {
  constructor() {
    super('admin', false) // tee-admin table, pkey/skey naming
  }

  protected buildSheetPK(): string {
    return 'SEND'
  }

  /**
   * Create the send record. **Non-destructive by design** — this is an UpdateItem
   * (upsert) that writes ONLY metadata + roster counts, and NEVER the engagement
   * counters (opens/clicks/bounces/deliveries/complaints).
   *
   * Why: SES fires Delivery/Bounce events within seconds of each send — before the
   * send loop finishes. Those land via the webhook's `incrementMetric`
   * (`if_not_exists(:zero) + amount`), creating/updating the counters first. A full
   * `put()` here would reset them to 0 (the original write-ordering bug). By never
   * touching the counter attributes — and because reads default missing counters to
   * 0 — an early event survives regardless of ordering. Call this BEFORE the send
   * loop (see email-send.tsx) so the record exists when events arrive, then call
   * `finalizeSendCounts` after the loop for the final sent/failed tallies.
   */
  async createSendRecord(data: {
    campaignId: string
    reason: EmailReasonType
    subReason: EmailSubReason
    subject: string
    description?: string
    recipientCount: number
    sentCount: number
    failedCount: number
    sentBy?: string
  }): Promise<void> {
    const sentAt = new Date().toISOString()
    // 180-day TTL for send records
    const ttl = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60

    await this.update(`SEND#${data.campaignId}`, 'METADATA', {
      gsi1pk: `SENDS#${data.reason}`,
      gsi1sk: sentAt,
      gsi2pk: 'SENDS#ALL',
      gsi2sk: sentAt,
      campaignId: data.campaignId,
      reason: data.reason,
      subReason: data.subReason,
      subject: data.subject,
      ...(data.description ? { description: data.description } : {}),
      recipientCount: data.recipientCount,
      sentCount: data.sentCount,
      failedCount: data.failedCount,
      sentAt,
      ...(data.sentBy ? { sentBy: data.sentBy } : {}),
      ttl,
    } as Partial<SendRecordItem>)
  }

  /**
   * Update just the sent/failed tallies after the send loop completes. Targeted
   * SET of `sentCount`/`failedCount` only — never touches the webhook-owned
   * engagement counters, so events that arrived during the send are preserved.
   */
  async finalizeSendCounts(
    campaignId: string,
    counts: { sentCount: number; failedCount: number }
  ): Promise<void> {
    await this.update(`SEND#${campaignId}`, 'METADATA', {
      sentCount: counts.sentCount,
      failedCount: counts.failedCount,
    } as Partial<SendRecordItem>)
  }

  /**
   * Get recent send records, optionally filtered by reason.
   * Uses GSI2 (all sends) or GSI1 (by reason), sorted by date descending.
   */
  async getRecentSends(limit: number = 20, reason?: EmailReasonType): Promise<EmailSendRecord[]> {
    const gsiPk = reason ? `SENDS#${reason}` : 'SENDS#ALL'
    const indexName = reason ? 'gsi1' : 'gsi2'

    const result = await this.query(
      `${indexName === 'gsi1' ? 'gsi1pk' : 'gsi2pk'} = :pk`,
      { ':pk': gsiPk },
      {
        indexName,
        limit,
        scanIndexForward: false, // newest first
      }
    )

    return result.items.map(this.toEmailSendRecord)
  }

  /**
   * Atomically increment a metric counter on a send record.
   * Used by the SES event webhook.
   */
  async incrementMetric(campaignId: string, metric: SendMetric, amount: number = 1): Promise<void> {
    try {
      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pkey: `SEND#${campaignId}`,
          skey: 'METADATA',
        },
        UpdateExpression: `SET #metric = if_not_exists(#metric, :zero) + :amount, #lastUpdated = :now`,
        ExpressionAttributeNames: {
          '#metric': metric,
          '#lastUpdated': 'lastUpdated',
        },
        ExpressionAttributeValues: {
          ':amount': amount,
          ':zero': 0,
          ':now': new Date().toISOString(),
        },
      })

      await docClient.send(command)
    } catch (error) {
      console.error(`Error incrementing ${metric} for campaign ${campaignId}:`, error)
      // Don't throw — metric updates are best-effort
    }
  }

  /**
   * Get a single send record by campaign ID
   */
  async getSendRecord(campaignId: string): Promise<EmailSendRecord | null> {
    const item = await this.get(`SEND#${campaignId}`, 'METADATA')
    if (!item) return null
    return this.toEmailSendRecord(item)
  }

  /** Map DynamoDB item to API-facing EmailSendRecord */
  private toEmailSendRecord(item: SendRecordItem): EmailSendRecord {
    const deliveries = item.deliveries || 0
    return {
      campaignId: item.campaignId,
      reason: item.reason,
      subReason: item.subReason,
      subject: item.subject,
      description: item.description,
      recipientCount: item.recipientCount,
      sentCount: item.sentCount,
      failedCount: item.failedCount,
      sentAt: item.sentAt,
      sentBy: item.sentBy,
      opens: item.opens || 0,
      clicks: item.clicks || 0,
      bounces: item.bounces || 0,
      deliveries,
      complaints: item.complaints || 0,
      openRate: deliveries > 0 ? Math.round(((item.opens || 0) / deliveries) * 1000) / 10 : 0,
      clickRate: deliveries > 0 ? Math.round(((item.clicks || 0) / deliveries) * 1000) / 10 : 0,
    }
  }
}

// Singleton
export const sendRecordRepository = new SendRecordRepository()
