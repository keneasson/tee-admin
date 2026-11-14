import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from './base-repository'
import { docClient } from '../config'
import { KEYS, PATTERNS, patternEntry } from '../access-patterns'
import type { RegistryEntry } from '../../schedule-sources/types'

/**
 * The schedule registry (docs/ECCLESIA_SCHEDULES.md §Data). `tee-admin`,
 * lowercase `pkey`/`skey`. The one writer of `scheduleRegistryByEcclesia` and
 * `scheduleSourcesAll`.
 *
 *   ECCLESIA_SCHEDULES#{ecclesiaId} / SCHEDULE#{scheduleId}    one entry
 *     gsi4pk SCHEDULE_SOURCES / gsi4sk {ecclesiaId}#{scheduleId}  (nightly sync list)
 *   SCHEDULE_SHEET_CLAIM#{spreadsheetId} / CLAIM               one sheet → one ecclesia
 *
 * Built-in (site-configured) entries are never stored; `builtIn` is stripped.
 */

export interface SheetClaim {
  spreadsheetId: string
  ecclesiaId: string
  scheduleId: string
  claimedAt: string
}

const CLAIM_SK = 'CLAIM'

export class ScheduleRegistryRepository extends BaseRepository<Record<string, any>> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for ScheduleRegistryRepository')
  }

  /** The stored item for an entry (exposed for tests). */
  static toItem(entry: RegistryEntry): Record<string, any> {
    const { builtIn: _builtIn, ...stored } = entry
    return {
      pkey: KEYS.ecclesiaSchedules(entry.ecclesiaId),
      skey: KEYS.scheduleEntry(entry.scheduleId),
      ...stored,
      ...patternEntry(PATTERNS.scheduleSourcesAll, undefined, `${entry.ecclesiaId}#${entry.scheduleId}`),
    }
  }

  static fromItem(item: Record<string, any>): RegistryEntry {
    const { pkey: _p, skey: _s, gsi4pk: _g, gsi4sk: _k, lastUpdated: _l, version: _v, ...entry } = item
    return entry as RegistryEntry
  }

  async listEntries(ecclesiaId: string): Promise<RegistryEntry[]> {
    const items = await this.queryPattern(PATTERNS.scheduleRegistryByEcclesia, { ecclesiaId })
    return items.map(ScheduleRegistryRepository.fromItem)
  }

  async getEntry(ecclesiaId: string, scheduleId: string): Promise<RegistryEntry | null> {
    const item = await this.get(KEYS.ecclesiaSchedules(ecclesiaId), KEYS.scheduleEntry(scheduleId))
    return item ? ScheduleRegistryRepository.fromItem(item) : null
  }

  async putEntry(entry: RegistryEntry): Promise<void> {
    if (entry.builtIn) throw new Error('Built-in schedule entries come from site configuration and are never stored')
    await this.put(ScheduleRegistryRepository.toItem(entry))
  }

  async deleteEntry(ecclesiaId: string, scheduleId: string): Promise<void> {
    await this.delete(KEYS.ecclesiaSchedules(ecclesiaId), KEYS.scheduleEntry(scheduleId))
  }

  /** Every stored entry of every ecclesia, one Query (the nightly sync filters by source). */
  async listAllEntries(): Promise<RegistryEntry[]> {
    const items = await this.queryPattern(PATTERNS.scheduleSourcesAll, undefined)
    return items.map(ScheduleRegistryRepository.fromItem)
  }

  async getSheetClaim(spreadsheetId: string): Promise<SheetClaim | null> {
    const item = await this.get(KEYS.scheduleSheetClaim(spreadsheetId), CLAIM_SK)
    if (!item) return null
    return {
      spreadsheetId: item.spreadsheetId,
      ecclesiaId: item.ecclesiaId,
      scheduleId: item.scheduleId,
      claimedAt: item.claimedAt,
    }
  }

  /**
   * Claim a spreadsheet for one ecclesia. True when the claim is now held by
   * this ecclesia (new, or already its own); false when another ecclesia holds it.
   */
  async claimSheet(spreadsheetId: string, ecclesiaId: string, scheduleId: string): Promise<boolean> {
    try {
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pkey: KEYS.scheduleSheetClaim(spreadsheetId),
            skey: CLAIM_SK,
            spreadsheetId,
            ecclesiaId,
            scheduleId,
            claimedAt: new Date().toISOString(),
          },
          ConditionExpression: 'attribute_not_exists(pkey) OR ecclesiaId = :eid',
          ExpressionAttributeValues: { ':eid': ecclesiaId },
        })
      )
      return true
    } catch (error: any) {
      if (error?.name === 'ConditionalCheckFailedException') return false
      throw error
    }
  }

  /** Release a claim this ecclesia holds. A claim held by another ecclesia is left alone. */
  async releaseSheetClaim(spreadsheetId: string, ecclesiaId: string): Promise<void> {
    try {
      await docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { pkey: KEYS.scheduleSheetClaim(spreadsheetId), skey: CLAIM_SK },
          ConditionExpression: 'ecclesiaId = :eid',
          ExpressionAttributeValues: { ':eid': ecclesiaId },
        })
      )
    } catch (error: any) {
      if (error?.name === 'ConditionalCheckFailedException') return
      throw error
    }
  }
}

export const scheduleRegistryRepository = new ScheduleRegistryRepository()
