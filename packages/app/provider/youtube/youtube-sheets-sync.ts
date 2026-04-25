import { google } from 'googleapis'
import { googleSheetsConfig } from '@my/app/config/google-sheets'

/**
 * Service for syncing YouTube livestream URLs to Google Sheets
 * Uses write permissions to update the YouTube column in Memorial schedule
 */
export class YouTubeSheetsSync {
  private sheets: any

  constructor() {
    // Initialize Google APIs with service account (WRITE permissions)
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE

    let auth: any
    if (keyFile && keyFile.startsWith('./')) {
      // Use key file path (for production)
      auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets', // Full read/write access
        ],
      })
    } else {
      // Try to load credentials from the service account file directly
      let credentials: any = null

      try {
        // Try to read from the standard service account file location
        const fs = require('fs')

        // Check for the service account file in multiple locations
        const possiblePaths = [
          './apps/next/tee-services-db47a9e534d3.json',
          '../apps/next/tee-services-db47a9e534d3.json',
          '../../apps/next/tee-services-db47a9e534d3.json',
          process.cwd() + '/apps/next/tee-services-db47a9e534d3.json',
        ]

        for (const filePath of possiblePaths) {
          try {
            if (fs.existsSync(filePath)) {
              credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'))
              console.log('📊 Loaded Google service account for YouTube Sheets sync from:', filePath)
              break
            }
          } catch (e) {
            // Continue to next path
          }
        }
      } catch (e) {
        // Fall back to environment variables
      }

      if (!credentials) {
        // Try GOOGLE_SERVICE_ACCOUNT_KEY first (full JSON as environment variable)
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
        if (serviceAccountKey) {
          try {
            credentials = JSON.parse(serviceAccountKey)
            console.log(
              '📊 Loaded Google service account for YouTube Sheets sync from environment variable'
            )
          } catch (e) {
            console.error('❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:', e)
          }
        }

        // Fallback to individual environment variables
        if (!credentials) {
          const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
          const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

          if (serviceAccountEmail && privateKey) {
            credentials = {
              client_email: serviceAccountEmail,
              private_key: privateKey,
            }
          } else {
            throw new Error(
              'Google Service Account credentials not configured for YouTube Sheets sync'
            )
          }
        }
      }

      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets', // Full read/write access
        ],
      })
    }

    this.sheets = google.sheets({ version: 'v4', auth })
  }

  /**
   * Find the row index for a specific date in the Memorial schedule
   * Returns the row number (1-indexed) or null if not found
   */
  async findDateRow(sheetId: string, targetDate: string | Date): Promise<number | null> {
    try {
      // Convert target date to a comparable format (YYYY-MM-DD or formatted string)
      const searchDate = typeof targetDate === 'string' ? targetDate : targetDate.toISOString().split('T')[0]

      console.log(`📊 Searching for date: ${searchDate} in sheet ${sheetId}`)

      // Get all data from the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:A', // Date column is typically column A
      })

      const rows = response.data.values || []

      // Search for the matching date
      for (let i = 0; i < rows.length; i++) {
        const cellValue = rows[i][0]
        if (!cellValue) continue

        // Try to match the date in various formats
        const cellDate = new Date(cellValue)
        const cellDateStr = cellDate.toISOString().split('T')[0]

        // Also try direct string comparison for formatted dates like "Feb 25, 2024"
        if (
          cellDateStr === searchDate ||
          cellValue.toString().includes(searchDate) ||
          this.formatDate(cellDate) === searchDate
        ) {
          console.log(`✅ Found date at row ${i + 1}`)
          return i + 1 // Sheets rows are 1-indexed
        }
      }

      console.log(`❌ Date not found in sheet: ${searchDate}`)
      return null
    } catch (error) {
      console.error('❌ Error finding date row:', error)
      throw new Error(`Failed to find date row: ${error instanceof Error ? error.message : error}`)
    }
  }

  /**
   * Update the YouTube URL for a specific date in the Memorial schedule
   */
  async updateYouTubeUrl(targetDate: string | Date, youtubeUrl: string): Promise<boolean> {
    try {
      // Get the Memorial sheet ID from config
      const memorialSheetId = googleSheetsConfig.getSheetId('memorial')
      if (!memorialSheetId) {
        throw new Error('Memorial sheet ID not configured')
      }

      console.log(`📺 Updating YouTube URL for ${targetDate}`)
      console.log(`📺 YouTube URL: ${youtubeUrl}`)

      // Find the row for this date
      const rowIndex = await this.findDateRow(memorialSheetId, targetDate)

      if (!rowIndex) {
        console.error(`❌ Could not find row for date: ${targetDate}`)
        return false
      }

      // Get the headers to find the YouTube column
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: memorialSheetId,
        range: '1:1', // First row contains headers
      })

      const headers = headersResponse.data.values?.[0] || []
      const youtubeColumnIndex = headers.findIndex(
        (header: string) => header && header.toLowerCase().includes('youtube')
      )

      if (youtubeColumnIndex === -1) {
        console.error('❌ YouTube column not found in headers')
        return false
      }

      // Convert column index to letter (0 = A, 1 = B, etc.)
      const columnLetter = this.columnIndexToLetter(youtubeColumnIndex)

      // Update the cell
      const range = `${columnLetter}${rowIndex}`
      console.log(`📊 Updating cell ${range} in sheet ${memorialSheetId}`)

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: memorialSheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[youtubeUrl]],
        },
      })

      console.log(`✅ Successfully updated YouTube URL in Google Sheets at ${range}`)
      return true
    } catch (error) {
      console.error('❌ Error updating YouTube URL in Google Sheets:', error)
      throw new Error(
        `Failed to update YouTube URL in Google Sheets: ${error instanceof Error ? error.message : error}`
      )
    }
  }

  /**
   * Batch update multiple YouTube URLs
   */
  async batchUpdateYouTubeUrls(
    updates: Array<{ date: string | Date; url: string }>
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0
    let failed = 0

    for (const update of updates) {
      try {
        const result = await this.updateYouTubeUrl(update.date, update.url)
        if (result) {
          successful++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`❌ Failed to update YouTube URL for ${update.date}:`, error)
        failed++
      }
    }

    console.log(`📊 Batch update complete: ${successful} successful, ${failed} failed`)
    return { successful, failed }
  }

  /**
   * Helper: Convert column index to letter (0 = A, 1 = B, ..., 25 = Z, 26 = AA, etc.)
   */
  private columnIndexToLetter(index: number): string {
    let letter = ''
    let num = index

    while (num >= 0) {
      letter = String.fromCharCode((num % 26) + 65) + letter
      num = Math.floor(num / 26) - 1
    }

    return letter
  }

  /**
   * Helper: Format date for comparison
   */
  private formatDate(date: Date): string {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]

    const month = monthNames[date.getMonth()]
    const day = date.getDate()
    const year = date.getFullYear()

    return `${month} ${day}, ${year}`
  }
}
