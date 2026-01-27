import { randomBytes } from 'crypto'
import { BaseRepository } from './base-repository'
import type {
  EditRequestRecord,
  EditRequestField,
  EditRequestStatus,
} from '../types'

// Generate a simple unique ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// Generate secure approval token
function generateApprovalToken(): string {
  return randomBytes(32).toString('hex')
}

// Token expiry: 7 days
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export interface EditRequestQueryResult {
  items: EditRequestRecord[]
  lastEvaluatedKey?: Record<string, any>
}

/**
 * Repository for edit request records
 * Edit requests allow users to suggest changes to another user's profile
 * The target user must approve changes via email link or by signing in
 *
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 */
export class EditRequestRepository extends BaseRepository<EditRequestRecord> {
  constructor() {
    super('admin', false) // false = lowercase keys (pkey, skey)
  }

  protected buildSheetPK(_sheetId: string): string {
    // Not used for edit request records, but required by base class
    throw new Error('buildSheetPK not applicable for EditRequestRepository')
  }

  /**
   * Create an edit request
   */
  async createRequest(
    requesterEmail: string,
    requesterName: string | undefined,
    targetEmail: string,
    field: EditRequestField,
    suggestedValue: string,
    currentValue?: string,
    message?: string
  ): Promise<EditRequestRecord> {
    const requestId = generateRequestId()
    const approvalToken = generateApprovalToken()
    const now = new Date().toISOString()
    const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString()

    // Note: tee-admin table uses lowercase keys (pkey, skey)
    // The record type uses PK/SK for clarity, but we store with lowercase keys
    const record = {
      pkey: `USER#${targetEmail}`,
      skey: `EDIT_REQUEST#${requestId}`,
      requestId,
      requesterEmail,
      requesterName,
      targetEmail,
      field,
      currentValue,
      suggestedValue,
      message,
      status: 'pending' as const,
      approvalToken,
      tokenExpiry,
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record as any)
    // Return with aliased keys for type compatibility
    return {
      ...record,
      PK: record.pkey,
      SK: record.skey,
    } as unknown as EditRequestRecord
  }

  /**
   * Get all edit requests for a user (requests to edit their data)
   */
  async getEditRequestsForUser(email: string): Promise<EditRequestQueryResult> {
    const pk = `USER#${email}`
    const result = await this.query(
      'pkey = :pk AND begins_with(skey, :skPrefix)',
      { ':pk': pk, ':skPrefix': 'EDIT_REQUEST#' }
    )
    return {
      items: result.items as EditRequestRecord[],
      lastEvaluatedKey: result.lastEvaluatedKey,
    }
  }

  /**
   * Get pending edit requests for a user
   */
  async getPendingRequests(email: string): Promise<EditRequestRecord[]> {
    const result = await this.getEditRequestsForUser(email)
    return result.items.filter(req => req.status === 'pending')
  }

  /**
   * Get a specific edit request by ID
   */
  async getRequestById(targetEmail: string, requestId: string): Promise<EditRequestRecord | null> {
    const pk = `USER#${targetEmail}`
    const sk = `EDIT_REQUEST#${requestId}`
    return this.get(pk, sk)
  }

  /**
   * Get an edit request by approval token (for email-based approval)
   * This requires scanning, but is only used during approval so acceptable
   */
  async getRequestByToken(token: string): Promise<EditRequestRecord | null> {
    const result = await this.scan({
      filterExpression: 'approvalToken = :token AND begins_with(#skey, :skPrefix)',
      expressionAttributeValues: {
        ':token': token,
        ':skPrefix': 'EDIT_REQUEST#'
      },
      expressionAttributeNames: { '#skey': 'skey' },
    })

    if (result.items.length === 0) {
      return null
    }

    const request = result.items[0] as EditRequestRecord

    // Check if token is expired
    if (request.tokenExpiry && new Date(request.tokenExpiry) < new Date()) {
      // Token expired - update status
      await this.updateRequestStatus(request.targetEmail, request.requestId, 'expired')
      return null
    }

    return request
  }

  /**
   * Update request status
   */
  async updateRequestStatus(
    targetEmail: string,
    requestId: string,
    status: EditRequestStatus
  ): Promise<EditRequestRecord> {
    const pk = `USER#${targetEmail}`
    const sk = `EDIT_REQUEST#${requestId}`
    const updates: Partial<EditRequestRecord> = {
      status,
      respondedAt: status !== 'pending' ? new Date().toISOString() : undefined,
    }
    return this.update(pk, sk, updates)
  }

  /**
   * Approve an edit request
   */
  async approveRequest(targetEmail: string, requestId: string): Promise<EditRequestRecord> {
    return this.updateRequestStatus(targetEmail, requestId, 'approved')
  }

  /**
   * Reject an edit request
   */
  async rejectRequest(targetEmail: string, requestId: string): Promise<EditRequestRecord> {
    return this.updateRequestStatus(targetEmail, requestId, 'rejected')
  }

  /**
   * Delete an edit request (use sparingly - prefer updating status)
   */
  async deleteRequest(targetEmail: string, requestId: string): Promise<void> {
    const pk = `USER#${targetEmail}`
    const sk = `EDIT_REQUEST#${requestId}`
    await this.delete(pk, sk)
  }

  /**
   * Get count of pending requests for a user
   */
  async getPendingCount(email: string): Promise<number> {
    const pending = await this.getPendingRequests(email)
    return pending.length
  }

  /**
   * Check if there's an existing pending request for the same field from same requester
   */
  async hasPendingRequestForField(
    requesterEmail: string,
    targetEmail: string,
    field: EditRequestField
  ): Promise<boolean> {
    const requests = await this.getEditRequestsForUser(targetEmail)
    return requests.items.some(
      req =>
        req.requesterEmail === requesterEmail &&
        req.field === field &&
        req.status === 'pending'
    )
  }

  /**
   * Get requests sent by a user (requires scanning)
   * Use sparingly as this is less efficient
   */
  async getSentRequests(email: string): Promise<EditRequestRecord[]> {
    const result = await this.scan({
      filterExpression: 'requesterEmail = :email AND begins_with(#skey, :skPrefix)',
      expressionAttributeValues: {
        ':email': email,
        ':skPrefix': 'EDIT_REQUEST#'
      },
      expressionAttributeNames: { '#skey': 'skey' },
    })
    return result.items as EditRequestRecord[]
  }

  /**
   * Clean up expired requests (can be called periodically)
   */
  async cleanupExpiredRequests(): Promise<number> {
    const now = new Date().toISOString()
    const result = await this.scan({
      filterExpression: 'begins_with(#skey, :skPrefix) AND #status = :pending AND tokenExpiry < :now',
      expressionAttributeValues: {
        ':skPrefix': 'EDIT_REQUEST#',
        ':pending': 'pending',
        ':now': now,
      },
      expressionAttributeNames: {
        '#skey': 'skey',
        '#status': 'status',
      },
    })

    let cleaned = 0
    for (const request of result.items as EditRequestRecord[]) {
      await this.updateRequestStatus(request.targetEmail, request.requestId, 'expired')
      cleaned++
    }

    return cleaned
  }
}

// Export singleton instance
export const editRequestRepository = new EditRequestRepository()
