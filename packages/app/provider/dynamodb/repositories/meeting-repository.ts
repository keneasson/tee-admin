import { BaseRepository } from './base-repository'
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
    return `OWNER#${ownerType}#${ownerName}`
  }

  async create(
    data: Omit<
      MeetingRecord,
      'pkey' | 'skey' | 'gsi1pk' | 'gsi1sk' | 'meetingId' | 'createdAt' | 'updatedAt' | 'lastUpdated' | 'version'
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

  async getByTitle(title: string): Promise<MeetingRecord | null> {
    // Scan with filter — used for supersedes detection by title match
    let lastKey: Record<string, any> | undefined
    do {
      const result = await this.scan({
        filterExpression: 'begins_with(pkey, :prefix) AND #t = :title',
        expressionAttributeValues: {
          ':prefix': 'MEETING#',
          ':title': title,
        },
        expressionAttributeNames: {
          '#t': 'title',
        },
        limit: 100,
        lastEvaluatedKey: lastKey,
      })
      if (result.items.length > 0) {
        return result.items[0] as MeetingRecord
      }
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return null
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
    const result = await this.query(
      'gsi1pk = :gsi1pk',
      { ':gsi1pk': this.ownerGsiPk(ownerType, ownerName) },
      {
        indexName: 'GSI1',
        scanIndexForward: true,
      }
    )
    return result.items
  }

  async listAll(): Promise<MeetingRecord[]> {
    const allItems: MeetingRecord[] = []
    let lastKey: Record<string, any> | undefined
    do {
      const result = await this.scan({
        filterExpression: 'begins_with(pkey, :prefix)',
        expressionAttributeValues: {
          ':prefix': 'MEETING#',
        },
        limit: 200,
        lastEvaluatedKey: lastKey,
      })
      allItems.push(...result.items)
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    // Sort by nextOccurrence
    allItems.sort((a, b) => (a.gsi1sk ?? '').localeCompare(b.gsi1sk ?? ''))
    return allItems
  }

  async getUpcoming(limit?: number): Promise<MeetingRecord[]> {
    const today = new Date().toISOString().split('T')[0]!
    // Scan active meetings with nextOccurrence >= today
    const allItems: MeetingRecord[] = []
    let lastKey: Record<string, any> | undefined
    do {
      const result = await this.scan({
        filterExpression:
          'begins_with(pkey, :prefix) AND #active = :active AND gsi1sk >= :today',
        expressionAttributeValues: {
          ':prefix': 'MEETING#',
          ':active': true,
          ':today': today,
        },
        expressionAttributeNames: {
          '#active': 'active',
        },
        limit: limit ? limit * 2 : 200,
        lastEvaluatedKey: lastKey,
      })
      allItems.push(...result.items)
      lastKey = result.lastEvaluatedKey
      if (limit && allItems.length >= limit) break
    } while (lastKey)

    // Sort by nextOccurrence
    allItems.sort((a, b) => (a.gsi1sk ?? '').localeCompare(b.gsi1sk ?? ''))
    return limit ? allItems.slice(0, limit) : allItems
  }

  async getSupersedingMeeting(
    scheduleType: string,
    date: string
  ): Promise<MeetingRecord | null> {
    // Find an active meeting that supersedes the given scheduleType on the given date
    let lastKey: Record<string, any> | undefined
    do {
      const result = await this.scan({
        filterExpression:
          'begins_with(pkey, :prefix) AND #active = :active AND supersedes.scheduleType = :st AND gsi1sk = :d',
        expressionAttributeValues: {
          ':prefix': 'MEETING#',
          ':active': true,
          ':st': scheduleType,
          ':d': date,
        },
        expressionAttributeNames: {
          '#active': 'active',
        },
        limit: 100,
        lastEvaluatedKey: lastKey,
      })
      if (result.items.length > 0) {
        return result.items[0] as MeetingRecord
      }
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    return null
  }
}

export const meetingRepository = new MeetingRepository()
