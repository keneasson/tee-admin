import { BaseRepository } from './base-repository'
import type { 
  ScheduleRecord, 
  EventData,
  EcclesiaDateRangeQuery, 
  DateRangeQuery,
} from '../types'
import type { ProgramTypeKeys, ProgramTypes } from '@my/app/types'

export class ScheduleRepository extends BaseRepository<ScheduleRecord> {
  constructor() {
    super('schedules') // Uses new tee-schedules table
  }

  protected buildSheetPK(sheetId: string): string {
    return `SHEET#${sheetId}` // Not typically used for this table design
  }

  // Key builders for unified schedule/event table
  private buildSchedulePK(type: string): string {
    return `SCHEDULE#${type.toUpperCase()}`
  }

  private buildEventPK(eventId: string): string {
    return `EVENT#${eventId}`
  }

  private buildScheduleSK(date: string, index: number = 0): string {
    // Match the existing format: DATE#2025-01-02T00:30:00.000Z#0
    const isoDate = new Date(date).toISOString()
    return `DATE#${isoDate}#${index}`
  }

  private buildEcclesiaGSI1PK(ecclesia: string): string {
    return `ECCLESIA#${ecclesia}`
  }

  private buildEcclesiaGSI1SK(date: string, type: string, time: string = '09:00'): string {
    return `${date}#${type}#${time}`
  }

  private buildTypeGSI2PK(type: string): string {
    return `TYPE#${type}`
  }

  private buildDateGSI2PK(date: string): string {
    return `DATE#${date}`
  }

  // Create a new schedule record (from Google Sheets)
  async createScheduleRecord(
    sheetId: string,
    ecclesia: string,
    eventType: ProgramTypeKeys,
    date: string,
    data: ProgramTypes,
    time: string = '09:00',
    index: number = 0
  ): Promise<ScheduleRecord> {
    const record: ScheduleRecord = {
      PK: this.buildSchedulePK(eventType),
      SK: this.buildScheduleSK(date, index),
      sheetType: eventType,
      sheetId,
      date,
      data,  // Use 'data' not 'scheduleData' to match ScheduleService
      lastUpdated: new Date().toISOString(),
      version: '1',
    }

    await this.put(record)
    return record
  }

  // Create a new event record (standalone events)
  async createEventRecord(
    eventId: string,
    ecclesia: string,
    date: string,
    eventData: EventData
  ): Promise<ScheduleRecord> {
    const record: ScheduleRecord = {
      PK: this.buildEventPK(eventId),
      SK: 'DETAILS',
      GSI1PK: this.buildEcclesiaGSI1PK(ecclesia),
      GSI1SK: this.buildEcclesiaGSI1SK(date, 'event', eventData.time),
      GSI2PK: this.buildDateGSI2PK(date),
      GSI2SK: eventData.time,
      ecclesia,
      date,
      type: 'event',
      eventId,
      title: eventData.title,
      time: eventData.time,
      description: eventData.description,
      details: eventData.details,
      lastUpdated: new Date().toISOString(),
      version: 1,
    }

    await this.put(record)
    return record
  }

  // PRIMARY ACCESS PATTERN: Get schedules by ecclesia and date range
  async getSchedulesByEcclesiaAndDateRange(
    query: EcclesiaDateRangeQuery
  ): Promise<{ items: ScheduleRecord[]; lastEvaluatedKey?: Record<string, any> }> {
    const result = await this.query(
      'GSI1PK = :ecclesia AND GSI1SK BETWEEN :startDate AND :endDate',
      {
        ':ecclesia': this.buildEcclesiaGSI1PK(query.ecclesia),
        ':startDate': query.startDate,
        ':endDate': `${query.endDate}#zzz`, // Include all types and times for end date
      },
      {
        indexName: 'GSI1',
        limit: query.limit,
        lastEvaluatedKey: query.lastEvaluatedKey,
        scanIndexForward: true, // Sort by date, type, time ascending
      }
    )

    return result
  }

  // NEWSLETTER OPTIMIZATION: Get ALL schedules/events for date range (all ecclesias)
  async getAllSchedulesByDateRange(
    query: DateRangeQuery
  ): Promise<{ items: ScheduleRecord[]; lastEvaluatedKey?: Record<string, any> }> {
    // Use scan with filter for cross-ecclesia queries
    const result = await this.scan({
      filterExpression: '#date BETWEEN :startDate AND :endDate',
      expressionAttributeNames: { '#date': 'date' },
      expressionAttributeValues: {
        ':startDate': query.startDate,
        ':endDate': query.endDate,
      },
      limit: query.limit,
      lastEvaluatedKey: query.lastEvaluatedKey,
    })

    // Sort by date then time
    result.items.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return (a.time || '09:00').localeCompare(b.time || '09:00')
    })

    return result
  }

  // Get schedules by type and date range
  async getSchedulesByTypeAndDateRange(
    eventType: ProgramTypeKeys | 'event',
    query: DateRangeQuery
  ): Promise<{ items: ScheduleRecord[]; lastEvaluatedKey?: Record<string, any> }> {
    const result = await this.query(
      'GSI2PK = :eventType AND GSI2SK BETWEEN :startDate AND :endDate',
      {
        ':eventType': this.buildTypeGSI2PK(eventType),
        ':startDate': `${query.startDate}#00:00`,
        ':endDate': `${query.endDate}#23:59`,
      },
      {
        indexName: 'GSI2',
        limit: query.limit,
        lastEvaluatedKey: query.lastEvaluatedKey,
        scanIndexForward: true,
      }
    )

    return result
  }

  // Get events by specific date (all ecclesias)
  async getEventsByDate(date: string): Promise<{ items: ScheduleRecord[]; lastEvaluatedKey?: Record<string, any> }> {
    const result = await this.query(
      'GSI2PK = :date',
      { ':date': this.buildDateGSI2PK(date) },
      {
        indexName: 'GSI2',
        scanIndexForward: true, // Sort by time
      }
    )

    return result
  }

  // Get latest schedules (next N days) for an ecclesia
  async getLatestSchedules(ecclesia: string, days: number = 30): Promise<{ items: ScheduleRecord[]; lastEvaluatedKey?: Record<string, any> }> {
    const startDate = new Date().toISOString().split('T')[0] // Today
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]

    return this.getSchedulesByEcclesiaAndDateRange({
      ecclesia,
      startDate,
      endDate,
    })
  }

  // Get specific schedule event
  async getScheduleEvent(
    date: string,
    ecclesia: string,
    eventType: string,
    time: string = '09:00',
    index: number = 0
  ): Promise<ScheduleRecord | null> {
    return this.get(
      this.buildSchedulePK(eventType),
      this.buildScheduleSK(date, index)
    )
  }

  // Get specific standalone event
  async getEvent(eventId: string): Promise<ScheduleRecord | null> {
    return this.get(this.buildEventPK(eventId), 'DETAILS')
  }

  // NEWSLETTER OPTIMIZATION: Get schedules grouped by date for newsletter generation
  async getSchedulesForNewsletter(
    startDate: string,
    endDate: string
  ): Promise<Record<string, ScheduleRecord[]>> {
    const result = await this.getAllSchedulesByDateRange({
      startDate,
      endDate,
    })

    // Group by date for newsletter layout
    const grouped: Record<string, ScheduleRecord[]> = {}
    result.items.forEach(schedule => {
      if (!grouped[schedule.date]) {
        grouped[schedule.date] = []
      }
      grouped[schedule.date].push(schedule)
    })

    // Sort each date's events by ecclesia then type
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const ecclesiaCompare = a.ecclesia.localeCompare(b.ecclesia)
        if (ecclesiaCompare !== 0) return ecclesiaCompare
        return a.type.localeCompare(b.type)
      })
    })

    return grouped
  }

  // Update schedule data
  async updateScheduleData(
    date: string,
    ecclesia: string,
    eventType: string,
    data: ProgramTypes,
    time: string = '09:00',
    index: number = 0
  ): Promise<ScheduleRecord> {
    return this.update(
      this.buildSchedulePK(eventType),
      this.buildScheduleSK(date, index),
      { data: data }  // Use 'data' not 'scheduleData'
    )
  }

  // Update event data
  async updateEventData(
    eventId: string,
    updates: Partial<EventData>
  ): Promise<ScheduleRecord> {
    return this.update(
      this.buildEventPK(eventId),
      'DETAILS',
      updates
    )
  }

  // Delete schedule event
  async deleteScheduleEvent(
    date: string,
    ecclesia: string,
    eventType: string,
    time: string = '09:00',
    index: number = 0
  ): Promise<void> {
    return this.delete(
      this.buildSchedulePK(eventType),
      this.buildScheduleSK(date, index)
    )
  }

  // Delete standalone event
  async deleteEvent(eventId: string): Promise<void> {
    return this.delete(this.buildEventPK(eventId), 'DETAILS')
  }

  // Bulk operations for sheet sync - SAFE CHECKSUM-BASED APPROACH
  async replaceSheetSchedules(
    sheetId: string,
    schedules: Array<{
      ecclesia: string
      date: string
      type: ProgramTypeKeys
      scheduleData: ProgramTypes
      time?: string
    }>
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    
    // Get existing records for this sheet
    const existingResult = await this.scan({
      filterExpression: 'sheetId = :sheetId',
      expressionAttributeValues: { ':sheetId': sheetId },
    })
    
    
    // All schedules from the same sheet will have the same type
    const sheetType = schedules[0]?.type
    if (!sheetType) {
      return { successful: 0, failed: 0, errors: [] }
    }
    
    // Create checksums for new data
    const newRecordsMap = new Map<string, ScheduleRecord>()
    const newRecords: ScheduleRecord[] = schedules.map((schedule, index) => {
      const record: ScheduleRecord = {
        PK: this.buildSchedulePK(schedule.type),
        SK: this.buildScheduleSK(schedule.date, index),
        sheetType: schedule.type,
        sheetId,
        date: schedule.date,
        data: schedule.scheduleData,  // This is the actual schedule data
        lastUpdated: new Date().toISOString(),
        version: '1',  // version should be string to match ScheduleService
      }
      
      // Create checksum key for comparison
      const checksumKey = `${record.PK}#${record.SK}`
      newRecordsMap.set(checksumKey, record)
      return record
    })

    // Find records to delete (exist in DB but not in new data)
    const recordsToDelete: Array<{PK: string, SK: string}> = []
    const existingChecksums = new Set<string>()
    
    existingResult.items.forEach(existingRecord => {
      const checksumKey = `${existingRecord.PK}#${existingRecord.SK}`
      existingChecksums.add(checksumKey)
      
      if (!newRecordsMap.has(checksumKey)) {
        recordsToDelete.push({
          PK: existingRecord.PK,
          SK: existingRecord.SK
        })
      }
    })

    // Find records to add/update (new data that doesn't exist or has changed)
    const recordsToUpsert: ScheduleRecord[] = []
    newRecords.forEach(newRecord => {
      const checksumKey = `${newRecord.PK}#${newRecord.SK}`
      recordsToUpsert.push(newRecord) // Always upsert for now - could add content comparison later
    })


    let successful = 0
    let failed = 0
    const errors: string[] = []

    // Delete removed records
    try {
      const deletePromises = recordsToDelete.map(record => 
        this.delete(record.PK, record.SK)
      )
      await Promise.all(deletePromises)
    } catch (error) {
      console.error('❌ Error deleting records:', error)
      errors.push(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      failed += recordsToDelete.length
    }

    // Upsert new/updated records
    if (recordsToUpsert.length > 0) {
      try {
        const result = await this.batchWrite(recordsToUpsert)
        successful += result.successful
        failed += result.failed
        errors.push(...result.errors)
      } catch (error) {
        console.error('❌ Error upserting records:', error)
        errors.push(`Upsert failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        failed += recordsToUpsert.length
      }
    }

    return { successful, failed, errors }
  }

  // Clear schedule records for a specific sheet
  async clearSheetScheduleRecords(sheetId: string): Promise<void> {
    // Scan for records with this sheetId
    const result = await this.scan({
      filterExpression: 'sheetId = :sheetId',
      expressionAttributeValues: { ':sheetId': sheetId },
    })

    // Delete in batches
    const deletePromises = result.items.map(record => 
      this.delete(record.PK, record.SK)
    )

    await Promise.all(deletePromises)
  }
}