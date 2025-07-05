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
  private buildSchedulePK(date: string): string {
    return `SCHEDULE#${date}`
  }

  private buildEventPK(eventId: string): string {
    return `EVENT#${eventId}`
  }

  private buildScheduleSK(ecclesia: string, type: string, time: string = '09:00'): string {
    return `${ecclesia}#${type}#${time}`
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
    time: string = '09:00'
  ): Promise<ScheduleRecord> {
    const record: ScheduleRecord = {
      PK: this.buildSchedulePK(date),
      SK: this.buildScheduleSK(ecclesia, eventType, time),
      GSI1PK: this.buildEcclesiaGSI1PK(ecclesia),
      GSI1SK: this.buildEcclesiaGSI1SK(date, eventType, time),
      GSI2PK: this.buildTypeGSI2PK(eventType),
      GSI2SK: `${date}#${time}`,
      ecclesia,
      date,
      type: eventType,
      scheduleData: data,
      sheetId,
      lastUpdated: new Date().toISOString(),
      version: 1,
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
    time: string = '09:00'
  ): Promise<ScheduleRecord | null> {
    return this.get(
      this.buildSchedulePK(date),
      this.buildScheduleSK(ecclesia, eventType, time)
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
    time: string = '09:00'
  ): Promise<ScheduleRecord> {
    return this.update(
      this.buildSchedulePK(date),
      this.buildScheduleSK(ecclesia, eventType, time),
      { scheduleData: data }
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
    time: string = '09:00'
  ): Promise<void> {
    return this.delete(
      this.buildSchedulePK(date),
      this.buildScheduleSK(ecclesia, eventType, time)
    )
  }

  // Delete standalone event
  async deleteEvent(eventId: string): Promise<void> {
    return this.delete(this.buildEventPK(eventId), 'DETAILS')
  }

  // Bulk operations for sheet sync
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
    // Clear existing records for this sheet
    await this.clearSheetScheduleRecords(sheetId)

    // Create new records with proper keys
    const records: ScheduleRecord[] = schedules.map(schedule => ({
      PK: this.buildSchedulePK(schedule.date),
      SK: this.buildScheduleSK(schedule.ecclesia, schedule.type, schedule.time || '09:00'),
      GSI1PK: this.buildEcclesiaGSI1PK(schedule.ecclesia),
      GSI1SK: this.buildEcclesiaGSI1SK(schedule.date, schedule.type, schedule.time || '09:00'),
      GSI2PK: this.buildTypeGSI2PK(schedule.type),
      GSI2SK: `${schedule.date}#${schedule.time || '09:00'}`,
      ecclesia: schedule.ecclesia,
      date: schedule.date,
      type: schedule.type,
      scheduleData: schedule.scheduleData,
      sheetId,
      lastUpdated: new Date().toISOString(),
      version: 1,
    }))

    // Batch write new records
    const result = await this.batchWrite(records)
    return { 
      successful: result.successful, 
      failed: result.failed, 
      errors: result.errors 
    }
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