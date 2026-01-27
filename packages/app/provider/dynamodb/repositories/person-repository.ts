import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import type {
  PersonRecord,
  PersonEmailRecord,
  PersonAddressRecord,
  PersonPhoneRecord,
  PersonQueryResult,
  MemberStatus,
  PrivacyTier,
  AddressType,
  PhoneType,
} from '../types'

// Input types for creating/updating persons
export interface CreatePersonInput {
  email: string
  firstName: string
  lastName: string
  ecclesia: string
  memberStatus?: MemberStatus
  isInterEcclesiaRep?: boolean
  role?: 'owner' | 'admin' | 'member' | 'guest'
  provider?: 'google' | 'credentials'
  userId?: string
}

export interface PersonWithDetails extends PersonRecord {
  emails: PersonEmailRecord[]
  phones: PersonPhoneRecord[]
  addresses: PersonAddressRecord[]
}

// Privacy-filtered profile for viewing
export interface PersonProfileView {
  personId: string
  displayName: string
  firstName?: string
  lastName?: string
  ecclesia?: string
  emails: Array<{ email: string; emailType: string }>
  phones: Array<{ number: string; type: string; isPrimary: boolean }>
  addresses: Array<{
    city?: string
    province?: string
    street1?: string
    street2?: string
    postalCode?: string
    country?: string
    type: string
    isPrimary: boolean
  }>
  canEdit: boolean
  canRequestContact: boolean
  privacyTier: PrivacyTier
}

/**
 * Repository for Person records - UUID-based identity
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class PersonRepository extends BaseRepository<PersonRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for person records
    throw new Error('buildSheetPK not applicable for PersonRepository')
  }

  // ===== CORE PERSON OPERATIONS =====

  /**
   * Get person by UUID
   */
  async getById(personId: string): Promise<PersonRecord | null> {
    const pk = `PERSON#${personId}`
    return this.get(pk, 'PROFILE')
  }

  /**
   * Get person by email via GSI1
   */
  async getByEmail(email: string): Promise<PersonRecord | null> {
    const result = await this.query(
      'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
      { ':gsi1pk': `EMAIL#${email.toLowerCase()}`, ':gsi1sk': 'PERSON' },
      { indexName: 'gsi1' }
    )
    return result.items[0] || null
  }

  /**
   * List all persons by ecclesia via GSI2
   */
  async listByEcclesia(ecclesia: string, options?: {
    limit?: number
    lastEvaluatedKey?: Record<string, any>
  }): Promise<PersonQueryResult> {
    const result = await this.query(
      'gsi2pk = :gsi2pk',
      { ':gsi2pk': `ECCLESIA#${ecclesia}` },
      {
        indexName: 'gsi2',
        limit: options?.limit,
        lastEvaluatedKey: options?.lastEvaluatedKey,
        scanIndexForward: true, // Sort by lastName#firstName
      }
    )
    return {
      items: result.items,
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Search by name via GSI3
   */
  async searchByName(lastName: string, firstName?: string): Promise<PersonQueryResult> {
    let keyCondition = 'gsi3pk = :gsi3pk'
    const values: Record<string, any> = { ':gsi3pk': `NAME#${lastName.toLowerCase()}` }

    if (firstName) {
      keyCondition += ' AND begins_with(gsi3sk, :gsi3sk)'
      values[':gsi3sk'] = firstName.toLowerCase()
    }

    const result = await this.query(keyCondition, values, { indexName: 'gsi3' })
    return {
      items: result.items,
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Create a new person with UUID
   */
  async create(input: CreatePersonInput): Promise<PersonRecord> {
    const personId = uuidv4()
    const displayName = `${input.firstName} ${input.lastName}`.trim()
    const now = new Date().toISOString()

    const record: PersonRecord = {
      pkey: `PERSON#${personId}`,
      skey: 'PROFILE',
      gsi1pk: `EMAIL#${input.email.toLowerCase()}`,
      gsi1sk: 'PERSON',
      gsi2pk: `ECCLESIA#${input.ecclesia}`,
      gsi2sk: `${input.lastName.toLowerCase()}#${input.firstName.toLowerCase()}#${personId}`,
      gsi3pk: `NAME#${input.lastName.toLowerCase()}`,
      gsi3sk: `${input.firstName.toLowerCase()}#${personId}`,
      personId,
      primaryEmail: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      displayName,
      ecclesia: input.ecclesia,
      memberStatus: input.memberStatus || 'member',
      isInterEcclesiaRep: input.isInterEcclesiaRep,
      role: input.role,
      provider: input.provider,
      userId: input.userId,
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)

    // Also create the primary email record
    await this.addEmail(personId, {
      email: input.email.toLowerCase(),
      emailType: 'primary',
      order: 0,
      verified: true,
      sesSubscribed: false,
      sesStatus: 'active',
    })

    return record
  }

  /**
   * Update a person
   */
  async updatePerson(
    personId: string,
    updates: Partial<Omit<PersonRecord, 'pkey' | 'skey' | 'personId' | 'createdAt'>>
  ): Promise<PersonRecord> {
    const pk = `PERSON#${personId}`

    // If name or ecclesia changed, update GSI keys
    if (updates.firstName || updates.lastName || updates.ecclesia) {
      const current = await this.getById(personId)
      if (!current) throw new Error(`Person ${personId} not found`)

      const firstName = updates.firstName || current.firstName
      const lastName = updates.lastName || current.lastName
      const ecclesia = updates.ecclesia || current.ecclesia

      updates.displayName = `${firstName} ${lastName}`.trim()
      updates.gsi2pk = `ECCLESIA#${ecclesia}`
      updates.gsi2sk = `${lastName.toLowerCase()}#${firstName.toLowerCase()}#${personId}`
      updates.gsi3pk = `NAME#${lastName.toLowerCase()}`
      updates.gsi3sk = `${firstName.toLowerCase()}#${personId}`
    }

    return this.update(pk, 'PROFILE', updates)
  }

  // ===== EMAIL OPERATIONS =====

  async getEmails(personId: string): Promise<PersonEmailRecord[]> {
    const pk = `PERSON#${personId}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'EMAIL#' }
    )
    return result.items as unknown as PersonEmailRecord[]
  }

  async addEmail(personId: string, email: Omit<PersonEmailRecord, 'pkey' | 'skey' | 'emailId' | 'lastUpdated' | 'version' | 'gsi1pk' | 'gsi1sk'>): Promise<PersonEmailRecord> {
    const emailId = uuidv4()
    const record: PersonEmailRecord = {
      pkey: `PERSON#${personId}`,
      skey: `EMAIL#${emailId}`,
      gsi1pk: `EMAIL#${email.email.toLowerCase()}`,
      gsi1sk: `PERSON#${personId}`,
      emailId,
      ...email,
      email: email.email.toLowerCase(),
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record as unknown as PersonRecord)
    return record
  }

  // ===== PHONE OPERATIONS =====

  async getPhones(personId: string): Promise<PersonPhoneRecord[]> {
    const pk = `PERSON#${personId}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'PHONE#' }
    )
    return (result.items as unknown as PersonPhoneRecord[]).sort((a, b) => a.order - b.order)
  }

  async addPhone(personId: string, phone: {
    type: PhoneType
    number: string
    isPrimary?: boolean
    isHousehold?: boolean
    order?: number
  }): Promise<PersonPhoneRecord> {
    const phoneId = uuidv4()
    const phones = await this.getPhones(personId)
    const order = phone.order ?? phones.length

    const record: PersonPhoneRecord = {
      pkey: `PERSON#${personId}`,
      skey: `PHONE#${phoneId}`,
      phoneId,
      type: phone.type,
      number: phone.number,
      isPrimary: phone.isPrimary ?? phones.length === 0,
      isHousehold: phone.isHousehold ?? false,
      order,
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record as unknown as PersonRecord)
    return record
  }

  async updatePhone(personId: string, phoneId: string, updates: Partial<Omit<PersonPhoneRecord, 'pkey' | 'skey' | 'phoneId'>>): Promise<PersonPhoneRecord> {
    const pk = `PERSON#${personId}`
    const sk = `PHONE#${phoneId}`
    return this.update(pk, sk, updates) as unknown as Promise<PersonPhoneRecord>
  }

  async deletePhone(personId: string, phoneId: string): Promise<void> {
    await this.delete(`PERSON#${personId}`, `PHONE#${phoneId}`)
  }

  // ===== ADDRESS OPERATIONS =====

  async getAddresses(personId: string): Promise<PersonAddressRecord[]> {
    const pk = `PERSON#${personId}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'ADDRESS#' }
    )
    return result.items as unknown as PersonAddressRecord[]
  }

  async addAddress(personId: string, address: {
    type: AddressType
    street1: string
    street2?: string
    city: string
    province: string
    postalCode: string
    country?: string
    isPrimary?: boolean
    isHousehold?: boolean
    label?: string
    householdId?: string
  }): Promise<PersonAddressRecord> {
    const addressId = uuidv4()
    const addresses = await this.getAddresses(personId)

    const record: PersonAddressRecord = {
      pkey: `PERSON#${personId}`,
      skey: `ADDRESS#${addressId}`,
      addressId,
      type: address.type,
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country || 'Canada',
      isPrimary: address.isPrimary ?? addresses.length === 0,
      isHousehold: address.isHousehold ?? false,
      label: address.label,
      householdId: address.householdId,
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record as unknown as PersonRecord)
    return record
  }

  async updateAddress(personId: string, addressId: string, updates: Partial<Omit<PersonAddressRecord, 'pkey' | 'skey' | 'addressId'>>): Promise<PersonAddressRecord> {
    const pk = `PERSON#${personId}`
    const sk = `ADDRESS#${addressId}`
    return this.update(pk, sk, updates) as unknown as Promise<PersonAddressRecord>
  }

  async deleteAddress(personId: string, addressId: string): Promise<void> {
    await this.delete(`PERSON#${personId}`, `ADDRESS#${addressId}`)
  }

  // ===== PRIVACY & PROFILE VIEW =====

  /**
   * Determine privacy tier based on viewer relationship
   */
  getPrivacyTier(
    viewerPersonId: string | null,
    targetPersonId: string,
    viewerEcclesia: string | null,
    targetEcclesia: string,
    isConnected: boolean
  ): PrivacyTier {
    if (!viewerPersonId) return 'private'
    if (viewerPersonId === targetPersonId) return 'self'
    if (isConnected) return 'connected'
    if (viewerEcclesia && viewerEcclesia === targetEcclesia) return 'same_ecclesia'
    return 'authenticated'
  }

  /**
   * Get profile with privacy filtering applied
   */
  async getProfileWithPrivacy(
    personId: string,
    viewerPersonId: string | null,
    viewerEcclesia: string | null,
    isConnected: boolean = false
  ): Promise<PersonProfileView | null> {
    const person = await this.getById(personId)
    if (!person) return null

    const privacyTier = this.getPrivacyTier(
      viewerPersonId,
      personId,
      viewerEcclesia,
      person.ecclesia,
      isConnected
    )

    const [emails, phones, addresses] = await Promise.all([
      this.getEmails(personId),
      this.getPhones(personId),
      this.getAddresses(personId),
    ])

    // Apply privacy filtering based on tier
    const view: PersonProfileView = {
      personId: person.personId,
      displayName: person.displayName,
      canEdit: privacyTier === 'self',
      canRequestContact: privacyTier !== 'self' && privacyTier !== 'private',
      privacyTier,
      emails: [],
      phones: [],
      addresses: [],
    }

    // Self sees everything
    if (privacyTier === 'self') {
      view.firstName = person.firstName
      view.lastName = person.lastName
      view.ecclesia = person.ecclesia
      view.emails = emails.map(e => ({ email: e.email, emailType: e.emailType }))
      view.phones = phones.map(p => ({ number: p.number, type: p.type, isPrimary: p.isPrimary }))
      view.addresses = addresses.map(a => ({
        street1: a.street1,
        street2: a.street2,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
        type: a.type,
        isPrimary: a.isPrimary,
      }))
      return view
    }

    // Connected users see full details
    if (privacyTier === 'connected') {
      view.firstName = person.firstName
      view.lastName = person.lastName
      view.ecclesia = person.ecclesia
      view.emails = emails.map(e => ({ email: e.email, emailType: e.emailType }))
      view.phones = phones.map(p => ({ number: p.number, type: p.type, isPrimary: p.isPrimary }))
      view.addresses = addresses.map(a => ({
        street1: a.street1,
        street2: a.street2,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
        type: a.type,
        isPrimary: a.isPrimary,
      }))
      return view
    }

    // Same ecclesia sees limited details
    if (privacyTier === 'same_ecclesia') {
      view.firstName = person.firstName
      view.lastName = person.lastName
      view.ecclesia = person.ecclesia
      view.emails = emails.filter(e => e.emailType === 'primary').map(e => ({ email: e.email, emailType: e.emailType }))
      view.phones = phones.filter(p => p.isPrimary).map(p => ({ number: p.number, type: p.type, isPrimary: p.isPrimary }))
      view.addresses = addresses.filter(a => a.isPrimary).map(a => ({
        city: a.city,
        province: a.province,
        type: a.type,
        isPrimary: a.isPrimary,
      }))
      return view
    }

    // Authenticated but not connected - name only
    if (privacyTier === 'authenticated') {
      view.firstName = person.firstName
      view.lastName = person.lastName
      return view
    }

    // Private - display name only
    return view
  }

  /**
   * Get full person with all related records
   */
  async getPersonWithDetails(personId: string): Promise<PersonWithDetails | null> {
    const person = await this.getById(personId)
    if (!person) return null

    const [emails, phones, addresses] = await Promise.all([
      this.getEmails(personId),
      this.getPhones(personId),
      this.getAddresses(personId),
    ])

    return {
      ...person,
      emails,
      phones,
      addresses,
    }
  }

  /**
   * Count all persons (for migration validation)
   */
  async count(): Promise<number> {
    let count = 0
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'skey = :skey',
        expressionAttributeValues: { ':skey': 'PROFILE' },
        lastEvaluatedKey: lastKey,
      })
      count += result.items.length
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return count
  }

  /**
   * List all persons (paginated)
   */
  async listAll(options?: {
    limit?: number
    lastEvaluatedKey?: Record<string, any>
  }): Promise<PersonQueryResult> {
    const result = await this.scan({
      filterExpression: 'skey = :skey',
      expressionAttributeValues: { ':skey': 'PROFILE' },
      limit: options?.limit,
      lastEvaluatedKey: options?.lastEvaluatedKey,
    })
    return {
      items: result.items,
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * List all inter-ecclesia representatives
   * These are the contacts who receive inter-ecclesia emails for their ecclesia
   */
  async listInterEcclesiaReps(): Promise<PersonRecord[]> {
    const allReps: PersonRecord[] = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'skey = :skey AND isInterEcclesiaRep = :isRep',
        expressionAttributeValues: { ':skey': 'PROFILE', ':isRep': true },
        lastEvaluatedKey: lastKey,
      })
      allReps.push(...result.items)
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return allReps
  }

  /**
   * Set inter-ecclesia rep status for a person
   */
  async setInterEcclesiaRep(personId: string, isRep: boolean): Promise<PersonRecord> {
    return this.updatePerson(personId, { isInterEcclesiaRep: isRep })
  }
}

// Export singleton instance
export const personRepository = new PersonRepository()
