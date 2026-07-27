import { PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
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
