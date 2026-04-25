import { BaseRepository } from './base-repository'
import type {
  ContactRequestRecord,
  ContactRequestType,
  ContactRequestStatus,
  ContactRequestReason,
  ContactRequestQueryResult,
} from '../types'

// Generate a simple unique ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Maximum active (pending + non-expired) requests a user can have outstanding
const MAX_ACTIVE_REQUESTS = 3

// Requests expire after 7 days
const REQUEST_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Check if a contact request has expired (older than 7 days)
 */
function isExpired(request: ContactRequestRecord): boolean {
  if (!request.createdAt) return false
  const createdAt = new Date(request.createdAt).getTime()
  return Date.now() - createdAt > REQUEST_EXPIRY_MS
}

/**
 * Repository for contact request records
 * Contact requests are identified (recipient sees who is requesting)
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class ContactRequestRepository extends BaseRepository<ContactRequestRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for contact request records, but required by base class
    throw new Error('buildSheetPK not applicable for ContactRequestRepository')
  }

  /**
   * Create a contact request
   */
  async createRequest(
    requesterEmail: string,
    recipientEmail: string,
    requestType: ContactRequestType,
    message?: string,
    reason?: ContactRequestReason
  ): Promise<ContactRequestRecord> {
    const requestId = generateRequestId()
    const now = new Date().toISOString()

    const record = {
      pkey: `USER#${recipientEmail}`,
      skey: `CONTACT_REQUEST#${requestId}`,
      requestId,
      requesterEmail,
      recipientEmail,
      requestType,
      reason,
      message,
      status: 'pending',
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record as any)
    return record as unknown as ContactRequestRecord
  }

  /**
   * Get all contact requests received by a user
   */
  async getReceivedRequests(email: string): Promise<ContactRequestQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'CONTACT_REQUEST#' }
    )
    return {
      items: result.items as ContactRequestRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get pending contact requests for a user (excludes expired)
   */
  async getPendingRequests(email: string): Promise<ContactRequestRecord[]> {
    const result = await this.getReceivedRequests(email)
    return result.items.filter(req => req.status === 'pending' && !isExpired(req))
  }

  /**
   * Get a specific contact request
   */
  async getRequest(recipientEmail: string, requestId: string): Promise<ContactRequestRecord | null> {
    const pk = `USER#${recipientEmail}`
    const sk = `CONTACT_REQUEST#${requestId}`
    return this.get(pk, sk)
  }

  /**
   * Update request status
   */
  async updateRequestStatus(
    recipientEmail: string,
    requestId: string,
    status: ContactRequestStatus
  ): Promise<ContactRequestRecord> {
    const pk = `USER#${recipientEmail}`
    const sk = `CONTACT_REQUEST#${requestId}`
    return this.update(pk, sk, { status })
  }

  /**
   * Mark a request as viewed
   */
  async markAsViewed(recipientEmail: string, requestId: string): Promise<ContactRequestRecord> {
    return this.updateRequestStatus(recipientEmail, requestId, 'viewed')
  }

  /**
   * Mark a request as responded
   */
  async markAsResponded(recipientEmail: string, requestId: string): Promise<ContactRequestRecord> {
    return this.updateRequestStatus(recipientEmail, requestId, 'responded')
  }

  /**
   * Decline a request
   */
  async declineRequest(recipientEmail: string, requestId: string): Promise<ContactRequestRecord> {
    return this.updateRequestStatus(recipientEmail, requestId, 'declined')
  }

  /**
   * Delete a contact request (use sparingly - prefer updating status)
   */
  async deleteRequest(recipientEmail: string, requestId: string): Promise<void> {
    const pk = `USER#${recipientEmail}`
    const sk = `CONTACT_REQUEST#${requestId}`
    await this.delete(pk, sk)
  }

  /**
   * Get count of unread (pending) requests
   */
  async getUnreadCount(email: string): Promise<number> {
    const pending = await this.getPendingRequests(email)
    return pending.length
  }

  /**
   * Check if there's an existing pending request from requester to recipient
   */
  async hasPendingRequest(requesterEmail: string, recipientEmail: string): Promise<boolean> {
    const requests = await this.getReceivedRequests(recipientEmail)
    return requests.items.some(
      req => req.requesterEmail === requesterEmail && req.status === 'pending'
    )
  }

  /**
   * Get requests sent by a user (requires scanning)
   * Use sparingly as this is less efficient
   */
  async getSentRequests(email: string): Promise<ContactRequestRecord[]> {
    const result = await this.scan({
      filterExpression: 'requesterEmail = :email',
      expressionAttributeValues: { ':email': email },
    })
    return result.items as ContactRequestRecord[]
  }

  /**
   * Count active (pending + non-expired) sent requests for a user
   * Used to enforce the MAX_ACTIVE_REQUESTS limit
   */
  async countActiveSentRequests(email: string): Promise<number> {
    const sent = await this.getSentRequests(email)
    return sent.filter(req => req.status === 'pending' && !isExpired(req)).length
  }

  /**
   * Get the maximum number of active requests allowed
   */
  static get MAX_ACTIVE_REQUESTS(): number {
    return MAX_ACTIVE_REQUESTS
  }
}

// Export singleton instance
export const contactRequestRepository = new ContactRequestRepository()
