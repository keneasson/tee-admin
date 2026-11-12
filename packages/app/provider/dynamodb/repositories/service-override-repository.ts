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
  roleFields?: Record<string, string>
  roleFieldRefs?: Record<string, string>
  createdBy: string
}

export interface RoleFieldChange {
  ecclesia: string
  serviceType: ServiceOverrideType
  date: string // YYYY-MM-DD
  field: string // catalogue fieldKey, e.g. 'Exhort' | 'Speaker'
  /** The display name to set, or null to remove the field from the overlay. */
  value: string | null
  /** The PersonRecord id behind `value` (ignored when value is null). */
  personId?: string
  /**
   * With value '': the synced Sheet value this blank hides. The blank then
   * applies only while the Sheet still says that (see merge.ts).
   */
  suppress?: string
  by: string
}

/**
 * A role-field overlay write that can join a DynamoDB transaction.
 *
 * `upsert()` is read-then-put of the whole record, so it cannot sit inside a
 * TransactWrite. Speaker invitations must move a booking and its overlay
 * together (accept / change / cancel / swap), so this builds the SAME record
 * `upsert()` would — merging one field into the existing `roleFields` /
 * `roleFieldRefs` — and pairs it with an optimistic-lock condition on the
 * version that was read. If anyone else edits the override in between, the
 * whole transaction fails instead of silently overwriting their change.
 */
export interface OverrideTransactPut {
  Put: {
    TableName: string
    Item: ServiceOccurrenceOverrideRecord
    ConditionExpression: string
    ExpressionAttributeValues?: Record<string, any>
  }
}

const buildPk = (ecclesia: string) => `SERVICE_OVERRIDE#${ecclesia}`

/**
 * An admin edit (upsert) keeps a speaker-invite conditional blank only for the
 * keys it leaves as '' — so editing the note doesn't turn a conditional blank
 * into an unconditional one, and typing a name over it drops the condition.
 */
function keptSuppress(
  existing: ServiceOccurrenceOverrideRecord | null,
  roleFields: Record<string, string> | undefined
): { roleFieldSuppress?: Record<string, string> } {
  const fields = roleFields
  if (!existing?.roleFieldSuppress || !fields) return {}
  const kept = Object.fromEntries(
    Object.entries(existing.roleFieldSuppress).filter(([k]) => fields[k] === '')
  )
  return Object.keys(kept).length > 0 ? { roleFieldSuppress: kept } : {}
}
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
      ...(input.roleFields !== undefined ? { roleFields: input.roleFields } : {}),
      ...(input.roleFieldRefs !== undefined ? { roleFieldRefs: input.roleFieldRefs } : {}),
      ...keptSuppress(existing, input.roleFields),
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

  /**
   * Build a transactable put that sets (or removes) ONE role field on the
   * occurrence's overlay, leaving every other overlay field as it was.
   * `existing` is the record as read (null when there is none).
   */
  buildRoleFieldPut(
    existing: ServiceOccurrenceOverrideRecord | null | undefined,
    change: RoleFieldChange
  ): OverrideTransactPut {
    const now = new Date().toISOString()
    const roleFields = { ...(existing?.roleFields ?? {}) }
    const roleFieldRefs = { ...(existing?.roleFieldRefs ?? {}) }
    const roleFieldSuppress = { ...(existing?.roleFieldSuppress ?? {}) }
    if (change.value === '' && change.suppress) roleFieldSuppress[change.field] = change.suppress
    else delete roleFieldSuppress[change.field]
    if (change.value === null) {
      delete roleFields[change.field]
      delete roleFieldRefs[change.field]
    } else {
      roleFields[change.field] = change.value
      if (change.personId) roleFieldRefs[change.field] = change.personId
      else delete roleFieldRefs[change.field]
    }

    const readVersion = existing?.version
    const item: ServiceOccurrenceOverrideRecord = {
      ...(existing ?? {}),
      pkey: buildPk(change.ecclesia),
      skey: buildSk(change.serviceType, change.date),
      ecclesia: change.ecclesia,
      serviceType: change.serviceType,
      date: change.date,
      createdBy: existing?.createdBy ?? change.by,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastUpdated: now,
      version: (typeof readVersion === 'number' ? readVersion : 0) + 1,
    } as ServiceOccurrenceOverrideRecord
    if (Object.keys(roleFields).length > 0) item.roleFields = roleFields
    else delete item.roleFields
    if (Object.keys(roleFieldRefs).length > 0) item.roleFieldRefs = roleFieldRefs
    else delete item.roleFieldRefs
    if (Object.keys(roleFieldSuppress).length > 0) item.roleFieldSuppress = roleFieldSuppress
    else delete item.roleFieldSuppress

    if (!existing) {
      return { Put: { TableName: this.tableName, Item: item, ConditionExpression: 'attribute_not_exists(pkey)' } }
    }
    if (typeof readVersion !== 'number') {
      return {
        Put: { TableName: this.tableName, Item: item, ConditionExpression: 'attribute_exists(pkey) AND attribute_not_exists(version)' },
      }
    }
    return {
      Put: {
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'version = :overrideReadVersion',
        ExpressionAttributeValues: { ':overrideReadVersion': readVersion },
      },
    }
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
