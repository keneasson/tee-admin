import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import { personRepository } from './person-repository'
import type { DraftMemberRecord, DraftStatus } from '../types'

export interface CreateDraftInput {
  firstName: string
  lastName: string
  email: string
  ecclesia: string
  createdBy: string
  createdByName: string
}

/**
 * Repository for Draft Member records
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 * PK: DRAFT#{ecclesia}, SK: MEMBER#{draftId}
 * GSI1: DRAFT_STATUS#{status}, {ecclesia}#{createdAt}
 */
export class DraftMemberRepository extends BaseRepository<DraftMemberRecord> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for DraftMemberRepository')
  }

  /**
   * Create a new draft member
   */
  async create(input: CreateDraftInput): Promise<DraftMemberRecord> {
    const draftId = uuidv4()
    const now = new Date().toISOString()

    const record: DraftMemberRecord = {
      pkey: `DRAFT#${input.ecclesia}`,
      skey: `MEMBER#${draftId}`,
      gsi1pk: 'DRAFT_STATUS#pending',
      gsi1sk: `${input.ecclesia}#${now}`,
      draftId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      ecclesia: input.ecclesia,
      status: 'pending',
      createdBy: input.createdBy,
      createdByName: input.createdByName,
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)
    return record
  }

  /**
   * Get all drafts for an ecclesia
   */
  async getByEcclesia(ecclesia: string): Promise<DraftMemberRecord[]> {
    const result = await this.query(
      'pkey = :pk',
      { ':pk': `DRAFT#${ecclesia}` }
    )
    return result.items
  }

  /**
   * Get all pending drafts across all ecclesias via GSI1
   */
  async getPending(): Promise<DraftMemberRecord[]> {
    const result = await this.query(
      'gsi1pk = :gsi1pk',
      { ':gsi1pk': 'DRAFT_STATUS#pending' },
      { indexName: 'gsi1' }
    )
    return result.items
  }

  /**
   * Get pending drafts for a specific ecclesia
   */
  async getPendingByEcclesia(ecclesia: string): Promise<DraftMemberRecord[]> {
    const result = await this.query(
      'pkey = :pk',
      { ':pk': `DRAFT#${ecclesia}`, ':status': 'pending' },
      {
        filterExpression: '#status = :status',
        expressionAttributeNames: { '#status': 'status' },
      }
    )
    return result.items
  }

  /**
   * Approve a draft — creates a real PersonRecord
   */
  async approve(draftId: string, ecclesia: string, reviewerEmail: string): Promise<DraftMemberRecord> {
    const draft = await this.get(`DRAFT#${ecclesia}`, `MEMBER#${draftId}`)
    if (!draft) throw new Error(`Draft ${draftId} not found`)
    if (draft.status !== 'pending') throw new Error(`Draft ${draftId} is already ${draft.status}`)

    const now = new Date().toISOString()

    // Update draft status
    const updated = await this.update(
      `DRAFT#${ecclesia}`,
      `MEMBER#${draftId}`,
      {
        status: 'approved' as DraftStatus,
        gsi1pk: 'DRAFT_STATUS#approved',
        reviewedBy: reviewerEmail,
        reviewedAt: now,
      } as Partial<DraftMemberRecord>
    )

    // Create real PersonRecord
    await personRepository.create({
      email: draft.email,
      firstName: draft.firstName,
      lastName: draft.lastName,
      ecclesia: draft.ecclesia,
      memberStatus: 'member',
      role: 'guest',
    })

    return updated
  }

  /**
   * Reject a draft
   */
  async reject(draftId: string, ecclesia: string, reviewerEmail: string, note?: string): Promise<DraftMemberRecord> {
    const draft = await this.get(`DRAFT#${ecclesia}`, `MEMBER#${draftId}`)
    if (!draft) throw new Error(`Draft ${draftId} not found`)
    if (draft.status !== 'pending') throw new Error(`Draft ${draftId} is already ${draft.status}`)

    const now = new Date().toISOString()

    return this.update(
      `DRAFT#${ecclesia}`,
      `MEMBER#${draftId}`,
      {
        status: 'rejected' as DraftStatus,
        gsi1pk: 'DRAFT_STATUS#rejected',
        reviewedBy: reviewerEmail,
        reviewedAt: now,
        ...(note ? { reviewNote: note } : {}),
      } as Partial<DraftMemberRecord>
    )
  }
}

export const draftMemberRepository = new DraftMemberRepository()
