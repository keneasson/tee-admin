import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import { getContinent, isValidRegion, type Region } from '@my/app/config/regions'
import type {
  MailingListRecord,
  ListSubscriptionRecord,
  MailingListScope,
  MailingListOwnerType,
  ConsentCategory,
} from '../types'

/**
 * Repository for the multi-tenant mailing-list registry (Phase 1 of moving
 * subscriptions in-house). Two entity types share the `tee-admin` table:
 *
 *  - MailingListRecord      pkey LIST#{listId}       skey DETAILS
 *  - ListSubscriptionRecord pkey PERSON#{personId}   skey SUB#{listId}#{emailId}
 *
 * GSIs used (all are existing, overloaded indexes on `tee-admin`; GSI keys are
 * per-item so different entity types coexist safely in the same index):
 *  - gsi1: lists by tenant (TENANT#…) AND subscriptions by list (LISTSUB#…)
 *  - gsi2: lists by scope  (SCOPE#…)
 *
 * Nothing in the send path or UI reads these yet — the whole feature is dark
 * behind the MAILING_LIST_REGISTRY flag.
 */
export class MailingListRepository extends BaseRepository<MailingListRecord> {
  constructor() {
    super('admin', false) // lowercase keys (pkey, skey), numeric version
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for MailingListRepository')
  }

  // ---- key builders -------------------------------------------------------

  private listPk(listId: string): string {
    return `LIST#${listId}`
  }

  private tenantGsi1Pk(ownerType: MailingListOwnerType, ownerName: string): string {
    return `TENANT#${ownerType}#${ownerName}`
  }

  private scopeGsi2Pk(scope: MailingListScope, scopeValue: string): string {
    return `SCOPE#${scope}#${scopeValue}`
  }

  private subSk(listId: string, emailId: string): string {
    return `SUB#${listId}#${emailId}`
  }

  // ===== LISTS =============================================================

  async createList(input: {
    ownerType: MailingListOwnerType
    ownerName: string
    scope: MailingListScope
    scopeValue: string
    category: ConsentCategory
    key: string
    name: string
    description: string
    defaultOptIn?: boolean
    status?: 'active' | 'archived'
    sesTopic?: string
    listId?: string // allow a caller-supplied id for deterministic seeding
  }): Promise<MailingListRecord> {
    const listId = input.listId || uuidv4()
    const now = new Date().toISOString()

    const record: MailingListRecord = {
      pkey: this.listPk(listId),
      skey: 'DETAILS',
      gsi1pk: this.tenantGsi1Pk(input.ownerType, input.ownerName),
      gsi1sk: `${input.scope}#${input.name}`,
      gsi2pk: this.scopeGsi2Pk(input.scope, input.scopeValue),
      gsi2sk: `${input.ownerName}#${input.name}`,
      listId,
      ownerType: input.ownerType,
      ownerName: input.ownerName,
      scope: input.scope,
      scopeValue: input.scopeValue,
      category: input.category,
      key: input.key,
      name: input.name,
      description: input.description,
      defaultOptIn: input.defaultOptIn ?? false,
      status: input.status ?? 'active',
      // Only persist sesTopic when provided (removeUndefinedValues drops it otherwise).
      ...(input.sesTopic ? { sesTopic: input.sesTopic } : {}),
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)
    return record
  }

  async getList(listId: string): Promise<MailingListRecord | null> {
    return this.get(this.listPk(listId), 'DETAILS')
  }

  /** All lists owned by a tenant (active + archived), via GSI1. */
  async listByTenant(
    ownerType: MailingListOwnerType,
    ownerName: string
  ): Promise<MailingListRecord[]> {
    const result = await this.query(
      'gsi1pk = :gsi1pk',
      { ':gsi1pk': this.tenantGsi1Pk(ownerType, ownerName) },
      { indexName: 'gsi1' }
    )
    return result.items
  }

  /** Active lists offered at a given scope, via GSI2. */
  async listByScope(
    scope: MailingListScope,
    scopeValue: string
  ): Promise<MailingListRecord[]> {
    const result = await this.query(
      'gsi2pk = :gsi2pk',
      { ':gsi2pk': this.scopeGsi2Pk(scope, scopeValue) },
      { indexName: 'gsi2' }
    )
    return result.items.filter((l) => l.status === 'active')
  }

  async archiveList(listId: string): Promise<MailingListRecord> {
    return this.update(this.listPk(listId), 'DETAILS', {
      status: 'archived',
    } as Partial<MailingListRecord>)
  }

  /**
   * Every active list OFFERED to a person, deduped by listId, across the scope
   * ladder ecclesia → region → continent → global.
   *
   * `region` must be resolved by the caller (a PersonRecord carries no region,
   * and ecclesia→region resolution lives in apps/next which packages/* cannot
   * import). When region is omitted/unknown, region + continent scopes are
   * skipped (ecclesia + global still apply). The continent is derived here from
   * the region via getContinent.
   */
  async getOfferedListsForPerson(
    person: { ecclesia?: string | null },
    region?: string | null
  ): Promise<MailingListRecord[]> {
    const queries: Array<Promise<MailingListRecord[]>> = []

    if (person.ecclesia) {
      queries.push(this.listByScope('ecclesia', person.ecclesia))
    }
    if (region && isValidRegion(region)) {
      queries.push(this.listByScope('region', region))
      const continent = getContinent(region as Region)
      if (continent) queries.push(this.listByScope('continent', continent))
    }
    queries.push(this.listByScope('global', ''))

    const results = await Promise.all(queries)

    const byId = new Map<string, MailingListRecord>()
    for (const list of results.flat()) {
      byId.set(list.listId, list)
    }
    return Array.from(byId.values())
  }

  // ===== SUBSCRIPTIONS =====================================================
  //
  // Subscriptions are stored as their own items and cast to MailingListRecord
  // only to satisfy BaseRepository<T>'s single type parameter (the same
  // technique person-repository uses to write EMAIL#/PHONE# rows through the
  // PersonRecord-typed repo).

  /** Upsert an opt-in subscription for one person's email onto a list. */
  async subscribe(input: {
    personId: string
    listId: string
    emailId: string
    email: string
    source: ListSubscriptionRecord['source']
    basis: ListSubscriptionRecord['basis']
  }): Promise<ListSubscriptionRecord> {
    const now = new Date().toISOString()
    const email = input.email.toLowerCase()

    const record: ListSubscriptionRecord = {
      pkey: `PERSON#${input.personId}`,
      skey: this.subSk(input.listId, input.emailId),
      gsi1pk: `LISTSUB#${input.listId}`,
      gsi1sk: email,
      listId: input.listId,
      emailId: input.emailId,
      email,
      status: 'opt_in',
      source: input.source,
      basis: input.basis,
      subscribedAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record as unknown as MailingListRecord)
    return record
  }

  /**
   * Opt a person's email OUT of a list. The row is KEPT (status flip) for the
   * audit trail — never deleted.
   */
  async unsubscribe(input: {
    personId: string
    listId: string
    emailId: string
  }): Promise<ListSubscriptionRecord> {
    return this.update(
      `PERSON#${input.personId}`,
      this.subSk(input.listId, input.emailId),
      { status: 'opt_out' } as unknown as Partial<MailingListRecord>
    ) as unknown as Promise<ListSubscriptionRecord>
  }

  /** All of a person's list subscriptions (opt_in + opt_out). */
  async getPersonSubscriptions(personId: string): Promise<ListSubscriptionRecord[]> {
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': `PERSON#${personId}`, ':skPrefix': 'SUB#' }
    )
    return result.items as unknown as ListSubscriptionRecord[]
  }

  /** Opted-in subscribers for a list, via GSI1 (send-path fan-out). */
  async listSubscribers(listId: string): Promise<ListSubscriptionRecord[]> {
    const result = await this.query(
      'gsi1pk = :gsi1pk',
      { ':gsi1pk': `LISTSUB#${listId}` },
      { indexName: 'gsi1' }
    )
    return (result.items as unknown as ListSubscriptionRecord[]).filter(
      (s) => s.status === 'opt_in'
    )
  }
}

// Export singleton instance
export const mailingListRepository = new MailingListRepository()
