import type { 
  MemorialServiceType,
  SundaySchoolType, 
  BibleClassType,
  CycType,
  ProgramTypeKeys 
} from '@my/app/types'
import type { DirectoryRecord, ContactInfo } from '@my/app/provider/dynamodb/types'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class SheetTransformer {
  /**
   * Transform schedule data from Google Sheets to DynamoDB format
   */
  transformScheduleData(
    sheetData: any[][], 
    sheetId: string
  ): Array<{
    ecclesia: string
    date: string
    type: ProgramTypeKeys
    scheduleData: any
    time?: string
  }> {
    const records: Array<{
      ecclesia: string
      date: string
      type: ProgramTypeKeys
      scheduleData: any
      time?: string
    }> = []

    if (sheetData.length === 0) {
      console.warn(`⚠️ No data found in sheet ${sheetId}`)
      return records
    }

    // Get headers from first row
    const headers = sheetData[0] || []
    const rows = sheetData.slice(1)

    console.log(`📊 Processing ${rows.length} schedule rows with headers:`, headers)

    // Determine sheet type based on headers
    const sheetType = this.determineScheduleType(headers)
    const ecclesia = this.extractEcclesia(sheetId, headers, rows)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      if (!row || row.length === 0) {
        continue // Skip empty rows
      }

      try {
        const date = this.extractDate(row, headers, i)
        if (!date) {
          console.warn(`⚠️ No valid date found in row ${i + 2}`)
          continue
        }

        const scheduleData = this.transformRowToScheduleData(row, headers, sheetType)
        if (!scheduleData) {
          console.warn(`⚠️ Could not transform row ${i + 2} to schedule data`)
          continue
        }

        records.push({
          ecclesia,
          date,
          type: sheetType,
          scheduleData,
          time: this.extractTime(row, headers) || '09:00',
        })

      } catch (error) {
        console.error(`❌ Error processing row ${i + 2}:`, error)
      }
    }

    console.log(`✅ Transformed ${records.length} schedule records from sheet ${sheetId}`)
    return records
  }

  /**
   * Transform directory data from Google Sheets to DynamoDB format
   */
  transformDirectoryData(
    sheetData: any[][], 
    sheetId: string
  ): Array<{
    email: string
    firstName: string
    lastName: string
    ecclesia: string
    contactInfo: ContactInfo
    sheetId: string
  }> {
    const records: Array<{
      email: string
      firstName: string
      lastName: string
      ecclesia: string
      contactInfo: ContactInfo
      sheetId: string
    }> = []

    if (sheetData.length === 0) {
      console.warn(`⚠️ No data found in directory sheet ${sheetId}`)
      return records
    }

    const headers = sheetData[0] || []
    const rows = sheetData.slice(1)

    console.log(`📊 Processing ${rows.length} directory rows with headers:`, headers)

    // Create header mapping
    const headerMap = this.createHeaderMapping(headers, [
      'email', 'firstName', 'lastName', 'phone', 'address', 'emergencyContact', 'notes'
    ])

    const ecclesia = this.extractEcclesia(sheetId, headers, rows)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      
      if (!row || row.length === 0) {
        continue
      }

      try {
        const email = this.getValueByHeader(row, headerMap, 'email')
        const firstName = this.getValueByHeader(row, headerMap, 'firstName')
        const lastName = this.getValueByHeader(row, headerMap, 'lastName')

        if (!email || !firstName || !lastName) {
          console.warn(`⚠️ Missing required fields in row ${i + 2}:`, { email, firstName, lastName })
          continue
        }

        const contactInfo: ContactInfo = {
          phone: this.getValueByHeader(row, headerMap, 'phone') || undefined,
          address: this.getValueByHeader(row, headerMap, 'address') || undefined,
          emergencyContact: this.getValueByHeader(row, headerMap, 'emergencyContact') || undefined,
          notes: this.getValueByHeader(row, headerMap, 'notes') || undefined,
        }

        records.push({
          email,
          firstName,
          lastName,
          ecclesia,
          contactInfo,
          sheetId,
        })

      } catch (error) {
        console.error(`❌ Error processing directory row ${i + 2}:`, error)
      }
    }

    console.log(`✅ Transformed ${records.length} directory records from sheet ${sheetId}`)
    return records
  }

  /**
   * Validate data integrity
   */
  validateDataIntegrity(records: any[]): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
    }

    if (records.length === 0) {
      result.errors.push('No records to validate')
      result.valid = false
      return result
    }

    // Check for duplicate emails in directory records
    if (records[0]?.email) {
      const emails = new Set<string>()
      const duplicates: string[] = []

      records.forEach((record, index) => {
        if (emails.has(record.email)) {
          duplicates.push(`Row ${index + 1}: ${record.email}`)
        } else {
          emails.add(record.email)
        }
      })

      if (duplicates.length > 0) {
        result.warnings.push(`Duplicate emails found: ${duplicates.join(', ')}`)
      }
    }

    // Check for future dates in schedule records
    if (records[0]?.date) {
      const now = new Date()
      const futureDates = records.filter(record => {
        const recordDate = new Date(record.date)
        return recordDate > new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // More than 1 year in future
      })

      if (futureDates.length > 0) {
        result.warnings.push(`${futureDates.length} records have dates more than 1 year in the future`)
      }
    }

    console.log(`📋 Validation result: ${result.valid ? 'VALID' : 'INVALID'}, ${result.errors.length} errors, ${result.warnings.length} warnings`)
    return result
  }

  // Helper methods

  private determineScheduleType(headers: string[]): ProgramTypeKeys {
    const headerStr = headers.join(' ').toLowerCase()
    
    if (headerStr.includes('memorial') || headerStr.includes('preside') || headerStr.includes('exhort')) {
      return 'memorial'
    } else if (headerStr.includes('sunday school') || headerStr.includes('superintendent')) {
      return 'sundaySchool'
    } else if (headerStr.includes('bible class') || headerStr.includes('teacher')) {
      return 'bibleClass'
    } else if (headerStr.includes('cyc') || headerStr.includes('youth')) {
      return 'cyc'
    }
    
    return 'memorial' // Default fallback
  }

  private extractEcclesia(sheetId: string, headers: string[], rows: any[][]): string {
    // Try to extract ecclesia from sheet title or data
    // This could be configured or detected from sheet metadata
    return 'Toronto East' // Default for now - should be configurable
  }

  private extractDate(row: any[], headers: string[], rowIndex: number): string | null {
    // Look for date in common columns
    const dateColumns = ['date', 'Date', 'DATE', 'service date', 'Service Date']
    
    for (const col of dateColumns) {
      const index = headers.findIndex(h => h.toLowerCase().includes(col.toLowerCase()))
      if (index >= 0 && row[index]) {
        const dateValue = this.parseDate(row[index])
        if (dateValue) {
          return dateValue
        }
      }
    }
    
    // Try first column if it looks like a date
    if (row[0]) {
      const dateValue = this.parseDate(row[0])
      if (dateValue) {
        return dateValue
      }
    }
    
    return null
  }

  private extractTime(row: any[], headers: string[]): string | null {
    const timeColumns = ['time', 'Time', 'TIME', 'service time']
    
    for (const col of timeColumns) {
      const index = headers.findIndex(h => h.toLowerCase().includes(col.toLowerCase()))
      if (index >= 0 && row[index]) {
        return String(row[index])
      }
    }
    
    return null
  }

  private parseDate(value: any): string | null {
    if (!value) return null
    
    try {
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return null
      }
      
      // Return ISO date string (YYYY-MM-DD)
      return date.toISOString().split('T')[0]
    } catch {
      return null
    }
  }

  private transformRowToScheduleData(row: any[], headers: string[], type: ProgramTypeKeys): any {
    // Create a mapping of row data based on headers
    const data: Record<string, any> = {}
    
    headers.forEach((header, index) => {
      if (row[index] !== undefined && row[index] !== null && row[index] !== '') {
        data[header] = row[index]
      }
    })
    
    return data // Return raw data for now - can be enhanced for specific types
  }

  private createHeaderMapping(headers: string[], expectedFields: string[]): Record<string, number> {
    const mapping: Record<string, number> = {}
    
    expectedFields.forEach(field => {
      const index = headers.findIndex(header => 
        header.toLowerCase().includes(field.toLowerCase()) ||
        field.toLowerCase().includes(header.toLowerCase())
      )
      
      if (index >= 0) {
        mapping[field] = index
      }
    })
    
    return mapping
  }

  private getValueByHeader(row: any[], headerMap: Record<string, number>, field: string): string {
    const index = headerMap[field]
    if (index !== undefined && row[index] !== undefined) {
      return String(row[index]).trim()
    }
    return ''
  }
}