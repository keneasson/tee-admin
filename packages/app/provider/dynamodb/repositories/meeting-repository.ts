import { BaseRepository } from './base-repository'
import { ENTRIES, PATTERNS } from '../access-patterns'
import type { MeetingRecord } from '@my/app/types/meetings'

class MeetingRepository extends BaseRepository<MeetingRecord> {
  constructor() {
    super('admin', false)
  }

  protected buildSheetPK(_sheetId: string): string {
    throw new Error('buildSheetPK not applicable for MeetingRepository')
  }

  private pk(meetingId: string): string {
    return `MEETING#${meetingId}`
  }

  private ownerGsiPk(ownerType: string, ownerName: string): string {
    return PATTERNS.meetingsByOwner.pk({ ownerType, ownerName })
  }

  async create(
    data: Omit<
      MeetingRecord,
      'pkey' | 'skey' | 'gsi1pk' | 'gsi1sk' | 'gsi4pk' | 'gsi4sk' | 'meetingId' | 'createdAt' | 'updatedAt' | 'lastUpdated' | 'version'
    >
  ): Promise<MeetingRecord> {
    const meetingId = crypto.randomUUID()
    const now = new Date().toISOString()

    const record: MeetingRecord = {
      ...data,
      pkey: this.pk(meetingId),
      skey: 'DETAILS',
      gsi1pk: this.ownerGsiPk(data.ownerType, data.ownerName),
      gsi1sk: data.nextOccurrence ?? '9999-12-31',
      ...ENTRIES.meeting(data),
      meetingId,
      createdAt: now,
      updatedAt: now,
      lastUpdated: now,
      version: 0,
    }

    await this.put(record)
    return record
  }

  async getById(meetingId: string): Promise<MeetingRecord | null> {
    return this.get(this.pk(meetingId), 'DETAILS')
  }

  async updateMeeting(
    meetingId: string,
    updates: Partial<MeetingRecord>
  ): Promise<boolean> {
    try {
      // Recompute GSI keys if owner or nextOccurrence changed
      const gsiUpdates: Partial<MeetingRecord> = { ...updates }
      if (updates.ownerType || updates.ownerName) {
        // Need current record to fill in missing owner fields
        const current = await this.getById(meetingId)
        if (!current) return false
        const ownerType = updates.ownerType ?? current.ownerType
        const ownerName = updates.ownerName ?? current.ownerName
        gsiUpdates.gsi1pk = this.ownerGsiPk(ownerType, ownerName)
      }
      if ('nextOccurrence' in updates) {
        gsiUpdates.gsi1sk = updates.nextOccurrence ?? '9999-12-31'
        Object.assign(gsiUpdates, ENTRIES.meeting(updates))
      }

      gsiUpdates.updatedAt = new Date().toISOString()

      await this.update(this.pk(meetingId), 'DETAILS', gsiUpdates)
      return true
    } catch (error) {
      console.error('Error updating meeting:', error)
      return false
    }
  }

  async deleteMeeting(meetingId: string): Promise<boolean> {
    try {
      await this.delete(this.pk(meetingId), 'DETAILS')
      return true
    } catch (error) {
      console.error('Error deleting meeting:', error)
      return false
    }
  }

  async listByOwner(ownerType: string, ownerName: string): Promise<MeetingRecord[]> {
    return this.queryPattern(PATTERNS.meetingsByOwner, { ownerType, ownerName }, { scanIndexForward: true })
  }

  /** Every meeting, soonest next occurrence first (gsi4 `MEETINGS`). */
  async listAll(): Promise<MeetingRecord[]> {
    return this.queryPattern(PATTERNS.meetingsAll, undefined, { scanIndexForward: true })
  }
}

export const meetingRepository = new MeetingRepository()
