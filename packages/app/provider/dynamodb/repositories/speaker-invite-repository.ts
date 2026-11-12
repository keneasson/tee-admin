import { PutCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from './base-repository'
import { docClient } from '../config'
import { PATTERNS, patternEntry } from '../access-patterns'
import type { OverrideTransactPut } from './service-override-repository'
import {
  speakerInviteKeys,
  type InviteHistoryEntry,
  type SpeakerBookingRecord,
  type SpeakerInviteRecord,
  type SpeakerInviteType,
  type SpeakerSwapRecord,
} from '../speaker-invite-types'

/**
 * Speaker invitations, bookings and swaps (docs/SPEAKER_INVITATIONS.md §5).
 * `tee-admin`, lowercase `pkey`/`skey`.
 *
 * A booking (`SPEAKER_BOOKING#{ecclesia}#{type}` / `{date}`) is the lock on a
 * slot: one item per slot, taken with `attribute_not_exists`. Every change that
 * moves a booking also moves the roster overlay (service override) for that
 * date, and both go in ONE TransactWrite via `commit()` — see
 * `ServiceOverrideRepository.buildRoleFieldPut` for why the overlay can join it.
 */

/** What a booking must currently look like for a write to go ahead. */
export type BookingExpectation =
  | 'absent'
  | {
      personId: string
      /** string = must equal; null = must be absent; undefined = not checked */
      inviteId?: string | null
      openSwapId?: string | null
    }

export type SpeakerWriteOp =
  | { kind: 'putInvite'; invite: SpeakerInviteRecord; expect: 'absent' | { version: number } }
  | { kind: 'putBooking'; booking: SpeakerBookingRecord; expect: BookingExpectation }
  | { kind: 'deleteBooking'; ecclesia: string; type: SpeakerInviteType; date: string; expect: BookingExpectation }
  | { kind: 'putSwap'; swap: SpeakerSwapRecord; expect: 'absent' | { version: number; status: string } }
  | { kind: 'override'; put: OverrideTransactPut }

/** A transaction lost a race: some condition no longer held. Nothing was written. */
export class SpeakerWriteConflict extends Error {
  readonly reasons: string[]
  constructor(reasons: string[]) {
    super(`Speaker invite write conflict: ${reasons.join(', ') || 'condition failed'}`)
    this.name = 'SpeakerWriteConflict'
    this.reasons = reasons
  }
}

function bookingCondition(expect: BookingExpectation): {
  ConditionExpression: string
  ExpressionAttributeValues?: Record<string, any>
} {
  if (expect === 'absent') return { ConditionExpression: 'attribute_not_exists(pkey)' }
  const parts = ['personId = :bkPerson']
  const values: Record<string, any> = { ':bkPerson': expect.personId }
  if (expect.inviteId === null) parts.push('attribute_not_exists(inviteId)')
  else if (expect.inviteId !== undefined) {
    parts.push('inviteId = :bkInvite')
    values[':bkInvite'] = expect.inviteId
  }
  if (expect.openSwapId === null) parts.push('attribute_not_exists(openSwapId)')
  else if (expect.openSwapId !== undefined) {
    parts.push('openSwapId = :bkSwap')
    values[':bkSwap'] = expect.openSwapId
  }
  return { ConditionExpression: parts.join(' AND '), ExpressionAttributeValues: values }
}

export class SpeakerInviteRepository extends BaseRepository<Record<string, any>> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for SpeakerInviteRepository')
  }

  /** The gsi1 listing entry for an invite (one writer: this file). */
  static listingEntry(invite: Pick<SpeakerInviteRecord, 'ecclesia' | 'createdAt' | 'inviteId'>) {
    return patternEntry(
      PATTERNS.speakerInvitesByEcclesia,
      { ecclesia: invite.ecclesia },
      `${invite.createdAt}#${invite.inviteId}`
    ) as { gsi1pk: string; gsi1sk: string }
  }

  async getInvite(inviteId: string): Promise<SpeakerInviteRecord | null> {
    return (await this.get(speakerInviteKeys.invitePk(inviteId), speakerInviteKeys.META)) as SpeakerInviteRecord | null
  }

  /** Newest first. */
  async listInvitesByEcclesia(ecclesia: string): Promise<SpeakerInviteRecord[]> {
    return (await this.queryPattern(PATTERNS.speakerInvitesByEcclesia, { ecclesia }, {
      scanIndexForward: false,
    })) as SpeakerInviteRecord[]
  }

  async getBooking(ecclesia: string, type: SpeakerInviteType, date: string): Promise<SpeakerBookingRecord | null> {
    return (await this.get(speakerInviteKeys.bookingPk(ecclesia, type), date)) as SpeakerBookingRecord | null
  }

  /** Every booking of one ecclesia + type between two dates (inclusive), one partition. */
  async listBookings(
    ecclesia: string,
    type: SpeakerInviteType,
    from: string,
    to: string
  ): Promise<SpeakerBookingRecord[]> {
    const items: SpeakerBookingRecord[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    do {
      const page = await this.query(
        'pkey = :pk AND skey BETWEEN :from AND :to',
        { ':pk': speakerInviteKeys.bookingPk(ecclesia, type), ':from': from, ':to': to },
        { lastEvaluatedKey }
      )
      items.push(...(page.items as SpeakerBookingRecord[]))
      lastEvaluatedKey = page.lastEvaluatedKey
    } while (lastEvaluatedKey)
    return items
  }

  async getSwap(swapId: string): Promise<SpeakerSwapRecord | null> {
    return (await this.get(speakerInviteKeys.swapPk(swapId), speakerInviteKeys.META)) as SpeakerSwapRecord | null
  }

  /** Create a new invite (never overwrites). */
  async createInvite(invite: SpeakerInviteRecord): Promise<void> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: invite,
        ConditionExpression: 'attribute_not_exists(pkey)',
      })
    )
  }

  /**
   * Append history without a version check (used to record side effects such
   * as a failed email AFTER the main write committed). Bumps `version`, so a
   * later write built from an older read fails rather than dropping the entry.
   */
  async appendHistory(inviteId: string, entries: InviteHistoryEntry[]): Promise<void> {
    if (entries.length === 0) return
    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pkey: speakerInviteKeys.invitePk(inviteId), skey: speakerInviteKeys.META },
        UpdateExpression:
          'SET history = list_append(if_not_exists(history, :empty), :entries), updatedAt = :now, version = if_not_exists(version, :zero) + :one',
        ConditionExpression: 'attribute_exists(pkey)',
        ExpressionAttributeValues: {
          ':empty': [],
          ':entries': entries,
          ':now': new Date().toISOString(),
          ':zero': 0,
          ':one': 1,
        },
      })
    )
  }

  /** The TransactWrite items for a set of ops (exposed for tests). */
  buildTransactItems(ops: SpeakerWriteOp[]): any[] {
    return ops.map((op) => {
      switch (op.kind) {
        case 'putInvite':
          return {
            Put: {
              TableName: this.tableName,
              Item: op.invite,
              ...(op.expect === 'absent'
                ? { ConditionExpression: 'attribute_not_exists(pkey)' }
                : {
                    ConditionExpression: 'version = :inviteVersion',
                    ExpressionAttributeValues: { ':inviteVersion': op.expect.version },
                  }),
            },
          }
        case 'putBooking':
          return { Put: { TableName: this.tableName, Item: op.booking, ...bookingCondition(op.expect) } }
        case 'deleteBooking':
          return {
            Delete: {
              TableName: this.tableName,
              Key: { pkey: speakerInviteKeys.bookingPk(op.ecclesia, op.type), skey: op.date },
              ...bookingCondition(op.expect),
            },
          }
        case 'putSwap':
          return {
            Put: {
              TableName: this.tableName,
              Item: op.swap,
              ...(op.expect === 'absent'
                ? { ConditionExpression: 'attribute_not_exists(pkey)' }
                : {
                    ConditionExpression: 'version = :swapVersion AND #swapStatus = :swapStatus',
                    ExpressionAttributeNames: { '#swapStatus': 'status' },
                    ExpressionAttributeValues: { ':swapVersion': op.expect.version, ':swapStatus': op.expect.status },
                  }),
            },
          }
        case 'override':
          return op.put
      }
    })
  }

  /**
   * Apply all ops atomically. Throws SpeakerWriteConflict when any condition
   * fails (nothing is written); other errors propagate.
   */
  async commit(ops: SpeakerWriteOp[]): Promise<void> {
    if (ops.length === 0) return
    try {
      await docClient.send(new TransactWriteCommand({ TransactItems: this.buildTransactItems(ops) }))
    } catch (error: any) {
      if (error?.name === 'TransactionCanceledException' || error?.name === 'ConditionalCheckFailedException') {
        const reasons: string[] = (error.CancellationReasons ?? []).map(
          (r: any, i: number) => `${ops[i]?.kind ?? i}:${r?.Code ?? 'None'}`
        )
        throw new SpeakerWriteConflict(reasons)
      }
      throw error
    }
  }
}

export const speakerInviteRepository = new SpeakerInviteRepository()
