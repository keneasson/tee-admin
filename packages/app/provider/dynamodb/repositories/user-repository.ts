import { BaseRepository } from './base-repository'
import type {
  AddressRecord,
  PhoneRecord,
  EmailRecord,
  AddressQueryResult,
  PhoneQueryResult,
} from '../types'

export interface EmailQueryResult {
  items: EmailRecord[]
  lastEvaluatedKey?: Record<string, any>
}

/**
 * Repository for user-related records: addresses and phones
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class UserRepository extends BaseRepository<AddressRecord | PhoneRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for user records, but required by base class
    throw new Error('buildSheetPK not applicable for UserRepository')
  }

  // ===== ADDRESS OPERATIONS =====

  /**
   * Get all addresses for a user
   */
  async getAddresses(email: string): Promise<AddressQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'ADDRESS#' }
    )
    return {
      items: result.items as AddressRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get a specific address
   */
  async getAddress(email: string, addressId: string): Promise<AddressRecord | null> {
    const pk = `USER#${email}`
    const sk = `ADDRESS#${addressId}`
    return this.get(pk, sk) as Promise<AddressRecord | null>
  }

  /**
   * Add a new address
   */
  async addAddress(email: string, address: Omit<AddressRecord, 'PK' | 'SK' | 'lastUpdated' | 'version'>): Promise<void> {
    const record: AddressRecord = {
      ...address,
      PK: `USER#${email}`,
      SK: `ADDRESS#${address.addressId}`,
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record as any)
  }

  /**
   * Update an existing address
   */
  async updateAddress(
    email: string,
    addressId: string,
    updates: Partial<Omit<AddressRecord, 'PK' | 'SK' | 'addressId'>>
  ): Promise<AddressRecord> {
    const pk = `USER#${email}`
    const sk = `ADDRESS#${addressId}`
    return this.update(pk, sk, updates) as Promise<AddressRecord>
  }

  /**
   * Delete an address
   */
  async deleteAddress(email: string, addressId: string): Promise<void> {
    const pk = `USER#${email}`
    const sk = `ADDRESS#${addressId}`
    await this.delete(pk, sk)
  }

  /**
   * Get primary address for a user
   */
  async getPrimaryAddress(email: string): Promise<AddressRecord | null> {
    const result = await this.getAddresses(email)
    return result.items.find(addr => addr.isPrimary) || null
  }

  // ===== PHONE OPERATIONS =====

  /**
   * Get all phones for a user
   */
  async getPhones(email: string): Promise<PhoneQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'PHONE#' }
    )
    return {
      items: result.items as PhoneRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get a specific phone
   */
  async getPhone(email: string, phoneId: string): Promise<PhoneRecord | null> {
    const pk = `USER#${email}`
    const sk = `PHONE#${phoneId}`
    return this.get(pk, sk) as Promise<PhoneRecord | null>
  }

  /**
   * Add a new phone
   */
  async addPhone(email: string, phone: Omit<PhoneRecord, 'PK' | 'SK' | 'lastUpdated' | 'version'>): Promise<void> {
    const record: PhoneRecord = {
      ...phone,
      PK: `USER#${email}`,
      SK: `PHONE#${phone.phoneId}`,
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record as any)
  }

  /**
   * Update an existing phone
   */
  async updatePhone(
    email: string,
    phoneId: string,
    updates: Partial<Omit<PhoneRecord, 'PK' | 'SK' | 'phoneId'>>
  ): Promise<PhoneRecord> {
    const pk = `USER#${email}`
    const sk = `PHONE#${phoneId}`
    return this.update(pk, sk, updates) as Promise<PhoneRecord>
  }

  /**
   * Delete a phone
   */
  async deletePhone(email: string, phoneId: string): Promise<void> {
    const pk = `USER#${email}`
    const sk = `PHONE#${phoneId}`
    await this.delete(pk, sk)
  }

  /**
   * Get primary phone for a user
   */
  async getPrimaryPhone(email: string): Promise<PhoneRecord | null> {
    const result = await this.getPhones(email)
    return result.items.find(phone => phone.isPrimary) || null
  }

  /**
   * Replace all phones for a user (for batch update with ordering)
   */
  async replaceAllPhones(
    email: string,
    phones: Array<{ phoneId: string; type: string; number: string; order: number }>
  ): Promise<void> {
    // Delete existing phones
    const existing = await this.getPhones(email)
    for (const phone of existing.items) {
      await this.deletePhone(email, phone.phoneId)
    }

    // Add new phones
    for (const phone of phones) {
      await this.addPhone(email, {
        phoneId: phone.phoneId,
        type: phone.type as PhoneRecord['type'],
        number: phone.number,
        isPrimary: phone.order === 0, // First is primary
        isHousehold: false,
        order: phone.order,
      })
    }
  }

  // ===== EMAIL OPERATIONS =====

  /**
   * Get all emails for a user
   */
  async getEmails(primaryEmail: string): Promise<EmailQueryResult> {
    const pk = `USER#${primaryEmail}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'EMAIL#' }
    )
    return {
      items: result.items as EmailRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get a specific email record
   */
  async getEmail(primaryEmail: string, emailId: string): Promise<EmailRecord | null> {
    const pk = `USER#${primaryEmail}`
    const sk = `EMAIL#${emailId}`
    return this.get(pk, sk) as Promise<EmailRecord | null>
  }

  /**
   * Get email by verification token
   */
  async getEmailByToken(token: string): Promise<EmailRecord | null> {
    const result = await this.scan({
      filterExpression: 'verificationToken = :token AND begins_with(skey, :skPrefix)',
      expressionAttributeValues: {
        ':token': token,
        ':skPrefix': 'EMAIL#',
      },
    })
    return (result.items[0] as EmailRecord) || null
  }

  /**
   * Add a new email
   */
  async addEmail(
    primaryEmail: string,
    email: Omit<EmailRecord, 'PK' | 'SK' | 'lastUpdated' | 'version'>
  ): Promise<void> {
    const record: EmailRecord = {
      ...email,
      PK: `USER#${primaryEmail}`,
      SK: `EMAIL#${email.emailId}`,
      lastUpdated: new Date().toISOString(),
      version: 0,
    }
    await this.put(record as any)
  }

  /**
   * Update an existing email
   */
  async updateEmail(
    primaryEmail: string,
    emailId: string,
    updates: Partial<Omit<EmailRecord, 'PK' | 'SK' | 'emailId'>>
  ): Promise<EmailRecord> {
    const pk = `USER#${primaryEmail}`
    const sk = `EMAIL#${emailId}`
    return this.update(pk, sk, updates) as Promise<EmailRecord>
  }

  /**
   * Delete an email
   */
  async deleteEmail(primaryEmail: string, emailId: string): Promise<void> {
    const pk = `USER#${primaryEmail}`
    const sk = `EMAIL#${emailId}`
    await this.delete(pk, sk)
  }

  /**
   * Replace all emails for a user (for batch update with ordering)
   */
  async replaceAllEmails(
    primaryEmail: string,
    emails: Array<{
      emailId: string
      email: string
      verified: boolean
      order: number
      isPrimary?: boolean
      subscribed?: boolean
    }>
  ): Promise<void> {
    // Delete existing emails (except the primary login email marker)
    const existing = await this.getEmails(primaryEmail)
    for (const email of existing.items) {
      if (!email.isPrimary) {
        await this.deleteEmail(primaryEmail, email.emailId)
      }
    }

    // Add new emails
    for (const email of emails) {
      await this.addEmail(primaryEmail, {
        emailId: email.emailId,
        email: email.email,
        verified: email.verified,
        order: email.order,
        isPrimary: email.isPrimary,
        subscribed: email.subscribed,
      })
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository()
