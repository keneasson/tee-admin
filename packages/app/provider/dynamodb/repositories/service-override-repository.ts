import { BaseRepository } from './base-repository'
import type {
  ServiceOccurrenceOverrideRecord,
  ServiceOverrideType,
  OverrideStatus,
  AttendOption,
} from '../service-override-types'

export interface UpsertOverrideInput {
  ecclesia: string
  serviceType: ServiceOverrideType
  date: string // YYYY-MM-DD (UTC-normalized)
  status?: OverrideStatus
  message?: string
  note?: string
  attendOptions?: AttendOption[]
  createdBy: string
}

const buildPk = (ecclesia: string) => `SERVICE_OVERRIDE#${ecclesia}`
const buildSk = (serviceType: ServiceOverrideType, date: string) => `${serviceType}#${date}`

/**
 * Repository for per-occurrence Service Overrides.
 * Uses 'tee-admin' table with lowercase keys (pkey, skey).
 * PK: SERVICE_OVERRIDE#{ecclesia}, SK: {serviceType}#{date}
 *
 * No GSI: the override set per ecclesia is tiny (a few weeks × 4 service types),
 * so we query the single partition and filter by date range in memory.
 */
export class ServiceOverrideRepository extends BaseRepository<ServiceOccurrenceOverrideRecord> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for ServiceOverrideRepository')
  }

  /**
   * Create or replace an override for (ecclesia, serviceType, date).
   * Preserves the original createdAt/createdBy when one already exists.
   */
  async upsert(input: UpsertOverrideInput): Promise<ServiceOccurrenceOverrideRecord> {
    const pkey = buildPk(input.ecclesia)
    const skey = buildSk(input.serviceType, input.date)
    const now = new Date().toISOString()

    const existing = await this.get(pkey, skey)

    const record: ServiceOccurrenceOverrideRecord = {
      pkey,
      skey,
      ecclesia: input.ecclesia,
      serviceType: input.serviceType,
      date: input.date,
      // Only set optional fields when provided so DynamoDB (removeUndefinedValues)
      // omits them rather than storing empty values.
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.attendOptions !== undefined ? { attendOptions: input.attendOptions } : {}),
      createdBy: existing?.createdBy ?? input.createdBy,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastUpdated: now,
      version: existing?.version ?? 0,
    }

    await this.put(record)
    return record
  }

  /**
   * Get a single override by occurrence identity.
   */
  async getOne(
    ecclesia: string,
    serviceType: ServiceOverrideType,
    date: string
  ): Promise<ServiceOccurrenceOverrideRecord | null> {
    return this.get(buildPk(ecclesia), buildSk(serviceType, date))
  }

  /**
   * List all overrides for an ecclesia within a date range (inclusive).
   * Dates are YYYY-MM-DD strings, comparable lexicographically.
   */
  async listByDateRange(
    ecclesia: string,
    fromISO: string,
    toISO: string
  ): Promise<ServiceOccurrenceOverrideRecord[]> {
    const result = await this.query('pkey = :pk', { ':pk': buildPk(ecclesia) })
    return result.items.filter((item) => item.date >= fromISO && item.date <= toISO)
  }

  /**
   * List all overrides for an ecclesia (used by the admin UI).
   */
  async listByEcclesia(ecclesia: string): Promise<ServiceOccurrenceOverrideRecord[]> {
    const result = await this.query('pkey = :pk', { ':pk': buildPk(ecclesia) })
    return result.items
  }

  async deleteOne(
    ecclesia: string,
    serviceType: ServiceOverrideType,
    date: string
  ): Promise<void> {
    await this.delete(buildPk(ecclesia), buildSk(serviceType, date))
  }
}

export const serviceOverrideRepository = new ServiceOverrideRepository()
