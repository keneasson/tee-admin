import { PutCommand, DeleteCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, tableNames } from '../config'

/**
 * Idempotency guard for the exhorter heads-up email (#124, slice A).
 *
 * One record per (target Sunday, exhorter) in the app-managed `tee-admin` table:
 *
 *   pkey: EXHORTER_HEADSUP#{date}#{personId}
 *   skey: SEND
 *
 * `claim()` is an atomic conditional put (attribute_not_exists) — mirrors the
 * claim pattern in `send-queue-repository.ts` — so a re-run or a schedule edit
 * can NEVER double-send to the same speaker for the same Sunday. LIVE sends only;
 * TEST mode writes nothing (see resolveAndSendExhorterHeadsUp), so tests can
 * repeat freely.
 */

function idempotencyPk(date: string, personId: string): string {
  return `EXHORTER_HEADSUP#${date}#${personId}`
}

export interface ClaimHeadsUpInput {
  date: string // ISO YYYY-MM-DD (target Sunday)
  personId: string
  sentTo: string
  createdBy: string
}

export interface ParkPendingInput {
  date: string // ISO YYYY-MM-DD (target Sunday)
  personId: string // the EXHORTER
  token: string // secret in the release link
  recipientEmail: string // where the real email will go
  recipientName?: string
  previewedBy: string // who was shown the preview
  expiresAt: string // ISO 8601; past this the link is dead
}

export interface PendingHeadsUp {
  date: string
  personId: string
  token: string
  recipientEmail: string
  recipientName?: string
  expiresAt: string
  /** Set once released — a second click must not send again. */
  releasedAt?: string
}

class ExhorterHeadsUpRepository {
  private tableName = tableNames.admin

  /**
   * Atomically claim the (date, personId) slot BEFORE sending. Returns true when
   * the claim was written (safe to send), false when a record already exists
   * (already sent — skip). Race-safe via the conditional put.
   */
  async claim(input: ClaimHeadsUpInput): Promise<boolean> {
    const now = new Date().toISOString()
    try {
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pkey: idempotencyPk(input.date, input.personId),
            skey: 'SEND',
            date: input.date,
            personId: input.personId,
            sentTo: input.sentTo,
            createdBy: input.createdBy,
            createdAt: now,
          },
          ConditionExpression: 'attribute_not_exists(pkey)',
        })
      )
      return true
    } catch (error: any) {
      if (error?.name === 'ConditionalCheckFailedException') {
        return false // Already claimed / sent — skip.
      }
      throw error
    }
  }

  /**
   * Park a rendered heads-up awaiting a human's go-ahead.
   *
   * The Saturday job does not email the speaker. It emails the Recording
   * Brother a preview and a one-click link; only that click sends the real
   * thing. Until a few weeks of these have been read and trusted, a cron must
   * not be able to write to a visiting brother on its own.
   *
   * Stored under the same (date, personId) pair as the send claim, so the two
   * live together and the pending record can be found from the link alone.
   */
  async parkPending(input: ParkPendingInput): Promise<void> {
    const now = new Date().toISOString()
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pkey: idempotencyPk(input.date, input.personId),
          skey: `PENDING#${input.token}`,
          gsi4pk: `EXHORTER_RELEASE#${input.token}`,
          gsi4sk: input.expiresAt,
          date: input.date,
          personId: input.personId,
          token: input.token,
          recipientEmail: input.recipientEmail,
          recipientName: input.recipientName,
          previewedBy: input.previewedBy,
          expiresAt: input.expiresAt,
          createdAt: now,
        },
        // One pending record per token; a re-run mints a new token rather than
        // overwriting, so an earlier link cannot be silently repointed.
        ConditionExpression: 'attribute_not_exists(skey)',
      })
    )
  }

  /** Find a parked heads-up by the token in a release link. */
  async findPendingByToken(token: string): Promise<PendingHeadsUp | null> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'gsi4',
        KeyConditionExpression: 'gsi4pk = :t',
        ExpressionAttributeValues: { ':t': `EXHORTER_RELEASE#${token}` },
        Limit: 1,
      })
    )
    const item = res.Items?.[0]
    if (!item) return null
    return {
      date: String(item.date),
      personId: String(item.personId),
      token: String(item.token),
      recipientEmail: String(item.recipientEmail),
      recipientName: item.recipientName ? String(item.recipientName) : undefined,
      expiresAt: String(item.expiresAt),
      releasedAt: item.releasedAt ? String(item.releasedAt) : undefined,
    }
  }

  /**
   * Mark a parked heads-up as released, atomically.
   *
   * Returns false if it was already released — a double-click, a forwarded
   * link, a mail client prefetching the URL. The speaker must not receive two
   * emails because someone clicked twice.
   */
  async markReleased(
    date: string,
    personId: string,
    token: string,
    releasedBy: string
  ): Promise<boolean> {
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { pkey: idempotencyPk(date, personId), skey: `PENDING#${token}` },
          UpdateExpression: 'SET releasedAt = :now, releasedBy = :by',
          ConditionExpression: 'attribute_exists(skey) AND attribute_not_exists(releasedAt)',
          ExpressionAttributeValues: { ':now': new Date().toISOString(), ':by': releasedBy },
        })
      )
      return true
    } catch (error: any) {
      if (error?.name === 'ConditionalCheckFailedException') return false
      throw error
    }
  }

  /**
   * Release a claim — used when a send throws AFTER the claim, so a manual retry
   * can re-send. Best-effort; a failed release is logged, not thrown.
   */
  async release(date: string, personId: string): Promise<void> {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pkey: idempotencyPk(date, personId), skey: 'SEND' },
        })
      )
    } catch (error) {
      console.error('[exhorter-headsup] failed to release claim (non-fatal):', error)
    }
  }
}

export const exhorterHeadsUpRepository = new ExhorterHeadsUpRepository()
