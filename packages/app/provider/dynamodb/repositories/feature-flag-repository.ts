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

  async getAll(): Promise<FeatureFlagRecord[]> {
    const { items } = await this.scan({
      filterExpression: 'begins_with(pkey, :prefix) AND skey = :skey',
      expressionAttributeValues: {
        ':prefix': 'FEATURE_FLAG#',
        ':skey': 'CONFIG',
      },
    })
    return items
  }

  async getAllAsConfigs(): Promise<Record<string, FeatureFlagConfig>> {
    const records = await this.getAll()
    const configs: Record<string, FeatureFlagConfig> = {}
    for (const record of records) {
      configs[record.flagName] = {
        description: record.description || '',
        visibleTo: record.visibleTo || 'owner',
        users: record.users || [],
      }
    }
    return configs
  }

  /**
   * Get all flag configs with in-memory caching (60s TTL).
   *
   * Code defaults (DEFAULT_FEATURE_FLAG_CONFIGS) are the fallback for any flag
   * missing from DynamoDB, with DB rows overriding on a per-flag basis. This
   * means flipping a flag's default in code Just Works: a newly added flag
   * resolves to its code default even when the DB already holds *other* flag
   * rows (previously only an entirely empty DB triggered seeding, so a new flag
   * added alongside existing rows stayed absent → resolved to false for
   * everyone until a row was hand-created).
   *
   * Still seeds an entirely empty DB from defaults so the admin UI has rows to
   * edit; the merge below is what guarantees correctness regardless of seeding.
   */
  async getAllCached(): Promise<Record<string, FeatureFlagConfig>> {
    const now = Date.now()
    if (flagCache && (now - flagCache.timestamp) < CACHE_TTL_MS) {
      return flagCache.data
    }

    let dbConfigs = await this.getAllAsConfigs()

    if (Object.keys(dbConfigs).length === 0) {
      await this.seedFromDefaults()
      dbConfigs = await this.getAllAsConfigs()
    }

    // Code defaults as fallback; DB rows win per flag.
    const merged: Record<string, FeatureFlagConfig> = {
      ...DEFAULT_FEATURE_FLAG_CONFIGS,
      ...dbConfigs,
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

  private async seedFromDefaults(): Promise<void> {
    for (const [flagName, config] of Object.entries(DEFAULT_FEATURE_FLAG_CONFIGS)) {
      const existing = await this.getByName(flagName)
      if (!existing) {
        await this.createFlag(flagName, config)
      }
    }
  }
}

export const featureFlagRepository = new FeatureFlagRepository()
