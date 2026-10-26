import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import { PATTERNS } from '../access-patterns'
import { getContinent, isValidRegion, type Region } from '@my/app/config/regions'
import type {
  MailingListRecord,
  ListSubscriptionRecord,
  MailingListScope,
  MailingListOwnerType,
  ConsentCategory,
} from '../types'

/** gsi4 partition holding one sparse entry per list (the admin listing). */
export const MAILING_LISTS_GSI4PK = PATTERNS.listsAll.pk()

/** The one settings item for list sends (not a list: no gsi entries). */
export const SAFETY_NET_SETTING_KEY = { pkey: 'MAILING_LIST_SETTINGS', skey: 'SAFETY_NET' } as const

/**
 * Whether sends name the SES safety-net topic(s) instead of a list's legacy
 * `sesTopic`. Written ONLY by scripts/ses-safety-net-topics.ts, right after it
 * has replaced the SES topic list (a send naming a topic that does not exist
 * fails, so this must never be on before the topics exist).
 */
export interface SafetyNetSetting {
  enabled: boolean
  /**
   * True only while scripts/ses-safety-net-topics.ts is between replacing the
   * topic list and switching `enabled` on. Every send refuses meanwhile
   * (fail-closed), so nothing goes out while UnsubscribeAll is being checked.
   */
  switching?: boolean
  /** The topic names that exist in SES (for the read-back check). */
  topics: string[]
  enabledAt?: string
}

/**
 * Repository for the mailing-list registry (R5: subscriptions in-house). Two
 * entity types share the `tee-admin` table:
 *
 *  - MailingListRecord      pkey LIST#{listId}       skey DETAILS
 *  - ListSubscriptionRecord pkey PERSON#{personId}   skey SUB#{listId}#{emailId}
 *
 * A list's owner is an ecclesia or organization BY ID. GSIs (existing,
 * overloaded indexes; every entry is sparse):
 *  - gsi1: lists by tenant (TENANT#{ownerType}#{ownerId}) AND subscriptions by
 *          list (LISTSUB#{listId}, sort = email)
 *  - gsi2: lists by scope  (SCOPE#{scope}#{scopeValue})
 *  - gsi4: every list      (MAILING_LISTS)
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

  private tenantGsi1Pk(ownerType: MailingListOwnerType, ownerId: string): string {
    return PATTERNS.listsByTenant.pk({ ownerType, ownerId })
  }

  private scopeGsi2Pk(scope: MailingListScope, scopeValue: string): string {
    return PATTERNS.listsByScope.pk({ scope, scopeValue })
  }

  private subSk(listId: string, emailId: string): string {
    return `SUB#${listId}#${emailId}`
  }

  /** Every page of a query (a list's audience must never be truncated at 1 MB). */
  private async queryAll(
    keyConditionExpression: string,
    values: Record<string, any>,
    indexName?: string
  ): Promise<MailingListRecord[]> {
    const items: MailingListRecord[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    do {
      const page = await this.query(keyConditionExpression, values, { indexName, lastEvaluatedKey })
      items.push(...page.items)
      lastEvaluatedKey = page.lastEvaluatedKey
    } while (lastEvaluatedKey)
    return items
  }

  // ===== LISTS =============================================================

  async createList(input: {
    ownerType: MailingListOwnerType
    ownerId: string
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
    if (!input.ownerId) throw new Error('createList: ownerId is required')
    const listId = input.listId || uuidv4()
    const now = new Date().toISOString()

    const record: MailingListRecord = {
      pkey: this.listPk(listId),
      skey: 'DETAILS',
      gsi1pk: this.tenantGsi1Pk(input.ownerType, input.ownerId),
      gsi1sk: `${input.scope}#${input.name}`,
      gsi2pk: this.scopeGsi2Pk(input.scope, input.scopeValue),
      gsi2sk: `${input.ownerId}#${input.name}`,
      gsi4pk: MAILING_LISTS_GSI4PK,
      gsi4sk: `${input.ownerType}#${input.ownerId}#${input.name}`,
      listId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
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
  async listByTenant(ownerType: MailingListOwnerType, ownerId: string): Promise<MailingListRecord[]> {
    return this.queryAll('gsi1pk = :gsi1pk', { ':gsi1pk': this.tenantGsi1Pk(ownerType, ownerId) }, PATTERNS.listsByTenant.index)
  }

  /** Active lists offered at a given scope, via GSI2. */
  async listByScope(scope: MailingListScope, scopeValue: string): Promise<MailingListRecord[]> {
    const items = await this.queryAll(
      'gsi2pk = :gsi2pk',
      { ':gsi2pk': this.scopeGsi2Pk(scope, scopeValue) },
      PATTERNS.listsByScope.index
    )
    return items.filter((l) => l.status === 'active')
  }

  /** Every list (active + archived), via the sparse gsi4 entry. No Scan. */
  async listAllLists(): Promise<MailingListRecord[]> {
    return this.queryAll('gsi4pk = :pk', { ':pk': MAILING_LISTS_GSI4PK }, PATTERNS.listsAll.index)
  }

  /** The active list an owner holds under a slug key (e.g. Toronto East's 'newsletter'), or null. */
  async findByOwnerKey(
    ownerType: MailingListOwnerType,
    ownerId: string,
    key: string
  ): Promise<MailingListRecord | null> {
    const matches = (await this.listByTenant(ownerType, ownerId)).filter(
      (l) => l.status === 'active' && l.key === key
    )
    if (matches.length > 1) {
      console.error(`mailing-lists: ${matches.length} active lists of ${ownerType} ${ownerId} share key "${key}"`)
      return null
    }
    return matches[0] ?? null
  }

  // ===== SAFETY-NET SETTING ================================================

  async getSafetyNetSetting(): Promise<SafetyNetSetting> {
    const item = (await this.get(SAFETY_NET_SETTING_KEY.pkey, SAFETY_NET_SETTING_KEY.skey)) as unknown as
      | (SafetyNetSetting & Record<string, unknown>)
      | null
    if (!item) return { enabled: false, topics: [] }
    return {
      enabled: item.enabled === true,
      ...(item.switching === true ? { switching: true } : {}),
      topics: Array.isArray(item.topics) ? item.topics : [],
      ...(item.enabledAt ? { enabledAt: item.enabledAt } : {}),
    }
  }

  async setSafetyNetSetting(setting: SafetyNetSetting): Promise<void> {
    await this.put({
      ...SAFETY_NET_SETTING_KEY,
      enabled: setting.enabled,
      switching: setting.switching === true,
      topics: setting.topics,
      enabledAt: setting.enabledAt ?? new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: 0,
    } as unknown as MailingListRecord)
  }

  /** Per-list cutover switch (registry vs SES-topic recipients). */
  async setSendFromRegistry(listId: string, on: boolean): Promise<MailingListRecord> {
    return this.update(this.listPk(listId), 'DETAILS', {
      sendFromRegistry: on,
    } as Partial<MailingListRecord>)
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
   * `ecclesiaId` is the person's ecclesia's stable id and `region` its region;
   * both are resolved by the caller (packages/* cannot import the apps/next
   * ecclesia helpers). A missing ecclesiaId skips the ecclesia rung; a missing or
   * unknown region skips the region + continent rungs. Global always applies.
   */
  async getOfferedListsForPerson(
    person: { ecclesiaId?: string | null },
    region?: string | null
  ): Promise<MailingListRecord[]> {
    const queries: Array<Promise<MailingListRecord[]>> = []

    if (person.ecclesiaId) {
      queries.push(this.listByScope('ecclesia', person.ecclesiaId))
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

  /**
   * Upsert a subscription row for one person's email on a list. Opt-in by
   * default; `status: 'opt_out'` records an explicit opt-out where no row
   * existed (e.g. leaving a defaultOptIn list).
   */
  async subscribe(input: {
    personId: string
    listId: string
    emailId: string
    email: string
    source: ListSubscriptionRecord['source']
    basis: ListSubscriptionRecord['basis']
    status?: ListSubscriptionRecord['status']
  }): Promise<ListSubscriptionRecord> {
    const now = new Date().toISOString()
    const email = input.email.toLowerCase()

    const record: ListSubscriptionRecord = {
      pkey: `PERSON#${input.personId}`,
      skey: this.subSk(input.listId, input.emailId),
      gsi1pk: PATTERNS.listSubscriptions.pk({ listId: input.listId }),
      gsi1sk: email,
      listId: input.listId,
      emailId: input.emailId,
      email,
      status: input.status ?? 'opt_in',
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

  /** Flip an existing subscription row (by its keys) to opt_in or opt_out. */
  async setSubscriptionStatus(
    row: Pick<ListSubscriptionRecord, 'pkey' | 'skey'>,
    status: ListSubscriptionRecord['status']
  ): Promise<ListSubscriptionRecord> {
    return this.update(row.pkey, row.skey, {
      status,
      ...(status === 'opt_in' ? { subscribedAt: new Date().toISOString() } : {}),
    } as unknown as Partial<MailingListRecord>) as unknown as Promise<ListSubscriptionRecord>
  }

  /** All of a person's list subscriptions (opt_in + opt_out). */
  async getPersonSubscriptions(personId: string): Promise<ListSubscriptionRecord[]> {
    const items = await this.queryAll('pkey = :pk AND begins_with(skey, :skPrefix)', {
      ':pk': `PERSON#${personId}`,
      ':skPrefix': 'SUB#',
    })
    return items as unknown as ListSubscriptionRecord[]
  }

  /** Every row (opt_in + opt_out) for one address on one list, via GSI1. */
  async getListSubscriptionsForEmail(listId: string, email: string): Promise<ListSubscriptionRecord[]> {
    const items = await this.queryAll(
      'gsi1pk = :gsi1pk AND gsi1sk = :email',
      { ':gsi1pk': PATTERNS.listSubscriptions.pk({ listId }), ':email': email.toLowerCase() },
      PATTERNS.listSubscriptions.index
    )
    return items as unknown as ListSubscriptionRecord[]
  }

  /** Every row for a list (opt_in + opt_out), via GSI1. Used by backfill idempotency. */
  async listAllSubscriptionRows(listId: string): Promise<ListSubscriptionRecord[]> {
    const items = await this.queryAll(
      'gsi1pk = :gsi1pk',
      { ':gsi1pk': PATTERNS.listSubscriptions.pk({ listId }) },
      PATTERNS.listSubscriptions.index
    )
    return items as unknown as ListSubscriptionRecord[]
  }

  /** Opted-in subscribers for a list, via GSI1 (send-path fan-out). */
  async listSubscribers(listId: string): Promise<ListSubscriptionRecord[]> {
    return (await this.listAllSubscriptionRows(listId)).filter((s) => s.status === 'opt_in')
  }
}

// Export singleton instance
export const mailingListRepository = new MailingListRepository()
