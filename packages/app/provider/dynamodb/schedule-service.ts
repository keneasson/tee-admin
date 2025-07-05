import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { GoogleSheetTypes, GoogleSheetData, ProgramTypeKeys } from '@my/app/types'

interface ScheduleRecord {
  pkey: string
  skey: string
  sheetType: 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'
  sheetId: string
  date: string
  data: Record<string, any>
  lastUpdated: string
  version: string
}

interface DirectoryRecord {
  pkey: string
  skey: string
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
        TableName: 'tee-schedules',
        KeyConditionExpression: 'pkey = :pk',
        ExpressionAttributeValues: {
          ':pk': `SCHEDULE#${sheetType.toUpperCase()}`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 100, // Reasonable limit for schedule data
      }))

      if (!response.Items || response.Items.length === 0) {
        console.warn(`⚠️ No ${sheetType} schedule data found in DynamoDB`)
        return null
      }

      // Transform DynamoDB records back to GoogleSheet format
      const scheduleRecords = response.Items as ScheduleRecord[]
      const sortedRecords = scheduleRecords.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Convert to GoogleSheetData format expected by frontend
      const headers = this.getHeadersForSheetType(sheetType)
      const rows = sortedRecords.map((record: ScheduleRecord) => this.convertRecordToRow(record, headers))

      const googleSheetData: GoogleSheetData = {
        title: this.getSheetTitle(sheetType),
        type: sheetType,
        content: [headers, ...rows],
        lastUpdated: scheduleRecords[0]?.lastUpdated || new Date().toISOString(),
        version: scheduleRecords[0]?.version || '1',
      }

      console.log(`✅ Retrieved ${rows.length} ${sheetType} schedule entries from DynamoDB`)
      return googleSheetData

    } catch (error) {
      console.error(`❌ Error fetching ${sheetType} schedule from DynamoDB:`, error)
      throw new Error(`Failed to fetch ${sheetType} schedule data`)
    }
  }

  /**
   * Get upcoming program events from all schedule types
   * Replaces: get_upcoming_program()
   */
  async getUpcomingProgram(orderOfKeys: ProgramTypeKeys[] = ['memorial', 'bibleClass', 'sundaySchool']): Promise<Array<{
    type: ProgramTypeKeys
    title: string
    date: Date
    details: Record<string, any>
  }>> {
    try {
      console.log('📅 Fetching upcoming program events from DynamoDB')

      const now = new Date()
      const upcomingEvents: Array<{
        type: ProgramTypeKeys
        title: string
        date: Date
        details: Record<string, any>
      }> = []

      // Fetch from each schedule type
      for (const sheetType of orderOfKeys) {
        try {
          const scheduleData = await this.getScheduleData(sheetType as any)
          if (!scheduleData?.content) continue

          const [headers, ...rows] = scheduleData.content
          const dateColumnIndex = this.getDateColumnIndex(sheetType, headers)

          if (dateColumnIndex === -1) continue

          // Find next 2 upcoming events for this sheet type
          const futureEvents = rows
            .map((row: any[]) => {
              const dateValue = row[dateColumnIndex]
              let eventDate: Date

              // Handle different date formats
              if (typeof dateValue === 'number') {
                // Google Sheets serial date
                eventDate = new Date((dateValue - 25569) * 86400 * 1000)
              } else if (typeof dateValue === 'string') {
                eventDate = new Date(dateValue)
              } else {
                return null
              }

              return {
                type: sheetType as ProgramTypeKeys,
                title: this.getSheetTitle(sheetType),
                date: eventDate,
                details: this.createEventDetails(headers, row),
              }
            })
            .filter((event: any) => event && event.date > now)
            .sort((a: any, b: any) => a!.date.getTime() - b!.date.getTime())
            .slice(0, 2) // Next 2 events

          upcomingEvents.push(...(futureEvents.filter(Boolean) as any[]))

        } catch (error) {
          console.warn(`⚠️ Failed to get upcoming events for ${sheetType}:`, error)
          // Continue with other sheet types
        }
      }

      // Sort all events by date and return
      const sortedEvents = upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime())
      
      console.log(`✅ Found ${sortedEvents.length} upcoming events from DynamoDB`)
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

      const response = await this.client.send(new GetCommand({
        TableName: 'tee-schedules',
        Key: {
          pkey: 'DIRECTORY#MEMBERS',
          skey: `USER#${email.toLowerCase()}`,
        },
      }))

      if (!response.Item) {
        console.log(`👤 User ${email} not found in DynamoDB directory`)
        return null
      }

      const user = response.Item as DirectoryRecord
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
        TableName: 'tee-schedules',
        KeyConditionExpression: 'pkey = :pk',
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
   * Check if data is fresh (for fallback strategy)
   */
  async isDataFresh(sheetType: string, maxAgeMinutes: number = 60): Promise<boolean> {
    try {
      const response = await this.client.send(new GetCommand({
        TableName: 'tee-schedules',
        Key: {
          pkey: `SCHEDULE#${sheetType.toUpperCase()}`,
          skey: 'METADATA',
        },
      }))

      if (!response.Item?.lastUpdated) {
        return false
      }

      const lastUpdated = new Date(response.Item.lastUpdated)
      const now = new Date()
      const ageMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60)

      return ageMinutes <= maxAgeMinutes

    } catch (error) {
      console.warn(`⚠️ Could not check data freshness for ${sheetType}:`, error)
      return false
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