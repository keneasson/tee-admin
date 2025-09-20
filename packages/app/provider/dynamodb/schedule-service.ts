import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { GoogleSheetTypes, GoogleSheetData, ProgramTypeKeys } from '@my/app/types'
import { tableNames } from './config'

interface ScheduleRecord {
  PK: string
  SK: string
  sheetType: 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'
  sheetId: string
  date: string
  data: Record<string, any>
  lastUpdated: string
  version: string
}

interface DirectoryRecord {
  PK: string
  SK: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  lastUpdated: string
  version: string
}

/**
 * DynamoDB service for querying schedule and directory data
 * Replaces direct Google Sheets API calls with cached DynamoDB data
 */
export class ScheduleService {
  private client: DynamoDBDocumentClient

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ca-central-1',
    })
    this.client = DynamoDBDocumentClient.from(dynamoClient)
  }

  /**
   * Get schedule data for a specific sheet type
   * Replaces: get_google_sheet() for schedule types
   */
  async getScheduleData(sheetType: 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'): Promise<GoogleSheetData | null> {
    try {
      console.log(`📊 Fetching ${sheetType} schedule from DynamoDB`)

      const response = await this.client.send(new QueryCommand({
        TableName: tableNames.schedules,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `SCHEDULE#${sheetType.toUpperCase()}`,
        },
        ScanIndexForward: true, // Chronological order
        // No limit to get all records
      }))

      if (!response.Items || response.Items.length === 0) {
        console.warn(`⚠️ No ${sheetType} schedule data found in DynamoDB`)
        return null
      }

      // Transform DynamoDB records back to GoogleSheet format
      const scheduleRecords = response.Items as ScheduleRecord[]
      // Records should already be in chronological order due to ScanIndexForward: true
      // But sort again to ensure consistency
      const sortedRecords = scheduleRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Convert to GoogleSheetData format - return original data objects
      const content = sortedRecords.map((record: ScheduleRecord) => record.data)

      const googleSheetData: GoogleSheetData = {
        title: this.getSheetTitle(sheetType),
        type: sheetType,
        content: content,
        lastUpdated: scheduleRecords[0]?.lastUpdated || new Date().toISOString(),
        version: scheduleRecords[0]?.version || '1',
      }

      console.log(`✅ Retrieved ${content.length} ${sheetType} schedule entries from DynamoDB`)
      return googleSheetData

    } catch (error) {
      console.error(`❌ Error fetching ${sheetType} schedule from DynamoDB:`, error)
      throw new Error(`Failed to fetch ${sheetType} schedule data`)
    }
  }

  /**
   * Get upcoming program events from all schedule types (optimized for newsletter)
   * Returns events from 2 hours ago to 2 weeks from now
   * Replaces: get_upcoming_program()
   */
  async getUpcomingProgram(orderOfKeys: ProgramTypeKeys[] = ['sundaySchool', 'memorial', 'bibleClass']): Promise<Array<{
    type: ProgramTypeKeys
    title: string
    date: Date
    details: Record<string, any>
  }>> {
    try {
      console.log('📅 Fetching upcoming program events from DynamoDB (newsletter optimized)')

      // Newsletter time range: today (00:00:00) to 2 weeks from now
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // Today at 00:00:00
      const twoWeeksFromNow = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)) // 2 weeks from now

      console.log(`📅 Date range: ${todayStart.toISOString()} to ${twoWeeksFromNow.toISOString()}`)

      const upcomingEvents: Array<{
        type: ProgramTypeKeys
        title: string
        date: Date
        details: Record<string, any>
      }> = []

      // Fetch events for each schedule type using the working getScheduleData method
      for (const sheetType of orderOfKeys) {
        try {
          console.log(`🔄 Fetching ${sheetType} events for upcoming program`)
          
          // Get full schedule data using the working method
          const scheduleData = await this.getScheduleData(sheetType)
          
          if (!scheduleData || !scheduleData.content) {
            console.log(`📅 No ${sheetType} schedule data found`)
            continue
          }

          // Filter events within the time range
          const filteredEvents = scheduleData.content.filter((event: any) => {
            const eventDate = new Date(event.Date || event.date)
            if (isNaN(eventDate.getTime())) {
              console.warn(`⚠️ Invalid date found in ${sheetType}:`, event.Date || event.date)
              return false
            }
            return eventDate >= todayStart && eventDate <= twoWeeksFromNow
          })

          // Convert to the expected format
          filteredEvents.forEach((event: any) => {
            const eventDate = new Date(event.Date || event.date)
            
            upcomingEvents.push({
              type: sheetType as ProgramTypeKeys,
              title: this.getSheetTitle(sheetType),
              date: eventDate,
              details: event // The full event object
            })
          })

          console.log(`📅 Found ${filteredEvents.length} upcoming events for ${sheetType}`)
          
        } catch (error) {
          console.warn(`⚠️ Failed to get upcoming events for ${sheetType}:`, error)
          // Continue with other sheet types
        }
      }

      // Sort all events by date and return
      const sortedEvents = upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime())
      
      console.log(`✅ Found ${sortedEvents.length} upcoming events from DynamoDB in date range`)
      return sortedEvents

    } catch (error) {
      console.error('❌ Error fetching upcoming program from DynamoDB:', error)
      throw new Error('Failed to fetch upcoming program data')
    }
  }


  /**
   * Get directory data for user lookup
   * Replaces: userFromLegacy() Google Sheets lookup
   */
  async getUserFromDirectory(email: string): Promise<DirectoryRecord | null> {
    try {
      console.log(`👤 Looking up user ${email} in DynamoDB directory`)

      // Since we have indexed keys, we need to query by email
      const response = await this.client.send(new QueryCommand({
        TableName: tableNames.schedules,
        KeyConditionExpression: 'PK = :pk',
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':pk': 'DIRECTORY#MEMBERS',
          ':email': email.toLowerCase(),
        },
      }))

      if (!response.Items || response.Items.length === 0) {
        console.log(`👤 User ${email} not found in DynamoDB directory`)
        return null
      }

      const user = response.Items[0] as DirectoryRecord
      console.log(`✅ Found user ${email} in DynamoDB directory`)
      return user

    } catch (error) {
      console.error(`❌ Error looking up user ${email} in DynamoDB:`, error)
      throw new Error(`Failed to lookup user: ${email}`)
    }
  }

  /**
   * Get all directory members (for admin purposes)
   * Replaces: get_google_sheet('directory')
   */
  async getDirectoryData(): Promise<GoogleSheetData | null> {
    try {
      console.log('📋 Fetching directory data from DynamoDB')

      const response = await this.client.send(new QueryCommand({
        TableName: tableNames.schedules,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': 'DIRECTORY#MEMBERS',
        },
      }))

      if (!response.Items || response.Items.length === 0) {
        console.warn('⚠️ No directory data found in DynamoDB')
        return null
      }

      // Transform DynamoDB records to GoogleSheet format
      const directoryRecords = response.Items as DirectoryRecord[]
      const headers = ['LastName', 'FirstName', 'Address', 'Phone', 'Email']
      const rows = directoryRecords.map(record => [
        record.lastName || '',
        record.firstName || '',
        record.address || '',
        record.phone || '',
        record.email || '',
      ])

      const googleSheetData: GoogleSheetData = {
        title: 'Directory',
        type: 'directory',
        content: [headers, ...rows],
        lastUpdated: directoryRecords[0]?.lastUpdated || new Date().toISOString(),
        version: directoryRecords[0]?.version || '1',
      }

      console.log(`✅ Retrieved ${rows.length} directory entries from DynamoDB`)
      return googleSheetData

    } catch (error) {
      console.error('❌ Error fetching directory from DynamoDB:', error)
      throw new Error('Failed to fetch directory data')
    }
  }

  /**
   * Get sync status for a sheet type (for monitoring/debugging)
   */
  async getSyncStatus(sheetType: string): Promise<{
    lastSync?: string
    status: 'synced' | 'missing' | 'error'
    message: string
  }> {
    try {
      const response = await this.client.send(new GetCommand({
        TableName: tableNames.syncStatus,
        Key: {
          PK: `SYNC#${sheetType.toUpperCase()}`,
          SK: 'STATUS',
        },
      }))

      if (!response.Item?.lastSync) {
        return {
          status: 'missing',
          message: `No sync status found for ${sheetType}`
        }
      }

      return {
        lastSync: response.Item.lastSync,
        status: 'synced',
        message: `Last synced: ${response.Item.lastSync}`
      }

    } catch (error) {
      return {
        status: 'error',
        message: `Error checking sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Helper methods
  private getHeadersForSheetType(sheetType: string): string[] {
    switch (sheetType) {
      case 'memorial':
        return ['Tim', 'Preside', 'Exhort', 'Steward', 'Doorkeeper', 'Date', /* ... */]
      case 'bibleClass':
        return ['Date', 'Teacher', 'Topic', 'Notes', /* ... */]
      case 'sundaySchool':
        return ['Date', 'Teacher', 'Lesson', 'Helper', /* ... */]
      case 'cyc':
        return ['Date', 'Activity', 'Leader', 'Notes', /* ... */]
      default:
        return ['Date', 'Data']
    }
  }

  private getSheetTitle(sheetType: string): string {
    switch (sheetType) {
      case 'memorial': return 'Sunday Memorial Schedule - 2024'
      case 'bibleClass': return 'Bible Class Schedule - 2024'
      case 'sundaySchool': return 'Sunday School Schedule - 2024'
      case 'cyc': return 'CYC Schedule - 2024'
      default: return `${sheetType} Schedule`
    }
  }

  private getDateColumnIndex(sheetType: string, headers: string[]): number {
    // Common date column names
    const dateColumns = ['Date', 'Tim', 'date', 'Date/Time']
    return headers.findIndex(header => dateColumns.includes(header))
  }

  private convertRecordToRow(record: ScheduleRecord, headers: string[]): any[] {
    // Convert DynamoDB record back to row format
    return headers.map(header => record.data[header] || '')
  }

  private createEventDetails(headers: string[], row: any[]): Record<string, any> {
    const details: Record<string, any> = {}
    headers.forEach((header, index) => {
      details[header] = row[index]
    })
    return details
  }
}