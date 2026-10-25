import { BaseRepository } from './base-repository'
import type { FeatureFlagRecord } from '../types'
import {
  DEFAULT_FEATURE_FLAG_CONFIGS,
  type FeatureFlagConfig,
} from '@my/app/features/feature-flags/feature-flags'

const CACHE_TTL_MS = 60 * 1000 // 60 seconds

let flagCache: {
  data: Record<string, FeatureFlagConfig>
  timestamp: number
} | null = null

class FeatureFlagRepository extends BaseRepository<FeatureFlagRecord> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for FeatureFlagRepository')
  }

  private pk(flagName: string): string {
    return `FEATURE_FLAG#${flagName}`
  }

  async getByName(flagName: string): Promise<FeatureFlagRecord | null> {
    return this.get(this.pk(flagName), 'CONFIG')
  }

  /**
   * Each flag the code knows, read by its key. A flag only does anything when
   * code checks it, so these are all the flags there are. (A filtered Scan
   * returned only the table's first page: rows saved later were never seen.)
   */
  async getAllAsConfigs(): Promise<Record<string, FeatureFlagConfig>> {
    const names = Object.keys(DEFAULT_FEATURE_FLAG_CONFIGS)
    const records = await Promise.all(names.map((name) => this.getByName(name)))
    const configs: Record<string, FeatureFlagConfig> = {}
    for (const record of records) {
      if (!record) continue
      configs[record.flagName] = {
        description: record.description || '',
        visibleTo: record.visibleTo || 'owner',
        users: record.users || [],
      }
    }
    return configs
  }

  /**
   * Flag configs with in-memory caching (60s TTL): the code default for each
   * flag, overridden by its DB row when one exists.
   */
  async getAllCached(): Promise<Record<string, FeatureFlagConfig>> {
    const now = Date.now()
    if (flagCache && (now - flagCache.timestamp) < CACHE_TTL_MS) {
      return flagCache.data
    }

    const merged: Record<string, FeatureFlagConfig> = {
      ...DEFAULT_FEATURE_FLAG_CONFIGS,
      ...(await this.getAllAsConfigs()),
    }

    flagCache = { data: merged, timestamp: now }
    return merged
  }

  async createFlag(flagName: string, config: FeatureFlagConfig): Promise<FeatureFlagRecord> {
    const record: FeatureFlagRecord = {
      pkey: this.pk(flagName),
      skey: 'CONFIG',
      flagName,
      description: config.description,
      visibleTo: config.visibleTo,
      users: config.users || [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record)
    this.invalidateCache()
    return record
  }

  async updateFlag(flagName: string, updates: Partial<FeatureFlagConfig>): Promise<FeatureFlagRecord> {
    const result = await this.update(this.pk(flagName), 'CONFIG', updates as Partial<FeatureFlagRecord>)
    this.invalidateCache()
    return result
  }

  async deleteFlag(flagName: string): Promise<void> {
    await this.delete(this.pk(flagName), 'CONFIG')
    this.invalidateCache()
  }

  invalidateCache(): void {
    flagCache = null
  }
}

export const featureFlagRepository = new FeatureFlagRepository()
