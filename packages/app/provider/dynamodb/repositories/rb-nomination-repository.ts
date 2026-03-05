import { v4 as uuidv4 } from 'uuid'
import { BaseRepository } from './base-repository'
import type { RBNominationRecord, RBNominationSecond, RBNominationStatus } from '../types'

export interface CreateNominationInput {
  ecclesia: string
  nomineeEmail: string
  nomineeName: string
  nominatedBy: string
  nominatedByName: string
  emailPreference?: 'personal' | 'ecclesia'
  rbEcclesiaEmail?: string
}

/**
 * Repository for Recording Brother Nomination records
 * Uses 'tee-admin' table with lowercase keys (pkey, skey)
 * PK: RB_NOM#{ecclesia}, SK: NOMINATION#{nominationId}
 */
export class RBNominationRepository extends BaseRepository<RBNominationRecord> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for RBNominationRepository')
  }

  /**
   * Create a new nomination
   */
  async create(input: CreateNominationInput): Promise<RBNominationRecord> {
    const nominationId = uuidv4()
    const now = new Date().toISOString()

    const record: RBNominationRecord = {
      pkey: `RB_NOM#${input.ecclesia}`,
      skey: `NOMINATION#${nominationId}`,
      nominationId,
      ecclesia: input.ecclesia,
      nomineeEmail: input.nomineeEmail.toLowerCase(),
      nomineeName: input.nomineeName,
      nominatedBy: input.nominatedBy,
      nominatedByName: input.nominatedByName,
      seconds: [],
      secondsNeeded: 2,
      status: 'open',
      emailPreference: input.emailPreference,
      rbEcclesiaEmail: input.rbEcclesiaEmail,
      createdAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)
    return record
  }

  /**
   * Get open nominations for an ecclesia
   */
  async getOpenByEcclesia(ecclesia: string): Promise<RBNominationRecord[]> {
    const result = await this.query(
      'pkey = :pk',
      { ':pk': `RB_NOM#${ecclesia}`, ':status': 'open' },
      {
        filterExpression: '#status = :status',
        expressionAttributeNames: { '#status': 'status' },
      }
    )
    return result.items
  }

  /**
   * Add a second to a nomination. If enough seconds are collected, auto-confirm.
   */
  async addSecond(
    ecclesia: string,
    nominationId: string,
    seconderEmail: string,
    seconderName: string
  ): Promise<{ nomination: RBNominationRecord; confirmed: boolean }> {
    const nomination = await this.get(`RB_NOM#${ecclesia}`, `NOMINATION#${nominationId}`)
    if (!nomination) throw new Error(`Nomination ${nominationId} not found`)
    if (nomination.status !== 'open') throw new Error(`Nomination is already ${nomination.status}`)

    // Check for duplicate second
    if (nomination.seconds.some(s => s.email === seconderEmail)) {
      throw new Error('You have already seconded this nomination')
    }

    // Cannot second own nomination
    if (nomination.nominatedBy === seconderEmail) {
      throw new Error('You cannot second your own nomination')
    }

    const now = new Date().toISOString()
    const newSecond: RBNominationSecond = {
      email: seconderEmail,
      name: seconderName,
      at: now,
    }

    const updatedSeconds = [...nomination.seconds, newSecond]
    const confirmed = updatedSeconds.length >= nomination.secondsNeeded

    const updates: Partial<RBNominationRecord> = {
      seconds: updatedSeconds,
    } as Partial<RBNominationRecord>

    if (confirmed) {
      (updates as any).status = 'confirmed' as RBNominationStatus
    }

    const updated = await this.update(
      `RB_NOM#${ecclesia}`,
      `NOMINATION#${nominationId}`,
      updates
    )

    return { nomination: updated, confirmed }
  }

  /**
   * Withdraw a nomination
   */
  async withdraw(ecclesia: string, nominationId: string): Promise<RBNominationRecord> {
    return this.update(
      `RB_NOM#${ecclesia}`,
      `NOMINATION#${nominationId}`,
      { status: 'withdrawn' as RBNominationStatus } as Partial<RBNominationRecord>
    )
  }
}

export const rbNominationRepository = new RBNominationRepository()
