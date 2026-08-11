import { v4 as uuidv4 } from 'uuid'
import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { BaseRepository } from './base-repository'
import { docClient, tableNames } from '../config'
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
  // Optional: a record may be created with NO email (visiting speakers
  // harvested from the schedule have none). Emailless creation is only allowed
  // when memberStatus is 'visitor' — see create().
  email?: string
  firstName: string
  lastName: string
  ecclesia: string
  memberStatus?: MemberStatus
  isInterEcclesiaRep?: boolean
  role?: 'owner' | 'admin' | 'recorder' | 'rep' | 'member' | 'guest' | 'deceased'
  provider?: 'google' | 'credentials'
  userId?: string
  // Provenance for machine-created records (e.g. schedule ingest).
  source?: 'schedule-import'
  sourceRef?: string
}

// OAuth profile from Google
export interface GoogleOAuthProfile {
  id: string              // Google user ID
  email: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

// Registration data for credentials users
export interface CredentialsRegistrationData {
  email: string
  hashedPassword: string
  firstName: string
  lastName: string
  ecclesia: string
  role?: 'owner' | 'admin' | 'recorder' | 'rep' | 'member' | 'guest' | 'deceased'
}

// Person with auth fields for authentication
export interface PersonAuthData {
  personId: string
  email: string
  hashedPassword?: string
  emailVerified?: string
  role?: 'owner' | 'admin' | 'recorder' | 'rep' | 'member' | 'guest' | 'deceased'
  provider?: 'google' | 'credentials'
  firstName: string
  lastName: string
  displayName: string
  ecclesia: string
  memberStatus?: string
  isInterEcclesiaRep?: boolean
  isRecordingBrother?: boolean
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
   * Get person by email via GSI1 — resolves ANY of the person's addresses.
   *
   * A profile's PRIMARY email is the PROFILE item (gsi1sk = 'PERSON'); SECONDARY
   * emails are EMAIL# items (gsi1sk = 'PERSON#<uuid>'). Historically this only
   * matched the primary, so a lookup by a secondary returned null — which let the
   * verify-otp/add-email flows mint a duplicate "orphan" person for an address
   * that already belonged to someone. We now try the primary fast-path, then fall
   * back to resolving the address as a secondary.
   *
   * If an address is shared by more than one person (e.g. a couple), this returns
   * a single best-effort owner (primary-owner if any, else the first) and logs —
   * shared-address disambiguation is handled by the caller where it matters.
   */
  async getByEmail(email: string): Promise<PersonRecord | null> {
    const lower = email.toLowerCase()
    // Fast path: the address is a PRIMARY (on a PROFILE item).
    const primary = await this.query(
      'gsi1pk = :gsi1pk AND gsi1sk = :gsi1sk',
      { ':gsi1pk': `EMAIL#${lower}`, ':gsi1sk': 'PERSON' },
      { indexName: 'gsi1' }
    )
    if (primary.items[0]) return primary.items[0]

    // Fallback: the address is a SECONDARY (EMAIL# item) — resolve to its profile.
    const owners = await this.getAllPersonsByEmail(lower)
    if (owners.length > 1) {
      console.warn(
        `[getByEmail] "${lower}" resolves to ${owners.length} persons (shared address); returning first`
      )
    }
    return owners[0] || null
  }

  /**
   * Find ALL PersonRecords that share a given email address.
   * Queries GSI1 with begins_with to catch both PROFILE (gsi1sk='PERSON')
   * and EMAIL# items (gsi1sk='PERSON#<uuid>'), then resolves to full PROFILE records.
   */
  async getAllPersonsByEmail(email: string): Promise<PersonRecord[]> {
    const result = await this.query(
      'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :prefix)',
      { ':gsi1pk': `EMAIL#${email.toLowerCase()}`, ':prefix': 'PERSON' },
      { indexName: 'gsi1' }
    )

    // Deduplicate: each item is either a PROFILE or an EMAIL# record.
    // Extract personId from each and load the full PROFILE record.
    const personIds = new Set<string>()
    const persons: PersonRecord[] = []

    for (const item of result.items) {
      // PROFILE items have pkey = PERSON#<uuid>, skey = PROFILE
      // EMAIL# items have pkey = PERSON#<uuid>, skey = EMAIL#<emailId>
      const pk = (item as any).pkey as string
      if (!pk?.startsWith('PERSON#')) continue
      const personId = pk.replace('PERSON#', '')
      if (personIds.has(personId)) continue
      personIds.add(personId)

      // If it's already a PROFILE record, use it directly
      if ((item as any).skey === 'PROFILE') {
        persons.push(item as unknown as PersonRecord)
      } else {
        // It's an EMAIL# record — load the PROFILE
        const profile = await this.getById(personId)
        if (profile) persons.push(profile)
      }
    }

    return persons
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
    const email = input.email?.trim().toLowerCase() || undefined
    const memberStatus = input.memberStatus || 'member'

    // Emailless records are only allowed for visitors (e.g. visiting speakers
    // harvested from the schedule). This keeps anything fake OUT of the EMAIL#
    // GSI space and SES — the record gets a NOEMAIL#{personId} GSI1 sentinel
    // and NO EMAIL# item, so getByEmail() can never surface it.
    if (!email && memberStatus !== 'visitor') {
      throw new Error(
        'PersonRepository.create requires an email unless memberStatus is "visitor"'
      )
    }

    const record: PersonRecord = {
      pkey: `PERSON#${personId}`,
      skey: 'PROFILE',
      gsi1pk: email ? `EMAIL#${email}` : `NOEMAIL#${personId}`,
      gsi1sk: 'PERSON',
      gsi2pk: `ECCLESIA#${input.ecclesia}`,
      gsi2sk: `${input.lastName.toLowerCase()}#${input.firstName.toLowerCase()}#${personId}`,
      gsi3pk: `NAME#${input.lastName.toLowerCase()}`,
      gsi3sk: `${input.firstName.toLowerCase()}#${personId}`,
      personId,
      primaryEmail: email ?? '',
      firstName: input.firstName,
      lastName: input.lastName,
      displayName,
      ecclesia: input.ecclesia,
      memberStatus,
      isInterEcclesiaRep: input.isInterEcclesiaRep,
      role: input.role,
      provider: input.provider,
      userId: input.userId,
      source: input.source,
      sourceRef: input.sourceRef,
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)

    // Only create a primary EMAIL# item when there is a real email. Emailless
    // visitor records intentionally have none (keeps SES / the email GSI clean).
    if (email) {
      await this.addEmail(personId, {
        email,
        emailType: 'primary',
        order: 0,
        verified: true,
        sesSubscribed: false,
        sesStatus: 'active',
      })
    }

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

      const firstName = updates.firstName || current.firstName || ''
      const lastName = updates.lastName || current.lastName || ''
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

  /**
   * Remove a specific email record from a person
   */
  async removeEmail(personId: string, emailId: string): Promise<void> {
    await this.delete(`PERSON#${personId}`, `EMAIL#${emailId}`)
  }

  /**
   * Find all EMAIL# records across all people for a specific email address.
   * Queries GSI1 and filters for EMAIL# skey items (not PROFILE items).
   */
  async getEmailsByEmail(email: string): Promise<PersonEmailRecord[]> {
    const result = await this.query(
      'gsi1pk = :gsi1pk AND begins_with(gsi1sk, :prefix)',
      { ':gsi1pk': `EMAIL#${email.toLowerCase()}`, ':prefix': 'PERSON' },
      { indexName: 'gsi1' }
    )

    // Filter to only EMAIL# records (not PROFILE records which have skey='PROFILE')
    return result.items.filter(
      (item: any) => item.skey?.startsWith('EMAIL#')
    ) as unknown as PersonEmailRecord[]
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

  /**
   * Fetch a single EMAIL# row by its id (for existence / primary guards).
   */
  async getEmailById(personId: string, emailId: string): Promise<PersonEmailRecord | null> {
    const pk = `PERSON#${personId}`
    const sk = `EMAIL#${emailId}`
    return this.get(pk, sk) as unknown as Promise<PersonEmailRecord | null>
  }

  /**
   * Set the display `order` on each EMAIL# row to match the given id sequence.
   * This is DISPLAY ordering only ("set as preferred" moves an address to the
   * front) — it MUST NOT touch PROFILE.primaryEmail or any EMAIL# gsi1pk, since
   * changing which address is preferred for display is not an identity transfer.
   */
  async setEmailOrder(personId: string, orderedEmailIds: string[]): Promise<void> {
    const pk = `PERSON#${personId}`
    for (let i = 0; i < orderedEmailIds.length; i++) {
      await this.update(
        pk,
        `EMAIL#${orderedEmailIds[i]}`,
        { order: i } as unknown as Partial<PersonRecord>
      )
    }
  }

  /**
   * Mark the EMAIL# row matching a given address as verified. Unlike
   * `markEmailVerified` (which only flips the `emailType==='primary'` row and the
   * PROFILE.emailVerified stamp), this works for SECONDARY addresses too, so a
   * verification link for an added address lands on the right row. Idempotent:
   * a no-op if the address isn't on the person.
   */
  async markEmailVerifiedByAddress(personId: string, email: string): Promise<void> {
    const target = email.toLowerCase()
    const emails = await this.getEmails(personId)
    const match = emails.find(e => e.email.toLowerCase() === target)
    if (!match) return
    await this.update(
      match.pkey,
      match.skey,
      { verified: true } as unknown as Partial<PersonRecord>
    )
  }

  /** Default grace before a demoted former-primary email may be archived. */
  static readonly EMAIL_DEMOTE_GRACE_MS = 30 * 24 * 60 * 60 * 1000

  /**
   * Undo the "retire" of a demoted former-primary email: clear its `archiveAfter`
   * so it becomes a permanent secondary again (the mistake-recovery path behind
   * the Retired ⓘ / Undo affordance). Restorative and low-risk — callers gate on
   * session only, no fresh step-up.
   *
   * NOTE on the clear mechanism: the base `update()` helper builds a SET-only
   * expression and drops `undefined`/`null` values, so it CANNOT remove an
   * attribute — passing `archiveAfter: undefined` would silently leave the stale
   * timestamp in place. We therefore issue a direct UpdateCommand with a REMOVE
   * clause (mirroring how `countByEcclesia` drops to a raw command), which is the
   * only way to actually delete the attribute in DynamoDB.
   */
  async undoEmailRetire(personId: string, emailId: string): Promise<void> {
    const row = await this.getEmailById(personId, emailId)
    if (!row) {
      throw new Error(`Email ${emailId} not found for person ${personId}`)
    }
    if (row.emailType === 'primary') {
      throw new Error('Cannot restore the primary login email — it is not retired')
    }

    const command = new UpdateCommand({
      TableName: this.tableName,
      Key: { pkey: `PERSON#${personId}`, skey: `EMAIL#${emailId}` },
      UpdateExpression: 'REMOVE archiveAfter SET #lastUpdated = :lastUpdated',
      ExpressionAttributeNames: { '#lastUpdated': 'lastUpdated' },
      ExpressionAttributeValues: { ':lastUpdated': new Date().toISOString() },
    })
    await docClient.send(command)
  }

  /**
   * Change a person's LOGIN email (identity transfer). Re-points the single
   * source of login truth — `PROFILE.primaryEmail` and its `gsi1pk` lookup index
   * — to `newEmail`, and demotes the former primary to a recoverable secondary
   * for a grace window (never hard-deleted). The new address is marked verified
   * and labelled `primary`.
   *
   * The caller MUST have already proven the operator controls the account (fresh
   * step-up) AND that `newEmail` is deliverable (the confirmation code) — this
   * method only performs the transfer.
   *
   * DynamoDB has no cross-item transaction here, so writes are ordered so the
   * PROFILE flip (the commit point that actually moves login) happens LAST, after
   * the new row exists and the old is demoted. A mid-way failure leaves login on
   * the old address (safe) and is idempotent on retry.
   */
  async changePrimaryEmail(
    personId: string,
    newEmailRaw: string,
    opts?: { graceMs?: number }
  ): Promise<{ newEmailId: string; oldEmail: string | null }> {
    const newEmail = (newEmailRaw || '').trim().toLowerCase()
    if (!newEmail) throw new Error('changePrimaryEmail: newEmail is required')

    const person = await this.getById(personId)
    if (!person) throw new Error(`Person ${personId} not found`)
    const oldEmail = person.primaryEmail ? person.primaryEmail.toLowerCase() : null

    const emails = await this.getEmails(personId)
    const nowIso = new Date().toISOString()
    const graceMs = opts?.graceMs ?? PersonRepository.EMAIL_DEMOTE_GRACE_MS
    const archiveAfter = new Date(Date.now() + graceMs).toISOString()

    // 1) Ensure the NEW email exists as a verified, primary-labelled EMAIL# row.
    let newRow = emails.find((e) => e.email.toLowerCase() === newEmail)
    if (newRow) {
      await this.update(
        `PERSON#${personId}`,
        `EMAIL#${newRow.emailId}`,
        { emailType: 'primary', verified: true } as unknown as Partial<PersonRecord>
      )
    } else {
      newRow = await this.addEmail(personId, {
        email: newEmail,
        emailType: 'primary',
        order: 0,
        verified: true,
        sesSubscribed: true,
        sesStatus: 'active',
      })
    }

    // 2) Demote any OTHER row currently labelled primary → recoverable secondary.
    for (const row of emails) {
      if (row.emailId === newRow.emailId) continue
      if (row.emailType === 'primary') {
        await this.update(
          `PERSON#${personId}`,
          `EMAIL#${row.emailId}`,
          { emailType: 'secondary', archiveAfter } as unknown as Partial<PersonRecord>
        )
      }
    }

    // 3) COMMIT: move the login handle + lookup index to the new address.
    await this.update(`PERSON#${personId}`, 'PROFILE', {
      primaryEmail: newEmail,
      gsi1pk: `EMAIL#${newEmail}`,
      emailVerified: nowIso,
    })

    return { newEmailId: newRow.emailId, oldEmail }
  }

  // ===== PHONE OPERATIONS =====

  async getPhone(personId: string, phoneId: string): Promise<PersonPhoneRecord | null> {
    const pk = `PERSON#${personId}`
    const sk = `PHONE#${phoneId}`
    return this.get(pk, sk) as unknown as Promise<PersonPhoneRecord | null>
  }

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

  async replaceAllPhones(personId: string, phones: Array<{
    phoneId?: string; type: PhoneType; number: string; order: number
  }>): Promise<void> {
    const existing = await this.getPhones(personId)
    for (const phone of existing) {
      await this.deletePhone(personId, phone.phoneId)
    }
    for (const phone of phones) {
      await this.addPhone(personId, {
        type: phone.type,
        number: phone.number,
        isPrimary: phone.order === 0,
        order: phone.order,
      })
    }
  }

  // ===== ADDRESS OPERATIONS =====

  async getAddress(personId: string, addressId: string): Promise<PersonAddressRecord | null> {
    const pk = `PERSON#${personId}`
    const sk = `ADDRESS#${addressId}`
    return this.get(pk, sk) as unknown as Promise<PersonAddressRecord | null>
  }

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
        filterExpression: 'begins_with(pkey, :prefix) AND skey = :skey',
        expressionAttributeValues: { ':prefix': 'PERSON#', ':skey': 'PROFILE' },
        lastEvaluatedKey: lastKey,
      })
      count += result.items.length
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return count
  }

  /**
   * Count members in a specific ecclesia using GSI2 with Select: 'COUNT'.
   * Reads only index metadata — no item data is transferred.
   */
  async countByEcclesia(ecclesia: string): Promise<number> {
    let count = 0
    let lastKey: Record<string, any> | undefined

    do {
      const command = new QueryCommand({
        TableName: tableNames.admin,
        IndexName: 'gsi2',
        KeyConditionExpression: 'gsi2pk = :gsi2pk',
        ExpressionAttributeValues: { ':gsi2pk': `ECCLESIA#${ecclesia}` },
        Select: 'COUNT',
        ExclusiveStartKey: lastKey,
      })

      const result = await docClient.send(command)
      count += result.Count || 0
      lastKey = result.LastEvaluatedKey
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
      filterExpression: 'begins_with(pkey, :prefix) AND skey = :skey',
      expressionAttributeValues: { ':prefix': 'PERSON#', ':skey': 'PROFILE' },
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

  // ===== AUTH INTEGRATION METHODS =====

  /**
   * Get person for authentication (includes auth fields)
   * Uses GSI1 for O(1) email lookup - replaces scan-based getUserFromDynamoDB
   */
  async getByEmailForAuth(email: string): Promise<PersonAuthData | null> {
    // getByEmail now resolves secondary addresses itself (primary fast-path, then
    // EMAIL#-item fallback) — no need for a separate secondary lookup here.
    const person = await this.getByEmail(email)
    if (!person) return null

    return {
      personId: person.personId,
      email: person.primaryEmail,
      hashedPassword: person.hashedPassword,
      emailVerified: person.emailVerified,
      role: person.role,
      provider: person.provider,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName,
      ecclesia: person.ecclesia,
      memberStatus: person.memberStatus,
      isInterEcclesiaRep: person.isInterEcclesiaRep,
      isRecordingBrother: person.isRecordingBrother,
    }
  }

  /**
   * Create person from Google OAuth profile
   * Used when a new Google user signs in for the first time
   */
  async createFromOAuth(profile: GoogleOAuthProfile, options?: {
    ecclesia?: string
    role?: 'owner' | 'admin' | 'recorder' | 'rep' | 'member' | 'guest' | 'deceased'
  }): Promise<PersonRecord> {
    // Parse name from profile
    const firstName = profile.given_name || profile.name?.split(' ')[0] || ''
    const lastName = profile.family_name || profile.name?.split(' ').slice(1).join(' ') || ''

    const personId = uuidv4()
    const displayName = profile.name || `${firstName} ${lastName}`.trim()
    const now = new Date().toISOString()

    const record: PersonRecord = {
      pkey: `PERSON#${personId}`,
      skey: 'PROFILE',
      gsi1pk: `EMAIL#${profile.email.toLowerCase()}`,
      gsi1sk: 'PERSON',
      gsi2pk: `ECCLESIA#${options?.ecclesia || 'Unknown'}`,
      gsi2sk: `${lastName.toLowerCase()}#${firstName.toLowerCase()}#${personId}`,
      gsi3pk: `NAME#${lastName.toLowerCase()}`,
      gsi3sk: `${firstName.toLowerCase()}#${personId}`,
      personId,
      primaryEmail: profile.email.toLowerCase(),
      firstName,
      lastName,
      displayName,
      ecclesia: options?.ecclesia || 'Unknown',
      memberStatus: 'visitor',
      role: options?.role || 'guest',
      provider: 'google',
      googleId: profile.id,
      image: profile.picture,
      emailVerified: now, // OAuth emails are pre-verified by Google
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)

    // Also create the primary email record
    await this.addEmail(personId, {
      email: profile.email.toLowerCase(),
      emailType: 'primary',
      order: 0,
      verified: true,
      sesSubscribed: false,
      sesStatus: 'active',
    })

    return record
  }

  /**
   * Create person from credentials registration
   * Used when a new user registers with email/password
   */
  async createFromCredentials(data: CredentialsRegistrationData): Promise<PersonRecord> {
    const personId = uuidv4()
    const displayName = `${data.firstName} ${data.lastName}`.trim()
    const now = new Date().toISOString()

    const record: PersonRecord = {
      pkey: `PERSON#${personId}`,
      skey: 'PROFILE',
      gsi1pk: `EMAIL#${data.email.toLowerCase()}`,
      gsi1sk: 'PERSON',
      gsi2pk: `ECCLESIA#${data.ecclesia}`,
      gsi2sk: `${data.lastName.toLowerCase()}#${data.firstName.toLowerCase()}#${personId}`,
      gsi3pk: `NAME#${data.lastName.toLowerCase()}`,
      gsi3sk: `${data.firstName.toLowerCase()}#${personId}`,
      personId,
      primaryEmail: data.email.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      displayName,
      ecclesia: data.ecclesia,
      memberStatus: 'member',
      role: data.role || 'member',
      provider: 'credentials',
      hashedPassword: data.hashedPassword,
      // emailVerified is null until user verifies
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)

    // Also create the primary email record (unverified)
    await this.addEmail(personId, {
      email: data.email.toLowerCase(),
      emailType: 'primary',
      order: 0,
      verified: false, // Will be verified via token
      sesSubscribed: false,
      sesStatus: 'active',
    })

    return record
  }

  /**
   * Link a legacy USER# record to a PersonRecord
   * Used during migration to maintain backwards compatibility
   */
  async linkLegacyUser(personId: string, userId: string): Promise<PersonRecord> {
    return this.updatePerson(personId, { userId })
  }

  /**
   * Update password for credentials user
   */
  async updatePassword(personId: string, hashedPassword: string): Promise<PersonRecord> {
    return this.updatePerson(personId, { hashedPassword })
  }

  /**
   * Mark email as verified
   */
  async markEmailVerified(personId: string): Promise<PersonRecord> {
    const now = new Date().toISOString()

    // Update person record
    const person = await this.updatePerson(personId, { emailVerified: now })

    // Also update the primary email record
    const emails = await this.getEmails(personId)
    const primaryEmail = emails.find(e => e.emailType === 'primary')
    if (primaryEmail) {
      // Cast to any since we're updating PersonEmailRecord, not PersonRecord
      await this.update(
        primaryEmail.pkey,
        primaryEmail.skey,
        { verified: true } as unknown as Partial<PersonRecord>
      )
    }

    return person
  }

  /**
   * Check if email is already registered (any provider)
   * Used during registration to prevent duplicates
   */
  async emailExists(email: string): Promise<boolean> {
    const person = await this.getByEmail(email)
    return person !== null
  }

  /**
   * Verify credentials (email + password)
   * Returns PersonAuthData if valid, null otherwise
   * Note: Requires bcrypt/argon2 password verification in the calling code
   */
  async getCredentialsForVerification(email: string): Promise<{
    personId: string
    hashedPassword: string | undefined
    emailVerified: string | undefined
    role: 'owner' | 'admin' | 'recorder' | 'rep' | 'member' | 'guest' | 'deceased' | undefined
    displayName: string
  } | null> {
    const person = await this.getByEmail(email)
    if (!person) return null
    if (person.provider !== 'credentials') return null

    return {
      personId: person.personId,
      hashedPassword: person.hashedPassword,
      emailVerified: person.emailVerified,
      role: person.role,
      displayName: person.displayName,
    }
  }

  /**
   * Get person by Google ID
   * Used for OAuth account linking
   */
  async getByGoogleId(googleId: string): Promise<PersonRecord | null> {
    // This requires a scan since googleId is not indexed
    // Consider adding GSI5 for googleId if this is called frequently
    let lastKey: Record<string, any> | undefined

    do {
      const result = await this.scan({
        filterExpression: 'skey = :skey AND googleId = :googleId',
        expressionAttributeValues: { ':skey': 'PROFILE', ':googleId': googleId },
        lastEvaluatedKey: lastKey,
      })

      if (result.items.length > 0) {
        return result.items[0]
      }

      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return null
  }

  /**
   * Update OAuth profile (picture, name changes from Google)
   */
  async updateFromOAuth(personId: string, profile: GoogleOAuthProfile): Promise<PersonRecord> {
    const updates: Partial<PersonRecord> = {
      googleId: profile.id,
    }

    if (profile.picture) {
      updates.image = profile.picture
    }

    // Only update name if it changed
    if (profile.given_name || profile.family_name) {
      const person = await this.getById(personId)
      if (person) {
        const newFirstName = profile.given_name || person.firstName
        const newLastName = profile.family_name || person.lastName
        if (newFirstName !== person.firstName || newLastName !== person.lastName) {
          updates.firstName = newFirstName
          updates.lastName = newLastName
          updates.displayName = `${newFirstName} ${newLastName}`.trim()
        }
      }
    }

    return this.updatePerson(personId, updates)
  }
}

// Export singleton instance
export const personRepository = new PersonRepository()
