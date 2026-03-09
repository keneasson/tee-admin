import { BaseRepository } from './base-repository'
import type { FeatureFlagRecord } from '../types'
import type { FeatureFlagConfig } from '@my/app/features/feature-flags/feature-flags'

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
        enabled: record.enabled,
        rolloutPercentage: record.rolloutPercentage,
        userRoles: record.userRoles,
        description: record.description,
        environment: record.environment,
        userOverrides: record.userOverrides,
      }
    }
    return configs
  }

  /**
   * Get all flag configs with in-memory caching (60s TTL).
   * Seeds from defaults if DynamoDB has no flags.
   */
  async getAllCached(): Promise<Record<string, FeatureFlagConfig>> {
    const now = Date.now()
    if (flagCache && (now - flagCache.timestamp) < CACHE_TTL_MS) {
      return flagCache.data
    }

    let configs = await this.getAllAsConfigs()

    // Seed from defaults if empty
    if (Object.keys(configs).length === 0) {
      await this.seedFromDefaults()
      configs = await this.getAllAsConfigs()
    }

    flagCache = { data: configs, timestamp: now }
    return configs
  }

  async createFlag(flagName: string, config: FeatureFlagConfig): Promise<FeatureFlagRecord> {
    const record: FeatureFlagRecord = {
      pkey: this.pk(flagName),
      skey: 'CONFIG',
      flagName,
      enabled: config.enabled,
      rolloutPercentage: config.rolloutPercentage,
      userRoles: config.userRoles,
      description: config.description,
      environment: config.environment,
      userOverrides: config.userOverrides,
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
    // Dynamic import to avoid circular dependency
    const { DEFAULT_FEATURE_FLAG_CONFIGS } = await import('@my/app/features/feature-flags/feature-flags')

    for (const [flagName, config] of Object.entries(DEFAULT_FEATURE_FLAG_CONFIGS)) {
      const existing = await this.getByName(flagName)
      if (!existing) {
        await this.createFlag(flagName, config)
      }
    }
  }
}

export const featureFlagRepository = new FeatureFlagRepository()
