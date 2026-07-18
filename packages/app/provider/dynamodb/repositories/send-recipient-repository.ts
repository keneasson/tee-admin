import { UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from './base-repository'
import { docClient } from '../config'
import type { CampaignRecipient, EmailRecipientRecord } from '../../../types/analytics'

const TTL_SECONDS = 180 * 24 * 60 * 60 // 180 days, matches the send-record TTL

/**
 * Per-recipient send tracking (Mailchimp-style drill-down). One item per
 * (campaign, recipient) under the campaign's partition:
 *   pkey = SEND#{campaignId}, skey = RECIPIENT#{email}
 *
 * - `snapshotRoster` captures every intended recipient at send time (batched).
 * - the SES webhook calls `recordDelivery/Open/Click/Bounce/Complaint` per event.
 * - `getCampaignRecipients` returns the full breakdown for a campaign.
 *
 * Event methods upsert (SET ... if_not_exists) so an event that arrives before
 * (or without) the roster snapshot still creates a coherent record.
 */
class SendRecipientRepository extends BaseRepository<EmailRecipientRecord> {
  constructor() {
    super('admin', false) // tee-admin table, pkey/skey naming
  }

  protected buildSheetPK(): string {
    return 'SEND'
  }

  private static skey(email: string): string {
    return `RECIPIENT#${email.toLowerCase()}`
  }

  /**
   * Persist the intended-recipient roster for a campaign (best-effort).
   *
   * **Non-destructive upsert**, NOT a batch put. Each row is written with
   * `if_not_exists` on identity/status/sentAt, and `opens`/`clicks`/`deliveredAt`
   * are never set here. This is critical: SES Delivery/Open events for early
   * recipients arrive (via the webhook's `recordDelivery/Open`) *before or during*
   * this snapshot. The previous `batchWrite` PutRequest overwrote those rows —
   * erasing `deliveredAt` and resetting `opens` to 0 (the write-ordering bug that
   * made deliveries under-count). An `if_not_exists` upsert leaves any
   * event-written fields intact regardless of ordering.
   *
   * Runs one UpdateItem per recipient (bounded concurrency). For very large lists
   * this is more writes than a batch; the `RECIPIENT_TRACKING_ENABLED=false` kill
   * switch remains the escape hatch for thousands-of-recipients sends.
   */
  async snapshotRoster(
    campaignId: string,
    recipients: Array<{ email: string; status: 'sent' | 'failed'; ecclesia?: string }>
  ): Promise<void> {
    if (recipients.length === 0) return
    const now = new Date().toISOString()
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS

    const writeOne = (r: { email: string; status: 'sent' | 'failed'; ecclesia?: string }) => {
      const setParts = [
        'campaignId = if_not_exists(campaignId, :cid)',
        'email = if_not_exists(email, :em)',
        '#status = if_not_exists(#status, :st)',
        'sentAt = if_not_exists(sentAt, :now)',
        '#ttl = if_not_exists(#ttl, :ttl)',
      ]
      const values: Record<string, any> = {
        ':cid': campaignId,
        ':em': r.email.toLowerCase(),
        ':st': r.status,
        ':now': now,
        ':ttl': ttl,
      }
      if (r.ecclesia) {
        setParts.push('ecclesia = if_not_exists(ecclesia, :ecc)')
        values[':ecc'] = r.ecclesia
      }
      return docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pkey: `SEND#${campaignId}`, skey: SendRecipientRepository.skey(r.email) },
          UpdateExpression: `SET ${setParts.join(', ')}`,
          ExpressionAttributeNames: { '#status': 'status', '#ttl': 'ttl' },
          ExpressionAttributeValues: values,
        })
      )
    }

    // Bounded concurrency so a large roster doesn't fan out unboundedly.
    const CHUNK = 25
    for (let i = 0; i < recipients.length; i += CHUNK) {
      const results = await Promise.allSettled(recipients.slice(i, i + CHUNK).map(writeOne))
      const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
      if (failed.length > 0) {
        // Best-effort roster — log but never throw (never fail a send over tracking).
        console.error(
          `snapshotRoster: ${failed.length} recipient write(s) failed for ${campaignId}:`,
          failed[0].reason
        )
      }
    }
  }

  /** Shared upsert: ensures identity fields exist, then applies event-specific changes. */
  private async applyEvent(
    campaignId: string,
    email: string,
    extra: {
      set?: Record<string, string> // attrName -> valuePlaceholderKey
      add?: Record<string, string> // attrName -> valuePlaceholderKey
      names?: Record<string, string>
      values?: Record<string, any>
    }
  ): Promise<void> {
    const now = new Date().toISOString()
    const ttl = Math.floor(Date.now() / 1000) + TTL_SECONDS

    const names: Record<string, string> = {
      '#status': 'status',
      '#ttl': 'ttl',
      '#lastUpdated': 'lastUpdated',
      ...(extra.names ?? {}),
    }
    const values: Record<string, any> = {
      ':cid': campaignId,
      ':em': email.toLowerCase(),
      ':sent': 'sent',
      ':now': now,
      ':ttl': ttl,
      ...(extra.values ?? {}),
    }

    // Note: opens/clicks are NOT initialized here — recordOpen/recordClick ADD
    // them (ADD treats a missing attribute as 0), and a SET + ADD on the same
    // path in one expression is rejected. Reads default missing counters to 0.
    const setParts = [
      'campaignId = if_not_exists(campaignId, :cid)',
      'email = if_not_exists(email, :em)',
      '#status = if_not_exists(#status, :sent)',
      'sentAt = if_not_exists(sentAt, :now)',
      '#ttl = if_not_exists(#ttl, :ttl)',
      '#lastUpdated = :now',
      ...Object.entries(extra.set ?? {}).map(([n, v]) => `${n} = ${v}`),
    ]

    const addParts = Object.entries(extra.add ?? {}).map(([n, v]) => `${n} ${v}`)

    let expr = `SET ${setParts.join(', ')}`
    if (addParts.length) expr += ` ADD ${addParts.join(', ')}`

    try {
      await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pkey: `SEND#${campaignId}`, skey: SendRecipientRepository.skey(email) },
          UpdateExpression: expr,
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        })
      )
    } catch (error) {
      console.error(`Error recording recipient event for ${email} / ${campaignId}:`, error)
      // Best-effort — never throw from the webhook path.
    }
  }

  recordDelivery(campaignId: string, email: string) {
    return this.applyEvent(campaignId, email, { set: { deliveredAt: 'if_not_exists(deliveredAt, :now)' } })
  }

  recordOpen(campaignId: string, email: string) {
    return this.applyEvent(campaignId, email, {
      set: { lastOpenAt: ':now' },
      add: { opens: ':one' },
      values: { ':one': 1 },
    })
  }

  recordClick(campaignId: string, email: string) {
    return this.applyEvent(campaignId, email, {
      set: { lastClickAt: ':now' },
      add: { clicks: ':one' },
      values: { ':one': 1 },
    })
  }

  recordBounce(campaignId: string, email: string, bounceType?: string) {
    return this.applyEvent(campaignId, email, {
      set: { bouncedAt: ':now', bounceType: ':bt' },
      values: { ':bt': bounceType ?? 'Unknown' },
    })
  }

  recordComplaint(campaignId: string, email: string) {
    return this.applyEvent(campaignId, email, { set: { complainedAt: ':now' } })
  }

  /** Full per-recipient breakdown for one campaign (paginated). */
  async getCampaignRecipients(campaignId: string): Promise<CampaignRecipient[]> {
    const out: CampaignRecipient[] = []
    let lastKey: Record<string, any> | undefined
    do {
      const { items, lastEvaluatedKey } = await this.query(
        'pkey = :pk AND begins_with(skey, :sk)',
        { ':pk': `SEND#${campaignId}`, ':sk': 'RECIPIENT#' },
        { lastEvaluatedKey: lastKey }
      )
      for (const r of items) {
        out.push({
          email: r.email,
          ecclesia: r.ecclesia,
          status: r.status,
          sentAt: r.sentAt,
          deliveredAt: r.deliveredAt,
          opens: r.opens ?? 0,
          lastOpenAt: r.lastOpenAt,
          clicks: r.clicks ?? 0,
          lastClickAt: r.lastClickAt,
          bouncedAt: r.bouncedAt,
          bounceType: r.bounceType,
          complainedAt: r.complainedAt,
        })
      }
      lastKey = lastEvaluatedKey
    } while (lastKey)
    return out
  }
}

export const sendRecipientRepository = new SendRecipientRepository()
